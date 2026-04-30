"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { fmtEth, fmtTime, parseRevert } from "@/lib/format";
import { toast } from "@/components/Toast";

type Booking = {
  id: bigint;
  resourceId: bigint;
  user: string;
  startTime: bigint;
  endTime: bigint;
  amountPaid: bigint;
  cancelled: boolean;
};

type Resource = {
  id: bigint;
  name: string;
  description: string;
  pricePerHour: bigint;
  active: boolean;
};

export default function BookingsPage() {
  const { contract, address, connect } = useWallet();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [resources, setResources] = useState<Map<string, Resource>>(new Map());
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reputation, setReputation] = useState<bigint>(0n);
  const [claimedMap, setClaimedMap] = useState<Record<string, boolean>>({});
  const [tokenUris, setTokenUris] = useState<Record<string, string>>({});
  const [showReceipt, setShowReceipt] = useState<{ id: string; uri: string } | null>(null);

  const load = useCallback(async () => {
    if (!contract || !address) return;
    setLoading(true);
    try {
      const [bs, rs, rep]: [Booking[], Resource[], bigint] = await Promise.all([
        contract.getMyBookings(),
        contract.getAllResources(),
        contract.reputation(address),
      ]);
      const map = new Map<string, Resource>();
      for (const r of rs) map.set(String(r.id), r);
      setResources(map);
      setReputation(rep);
      const sorted = [...bs].sort((a, b) => Number(b.id) - Number(a.id));
      setBookings(sorted);

      // claimed flags + token URIs (for non-cancelled)
      const claimed: Record<string, boolean> = {};
      const uris: Record<string, string> = {};
      await Promise.all(
        sorted.map(async (b) => {
          try {
            claimed[String(b.id)] = await contract.reputationClaimed(b.id);
          } catch {
            claimed[String(b.id)] = false;
          }
          if (!b.cancelled) {
            try {
              uris[String(b.id)] = await contract.tokenURI(b.id);
            } catch {
              /* burned or missing */
            }
          }
        })
      );
      setClaimedMap(claimed);
      setTokenUris(uris);
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(id: bigint) {
    if (!contract) return;
    setBusyId(String(id));
    try {
      const tx = await contract.claimReputation(id);
      toast("Claiming reputation…");
      await tx.wait();
      toast("Reputation +1 ✓", "success");
      load();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  async function cancel(id: bigint) {
    if (!contract) return;
    setBusyId(String(id));
    try {
      const tx = await contract.cancelBooking(id);
      toast("Cancellation submitted…");
      await tx.wait();
      toast("Refund received ✓", "success");
      load();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setBusyId(null);
    }
  }

  if (!address) {
    return (
      <div className="card text-center">
        <h2 className="font-display text-2xl text-forest-800">Connect to view your bookings</h2>
        <button onClick={connect} className="btn-primary mt-4">
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-forest-800">My bookings</h1>
          <p className="text-forest-700/70">
            Each booking mints a soulbound NFT receipt to your wallet.
          </p>
        </div>
        <div className="card flex items-center gap-3 py-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-forest-600 text-cream-50 font-display text-lg">
            ★
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-forest-700/60">
              Reputation
            </div>
            <div className="font-display text-xl text-forest-800">{String(reputation)} pts</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading your bookings…</div>
      ) : bookings.length === 0 ? (
        <div className="card text-forest-700/80">
          You have no bookings yet. Head to the resources page to make your first booking.
        </div>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => {
            const r = resources.get(String(b.resourceId));
            const now = Math.floor(Date.now() / 1000);
            const isPast = Number(b.endTime) < now;
            const isUpcoming = Number(b.startTime) > now;
            return (
              <div key={String(b.id)} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-forest-800">
                      {r?.name ?? `Resource #${String(b.resourceId)}`}
                    </span>
                    <span
                      className={
                        b.cancelled
                          ? "chip border-red-200 bg-red-50 text-red-700"
                          : isPast
                          ? "chip"
                          : isUpcoming
                          ? "chip bg-forest-100 text-forest-700"
                          : "chip bg-wood-400/20 text-wood-700"
                      }
                    >
                      {b.cancelled ? "cancelled" : isPast ? "past" : isUpcoming ? "upcoming" : "active now"}
                    </span>
                  </div>
                  <div className="text-sm text-forest-700/80 mt-1">
                    {fmtTime(b.startTime)} → {fmtTime(b.endTime)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-forest-700/60">Paid</div>
                  <div className="font-display text-lg text-forest-800">
                    {fmtEth(b.amountPaid)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!b.cancelled && tokenUris[String(b.id)] && (
                    <button
                      onClick={() =>
                        setShowReceipt({ id: String(b.id), uri: tokenUris[String(b.id)] })
                      }
                      className="btn-ghost"
                    >
                      View NFT
                    </button>
                  )}
                  {!b.cancelled && isPast && !claimedMap[String(b.id)] && (
                    <button
                      onClick={() => claim(b.id)}
                      disabled={busyId === String(b.id)}
                      className="btn-primary"
                    >
                      {busyId === String(b.id) ? "Claiming…" : "Claim +1 reputation"}
                    </button>
                  )}
                  {!b.cancelled && isUpcoming && (
                    <button
                      onClick={() => cancel(b.id)}
                      disabled={busyId === String(b.id)}
                      className="btn-secondary"
                    >
                      {busyId === String(b.id) ? "Cancelling…" : "Cancel & refund"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showReceipt && (
        <ReceiptModal
          id={showReceipt.id}
          uri={showReceipt.uri}
          onClose={() => setShowReceipt(null)}
        />
      )}
    </div>
  );
}

function ReceiptModal({
  id,
  uri,
  onClose,
}: {
  id: string;
  uri: string;
  onClose: () => void;
}) {
  let imgSrc = "";
  let meta: { name?: string; description?: string } = {};
  try {
    const b64 = uri.replace("data:application/json;base64,", "");
    const json = JSON.parse(atob(b64));
    imgSrc = json.image as string;
    meta = json;
  } catch {
    /* ignore */
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bark/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-forest-700/60">
              NFT Receipt #{id}
            </div>
            <h2 className="font-display text-xl text-forest-800">{meta.name ?? "Booking"}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost px-3 py-1">
            ✕
          </button>
        </div>
        {imgSrc ? (
          <div className="rounded-2xl overflow-hidden border border-cream-200">
            <img src={imgSrc} alt="Booking NFT" className="w-full" />
          </div>
        ) : (
          <div className="card text-forest-700/70">Could not render image.</div>
        )}
        <p className="text-xs text-forest-700/70">
          Soulbound (ERC-5192). Cannot be transferred. Burn happens automatically on cancel.
        </p>
      </div>
    </div>
  );
}

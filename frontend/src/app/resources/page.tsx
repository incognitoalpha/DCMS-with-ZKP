"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { fmtEth, fmtTime, toLocalInput, fromLocalInput, parseRevert } from "@/lib/format";
import { toast } from "@/components/Toast";

type Resource = {
  id: bigint;
  name: string;
  description: string;
  pricePerHour: bigint;
  active: boolean;
};

type Booking = {
  id: bigint;
  resourceId: bigint;
  user: string;
  startTime: bigint;
  endTime: bigint;
  amountPaid: bigint;
  cancelled: boolean;
};

export default function ResourcesPage() {
  const { contract, address, connect } = useWallet();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Resource | null>(null);

  const [surges, setSurges] = useState<Record<string, bigint>>({});

  const load = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const list: Resource[] = await contract.getAllResources();
      setResources(list);
      const entries = await Promise.all(
        list.map(async (r) => {
          try {
            const s: bigint = await contract.surgeMultiplierBps(r.id);
            return [String(r.id), s] as const;
          } catch {
            return [String(r.id), 10000n] as const;
          }
        })
      );
      setSurges(Object.fromEntries(entries));
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setLoading(false);
    }
  }, [contract]);

  useEffect(() => {
    load();
  }, [load]);

  if (!address) {
    return (
      <div className="card text-center">
        <h2 className="font-display text-2xl text-forest-800">Connect to browse resources</h2>
        <p className="mt-2 text-forest-700/70">Your wallet is your identity in DCMS.</p>
        <button onClick={connect} className="btn-primary mt-4">
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-forest-800">Available resources</h1>
          <p className="text-forest-700/70">Pick a resource and book a time slot.</p>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading on-chain resources…</div>
      ) : resources.length === 0 ? (
        <div className="card text-forest-700/80">
          No resources yet. Ask the admin to add some, or visit the admin page if you are
          the admin.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {resources.map((r) => (
            <ResourceCard
              key={String(r.id)}
              r={r}
              surgeBps={surges[String(r.id)] ?? 10000n}
              onBook={() => setSelected(r)}
            />
          ))}
        </div>
      )}

      {selected && (
        <BookModal
          resource={selected}
          onClose={() => setSelected(null)}
          onBooked={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function ResourceCard({
  r,
  surgeBps,
  onBook,
}: {
  r: Resource;
  surgeBps: bigint;
  onBook: () => void;
}) {
  const multiplier = Number(surgeBps) / 10000;
  const effective = (r.pricePerHour * surgeBps) / 10000n;
  const isSurging = surgeBps > 10000n;

  return (
    <div className="card flex flex-col">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-xl text-forest-800">{r.name}</div>
          <div className="text-sm text-forest-700/70">#{String(r.id)}</div>
        </div>
        <span className={r.active ? "chip" : "chip border-red-200 bg-red-50 text-red-700"}>
          {r.active ? "available" : "inactive"}
        </span>
      </div>
      <p className="mt-3 text-sm text-forest-700/80 flex-1">{r.description}</p>
      {isSurging && (
        <div className="mt-3 rounded-lg bg-wood-400/15 border border-wood-400/30 px-3 py-1.5 text-xs text-wood-700">
          Surge active · {multiplier.toFixed(2)}× — high demand in next 7 days
        </div>
      )}
      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-forest-700/60">Per hour</div>
          <div className="font-display text-lg text-forest-800">
            {fmtEth(effective)}
            {isSurging && (
              <span className="ml-2 text-xs text-forest-700/60 line-through">
                {fmtEth(r.pricePerHour)}
              </span>
            )}
          </div>
        </div>
        <button disabled={!r.active} onClick={onBook} className="btn-primary">
          Book
        </button>
      </div>
    </div>
  );
}

function BookModal({
  resource,
  onClose,
  onBooked,
}: {
  resource: Resource;
  onClose: () => void;
  onBooked: () => void;
}) {
  const { contract } = useWallet();
  const now = Math.floor(Date.now() / 1000);
  const [start, setStart] = useState(toLocalInput(now + 3600));
  const [end, setEnd] = useState(toLocalInput(now + 3600 * 2));
  const [busy, setBusy] = useState(false);
  const [existing, setExisting] = useState<Booking[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!contract) return;
      try {
        const list: Booking[] = await contract.getBookingsForResource(resource.id);
        if (!cancelled) setExisting(list);
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contract, resource.id]);

  const startTs = fromLocalInput(start);
  const endTs = fromLocalInput(end);
  const validRange = endTs > startTs;
  const hours = validRange ? Math.ceil((endTs - startTs) / 3600) : 0;
  const [quotedCost, setQuotedCost] = useState<bigint>(0n);
  const [quotedSurge, setQuotedSurge] = useState<bigint>(10000n);
  useEffect(() => {
    let cancelled = false;
    if (!contract || !validRange) return;
    (async () => {
      try {
        const [c, s] = await contract.quote(resource.id, startTs, endTs);
        if (!cancelled) {
          setQuotedCost(c as bigint);
          setQuotedSurge(s as bigint);
        }
      } catch {
        /* silent */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [contract, resource.id, startTs, endTs, validRange]);
  const cost = quotedCost;

  async function submit() {
    if (!contract) return;
    if (!validRange) {
      toast("End must be after start", "error");
      return;
    }
    setBusy(true);
    try {
      const tx = await contract.bookResource(resource.id, startTs, endTs, { value: cost });
      toast("Booking submitted, waiting for confirmation…");
      await tx.wait();
      toast("Booking confirmed on-chain ✓", "success");
      onBooked();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-bark/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-lg space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-forest-700/60">
              Booking
            </div>
            <h2 className="font-display text-2xl text-forest-800">{resource.name}</h2>
          </div>
          <button onClick={onClose} className="btn-ghost px-3 py-1">
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">Start</label>
            <input
              type="datetime-local"
              className="input mt-1"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div>
            <label className="label">End</label>
            <input
              type="datetime-local"
              className="input mt-1"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl bg-cream-100 p-3 text-sm text-forest-700 space-y-1">
          <div className="flex justify-between">
            <span>Duration</span>
            <span className="font-mono">{hours} hour(s)</span>
          </div>
          <div className="flex justify-between">
            <span>Surge multiplier</span>
            <span className="font-mono">
              {(Number(quotedSurge) / 10000).toFixed(2)}×
              {quotedSurge > 10000n && (
                <span className="ml-2 chip bg-wood-400/15 text-wood-700 border-wood-400/30 py-0">
                  surge
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between font-medium">
            <span>Total cost</span>
            <span className="font-mono">
              {hours > 0 ? `${(Number(cost) / 1e18).toFixed(6)} ETH` : "—"}
            </span>
          </div>
        </div>

        {existing.length > 0 && (
          <div className="rounded-xl border border-cream-200 p-3">
            <div className="label mb-2">Existing bookings on this resource</div>
            <ul className="space-y-1 max-h-32 overflow-auto text-xs text-forest-700/80">
              {existing
                .filter((b) => !b.cancelled)
                .map((b) => (
                  <li key={String(b.id)} className="flex justify-between">
                    <span>{fmtTime(b.startTime)}</span>
                    <span>→ {fmtTime(b.endTime)}</span>
                  </li>
                ))}
              {existing.filter((b) => !b.cancelled).length === 0 && <li>No bookings yet.</li>}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !validRange} className="btn-primary">
            {busy ? "Confirming…" : "Confirm booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

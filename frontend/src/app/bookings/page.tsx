"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { fmtEth, fmtTime, parseRevert } from "@/lib/format";
import { toast } from "@/components/Toast";
import { hasStoredIdentity, generateReputationProof, formatProofForContract, generateReputationCommitment } from "@/lib/zkp";

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
  const [hasZKP, setHasZKP] = useState(false);
  const [mySecrets, setMySecrets] = useState<Record<string, string>>({});

  useEffect(() => {
    setHasZKP(hasStoredIdentity());
    if (typeof window !== "undefined") {
      setMySecrets(JSON.parse(localStorage.getItem("dcms_bookings") || "{}"));
    }
  }, []);

  const load = useCallback(async () => {
    if (!contract || !address) return;
    setLoading(true);
    try {
      const rs: Resource[] = await contract.getAllResources();
      const map = new Map<string, Resource>();
      for (const r of rs) map.set(String(r.id), r);
      setResources(map);
      
      // In a real ZKP app, we would query the indexer or events for our commitments.
      // For this demo, we'll scan events for BookingCreated.
      const filter = contract.filters.BookingCreated();
      const events = await contract.queryFilter(filter, 0, 'latest');
      
      const bs: Booking[] = [];
      const claimed: Record<string, boolean> = {};

      let rep = 0n;

      for (const e of events) {
        const event = e as any;
        const commitment = event.args[0].toString();
        const nullifier = event.args[1];
        const resourceId = event.args[2];
        
        // If we have the secret for this commitment in local storage, it's ours!
        if (mySecrets[commitment]) {
           const secretStr = mySecrets[commitment];
           const repCommitment = await generateReputationCommitment(BigInt(secretStr), 1n);
           // We don't have startTime/endTime since they are private, so we mock them for UI.
           // In production, user stores startTime/endTime locally alongside the secret.
           bs.push({
             id: BigInt(commitment), // Using commitment as ID for UI purposes
             resourceId,
             user: address,
             startTime: 0n, // Private
             endTime: 0n, // Private
             amountPaid: 0n,
             cancelled: false
           });
           
           try {
             claimed[commitment] = await contract.reputationCommitments(repCommitment);
             if (claimed[commitment]) rep++;
           } catch {
             claimed[commitment] = false;
           }
        }
      }

      setReputation(rep);
      const sorted = [...bs].reverse();
      setBookings(sorted);
      setClaimedMap(claimed);

    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setLoading(false);
    }
  }, [contract, address, mySecrets]);

  useEffect(() => {
    load();
  }, [load]);

  async function claim(commitment: bigint) {
    if (!contract) return;
    setBusyId(String(commitment));
    try {
      const secretStr = mySecrets[commitment.toString()];
      if (!secretStr) {
        toast("No secret found for this booking", "error");
        return;
      }
      
      toast("Generating ZKP for Reputation Claim...");
      
      const secret = BigInt(secretStr);
      // For demo, we are proving score=1, threshold=1.
      const proof = await generateReputationProof(secret, 1n, 1n);
      const repCommitment = proof.publicSignals[1];
      const [a, b, c] = formatProofForContract(proof);
      
      const tx = await contract.claimReputation(1n, repCommitment, a, b, c);
      toast("Claim submitted...");
      await tx.wait();
      toast("Reputation +1 ✓", "success");
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
          <h1 className="font-display text-3xl text-forest-800">My private bookings</h1>
          <p className="text-forest-700/70">
            Fully anonymous via ZK-SNARKs. Times and payment are hidden.
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

        <div className="card flex items-center gap-3 py-3 border-forest-300">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-bark text-cream-50 font-display text-lg">
            🛡
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-forest-700/60">
              Privacy Shield
            </div>
            <span className="font-display text-lg text-forest-800">
              Privacy Mode ON
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading your private bookings…</div>
      ) : bookings.length === 0 ? (
        <div className="card text-forest-700/80">
          You have no bookings yet. Head to the resources page to make your first booking.
        </div>
      ) : (
        <div className="grid gap-3">
          {bookings.map((b) => {
            const r = resources.get(String(b.resourceId));
            const commitmentStr = b.id.toString();
            return (
              <div key={commitmentStr} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-forest-800">
                      {r?.name ?? `Resource #${String(b.resourceId)}`}
                    </span>
                    <span className="chip border-forest-200 bg-forest-50 text-forest-700">
                      Private Booking
                    </span>
                  </div>
                  <div className="text-xs text-forest-700/60 mt-1 font-mono break-all">
                    Commitment: {commitmentStr.slice(0, 10)}...{commitmentStr.slice(-8)}
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  {!claimedMap[commitmentStr] ? (
                    <button
                      onClick={() => claim(b.id)}
                      disabled={busyId === commitmentStr}
                      className="btn-primary"
                    >
                      {busyId === commitmentStr ? "Claiming…" : "Claim Reputation via ZKP"}
                    </button>
                  ) : (
                    <span className="chip">Reputation claimed ✓</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

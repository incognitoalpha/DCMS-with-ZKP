"use client";

import { useEffect, useState, useCallback } from "react";
import { Contract } from "ethers";
import { useWallet } from "@/lib/wallet";
import { fmtEth, fmtTime, toLocalInput, fromLocalInput, parseRevert } from "@/lib/format";
import { toast } from "@/components/Toast";
import { generateRandomSecret, generateBookingProof, formatProofForContract } from "@/lib/zkp";

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

const BOOKING_VERIFIER_ABI = [
  {
    type: "function",
    stateMutability: "view",
    name: "verifyProof",
    inputs: [
      { name: "_pA", type: "uint256[2]" },
      { name: "_pB", type: "uint256[2][2]" },
      { name: "_pC", type: "uint256[2]" },
      { name: "_pubSignals", type: "uint256[5]" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export default function ResourcesPage() {
  const { contract, address, connect } = useWallet();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Resource | null>(null);

  const load = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const list: Resource[] = await contract.getAllResources();
      setResources(list);
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
          <p className="text-forest-700/70">Pick a resource and book a time slot securely.</p>
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
  onBook,
}: {
  r: Resource;
  onBook: () => void;
}) {
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
      
      <div className="mt-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-forest-700/60">Per hour</div>
          <div className="font-display text-lg text-forest-800">
            {fmtEth(r.pricePerHour)}
          </div>
        </div>
        <button disabled={!r.active} onClick={onBook} className="btn-primary">
          Book Private
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

  const startTs = fromLocalInput(start);
  const endTs = fromLocalInput(end);
  const validRange = endTs > startTs;
  const hours = validRange ? Math.ceil((endTs - startTs) / 3600) : 0;
  
  const cost = resource.pricePerHour * BigInt(hours);

  async function submit() {
    if (!contract) return;
    if (!validRange) {
      toast("End must be after start", "error");
      return;
    }
    setBusy(true);
    try {
      toast("Generating ZK Proof for private booking...");
      const secret = generateRandomSecret();
      const nonce = BigInt(Math.floor(Math.random() * 1000000));
      const proof = await generateBookingProof(secret, resource.id, BigInt(startTs), BigInt(endTs), nonce);
      const [a, b, c] = formatProofForContract(proof);
      const commitment = proof.publicSignals[0];
      const nullifier = proof.publicSignals[1];
      const publicInputs = [commitment, nullifier, resource.id, BigInt(startTs), BigInt(endTs)] as const;

      const verifierAddress = await contract.bookingVerifier();
      const verifier = new Contract(verifierAddress, BOOKING_VERIFIER_ABI, contract.runner);
      const proofValid = await verifier.verifyProof(a, b, c, publicInputs);
      if (!proofValid) {
        throw new Error("Generated booking proof does not match the deployed verifier");
      }

      await contract.bookResource.staticCall(
        commitment,
        nullifier,
        resource.id,
        startTs,
        endTs,
        a,
        b,
        c,
        { value: cost }
      );

      let gasLimit: bigint | undefined;
      try {
        const estimatedGas = await contract.bookResource.estimateGas(
          commitment,
          nullifier,
          resource.id,
          startTs,
          endTs,
          a,
          b,
          c,
          { value: cost }
        );
        gasLimit = (estimatedGas * 12n) / 10n;
      } catch {
        gasLimit = 1_500_000n;
      }

      const tx = await contract.bookResource(
        commitment,
        nullifier,
        resource.id,
        startTs,
        endTs,
        a,
        b,
        c,
        { value: cost, gasLimit }
      );
      toast("Booking submitted, waiting for confirmation…");
      await tx.wait();
      
      // Save secret for claiming reputation later
      if (typeof window !== "undefined") {
         const existing = JSON.parse(localStorage.getItem("dcms_bookings") || "{}");
         existing[commitment.toString()] = {
           secret: secret.toString(),
           resourceId: resource.id.toString(),
           startTime: String(startTs),
           endTime: String(endTs),
           nonce: nonce.toString(),
         };
         localStorage.setItem("dcms_bookings", JSON.stringify(existing));
      }

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
              Private Booking
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
          <div className="flex justify-between font-medium">
            <span>Total cost</span>
            <span className="font-mono">
              {hours > 0 ? `${(Number(cost) / 1e18).toFixed(6)} ETH` : "—"}
            </span>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost">
            Cancel
          </button>
          <button onClick={submit} disabled={busy || !validRange} className="btn-primary">
            {busy ? "Generating ZKP…" : "Confirm booking"}
          </button>
        </div>
      </div>
    </div>
  );
}

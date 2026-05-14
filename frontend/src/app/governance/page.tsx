"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet, shortAddr } from "@/lib/wallet";
import { fmtTime, parseRevert } from "@/lib/format";
import { toast } from "@/components/Toast";
import { hasStoredIdentity, generateVotingNullifier, getZKPIdentity } from "@/lib/zkp";
import { createSemaphoreIdentity } from "@/lib/semaphore";

type Proposal = {
  id: bigint;
  description: string;
  yesVotes: bigint;
  noVotes: bigint;
  deadline: bigint;
  executed: boolean;
  proposer: string;
};

export default function GovernancePage() {
  const { contract, address, connect } = useWallet();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [voted, setVoted] = useState<Record<string, boolean>>({});
  const [desc, setDesc] = useState("");
  const [days, setDays] = useState(3);
  const [hasZKP, setHasZKP] = useState(false);
  const [zkpVoting, setZkpVoting] = useState(false);

  // Check ZKP identity on load
  useEffect(() => {
    setHasZKP(hasStoredIdentity());
  }, []);

  const load = useCallback(async () => {
    if (!contract) return;
    setLoading(true);
    try {
      const list: Proposal[] = await contract.getAllProposals();
      const sorted = [...list].sort((a, b) => Number(b.id) - Number(a.id));
      setProposals(sorted);
      if (address) {
        const flags: Record<string, boolean> = {};
        await Promise.all(
          sorted.map(async (p) => {
            try {
              flags[String(p.id)] = await contract.hasVoted(p.id, address);
            } catch {
              flags[String(p.id)] = false;
            }
          })
        );
        setVoted(flags);
      }
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setLoading(false);
    }
  }, [contract, address]);

  useEffect(() => {
    load();
  }, [load]);

  async function createProposal() {
    if (!contract) return;
    if (desc.trim().length === 0) {
      toast("Description required", "error");
      return;
    }
    setBusy(true);
    try {
      const seconds = Math.max(60, days * 24 * 3600);
      const tx = await contract.createProposal(desc.trim(), seconds);
      toast("Proposal submitted…");
      await tx.wait();
      toast("Proposal created ✓", "success");
      setDesc("");
      load();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function vote(id: bigint, support: boolean) {
    if (!contract) return;
    setActionId(String(id));
    try {
      const tx = await contract.vote(id, support);
      toast("Voting…");
      await tx.wait();
      toast(`Voted ${support ? "yes" : "no"} ✓`, "success");
      load();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setActionId(null);
    }
  }

  async function execute(id: bigint) {
    if (!contract) return;
    setActionId(String(id));
    try {
      const tx = await contract.executeProposal(id);
      toast("Executing…");
      await tx.wait();
      toast("Executed ✓", "success");
      load();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setActionId(null);
    }
  }

  if (!address) {
    return (
      <div className="card text-center">
        <h2 className="font-display text-2xl text-forest-800">Connect to participate</h2>
        <button onClick={connect} className="btn-primary mt-4">
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-forest-800">Governance</h1>
        <p className="text-forest-700/70">
          Propose changes to the cottage. One wallet, one vote — recorded on-chain.
        </p>
      </div>

      {/* ZKP Identity Registration Section */}
      {!hasZKP && address && (
        <div className="card border-forest-300 space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🛡</span>
            <div className="font-display text-xl text-forest-800">Enable Anonymous Voting</div>
          </div>
          <p className="text-forest-700/80 text-sm">
            Register a Zero-Knowledge identity to vote anonymously. Your wallet address will never be recorded.
          </p>
          <button
            onClick={() => {
              createSemaphoreIdentity();
              setHasZKP(true);
              toast("ZKP Identity created! You can now vote anonymously.", "success");
            }}
            className="btn-primary"
          >
            Generate Anonymous Identity
          </button>
        </div>
      )}

      {/* ZKP Voting Toggle */}
      {hasZKP && (
        <div className="card flex items-center justify-between border-forest-300">
          <div className="flex items-center gap-2">
            <span className="text-xl">🛡</span>
            <span className="font-display text-forest-800">Privacy Shield Active</span>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={zkpVoting}
              onChange={(e) => setZkpVoting(e.target.checked)}
              className="sr-only"
            />
            <span className={`chip ${zkpVoting ? "bg-forest-100 text-forest-700" : ""}`}>
              {zkpVoting ? "Anonymous Mode ON" : "Use Regular Mode"}
            </span>
          </label>
        </div>
      )}

      <div className="card space-y-3">
        <div className="font-display text-xl text-forest-800">New proposal</div>
        <textarea
          rows={3}
          placeholder="e.g. Add a hot tub to the lakeside deck"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          className="input"
        />
        <div className="flex flex-wrap items-center gap-3">
          <label className="label">Voting period (days)</label>
          <input
            type="number"
            min={1}
            max={30}
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value || "1"))}
            className="input w-24"
          />
          <div className="flex-1" />
          <button onClick={createProposal} disabled={busy} className="btn-primary">
            {busy ? "Submitting…" : "Submit proposal"}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="card">Loading proposals…</div>
      ) : proposals.length === 0 ? (
        <div className="card text-forest-700/80">No proposals yet. Be the first.</div>
      ) : (
        <div className="grid gap-3">
          {proposals.map((p) => {
            const closed = Number(p.deadline) * 1000 < Date.now();
            const yes = Number(p.yesVotes);
            const no = Number(p.noVotes);
            const total = yes + no;
            const yesPct = total > 0 ? Math.round((yes / total) * 100) : 0;
            const passed = yes > no;
            return (
              <div key={String(p.id)} className="card space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs uppercase tracking-wide text-forest-700/60">
                      Proposal #{String(p.id)} · by {shortAddr(p.proposer)}
                    </div>
                    <div className="font-display text-lg text-forest-800">{p.description}</div>
                  </div>
                  <span
                    className={
                      p.executed
                        ? passed
                          ? "chip bg-forest-100 text-forest-700"
                          : "chip border-red-200 bg-red-50 text-red-700"
                        : closed
                        ? "chip bg-wood-400/20 text-wood-700"
                        : "chip"
                    }
                  >
                    {p.executed
                      ? passed
                        ? "passed"
                        : "rejected"
                      : closed
                      ? "ready to execute"
                      : `closes ${fmtTime(p.deadline)}`}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-xs text-forest-700/70">
                    <span>Yes · {yes}</span>
                    <span>No · {no}</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-cream-100">
                    <div
                      className="h-full bg-forest-500 transition-all"
                      style={{ width: `${yesPct}%` }}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {!closed && !voted[String(p.id)] && (
                    <>
                      <button
                        onClick={() => vote(p.id, true)}
                        disabled={actionId === String(p.id)}
                        className="btn-primary"
                      >
                        Vote yes
                      </button>
                      <button
                        onClick={() => vote(p.id, false)}
                        disabled={actionId === String(p.id)}
                        className="btn-secondary"
                      >
                        Vote no
                      </button>
                    </>
                  )}
                  {voted[String(p.id)] && <span className="chip">you have voted</span>}
                  {closed && !p.executed && (
                    <button
                      onClick={() => execute(p.id)}
                      disabled={actionId === String(p.id)}
                      className="btn-secondary"
                    >
                      Execute result
                    </button>
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

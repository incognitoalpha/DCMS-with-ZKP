"use client";

import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@/lib/wallet";
import { fmtEth, parseRevert } from "@/lib/format";
import { toast } from "@/components/Toast";
import { parseEther } from "ethers";

type Resource = {
  id: bigint;
  name: string;
  description: string;
  pricePerHour: bigint;
  active: boolean;
};

export default function AdminPage() {
  const { contract, address, adminAddress, isAdmin, connect } = useWallet();
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [priceEth, setPriceEth] = useState("0.01");
  const [busy, setBusy] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

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

  async function add() {
    if (!contract) return;
    if (!name.trim()) {
      toast("Name required", "error");
      return;
    }
    setBusy(true);
    try {
      const wei = parseEther(priceEth || "0");
      const tx = await contract.addResource(name.trim(), description.trim(), wei);
      toast("Submitting resource…");
      await tx.wait();
      toast("Resource added ✓", "success");
      setName("");
      setDescription("");
      load();
    } catch (err) {
      toast(parseRevert(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(r: Resource) {
    if (!contract) return;
    setActionId(String(r.id));
    try {
      const tx = await contract.setResourceActive(r.id, !r.active);
      await tx.wait();
      toast(`Resource ${r.active ? "deactivated" : "activated"} ✓`, "success");
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
        <h2 className="font-display text-2xl text-forest-800">Connect first</h2>
        <button onClick={connect} className="btn-primary mt-4">
          Connect wallet
        </button>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="card text-center">
        <h2 className="font-display text-2xl text-forest-800">Admins only</h2>
        <p className="mt-2 text-forest-700/70">
          The admin is the wallet that deployed the contract. You are signed in as a regular user.
        </p>
        <div className="mt-4 space-y-1 text-sm text-forest-700/80">
          <div>Connected wallet: <span className="font-mono">{address ?? "not connected"}</span></div>
          <div>Contract admin: <span className="font-mono">{adminAddress ?? "unavailable"}</span></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-forest-800">Admin</h1>
        <p className="text-forest-700/70">Add new resources or toggle availability.</p>
      </div>

      <div className="card space-y-3">
        <div className="font-display text-xl text-forest-800">Add resource</div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="label">Name</label>
            <input
              className="input mt-1"
              placeholder="Lakeview Cabin"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Price per hour (ETH)</label>
            <input
              type="number"
              step="0.0001"
              className="input mt-1"
              value={priceEth}
              onChange={(e) => setPriceEth(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className="label">Description</label>
            <textarea
              rows={2}
              className="input mt-1"
              placeholder="Cozy two-bed cabin facing the lake."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={add} disabled={busy} className="btn-primary">
            {busy ? "Submitting…" : "Add resource"}
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="font-display text-xl text-forest-800">Existing resources</div>
        {loading ? (
          <div className="card">Loading…</div>
        ) : resources.length === 0 ? (
          <div className="card text-forest-700/80">No resources yet.</div>
        ) : (
          <div className="grid gap-3">
            {resources.map((r) => (
              <div key={String(r.id)} className="card flex flex-wrap items-center gap-4">
                <div className="flex-1 min-w-[220px]">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-lg text-forest-800">{r.name}</span>
                    <span
                      className={
                        r.active ? "chip" : "chip border-red-200 bg-red-50 text-red-700"
                      }
                    >
                      {r.active ? "active" : "inactive"}
                    </span>
                    <span className="text-xs text-forest-700/60">#{String(r.id)}</span>
                  </div>
                  <div className="text-sm text-forest-700/70 mt-1">{r.description}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs uppercase tracking-wide text-forest-700/60">
                    Per hour
                  </div>
                  <div className="font-display text-lg text-forest-800">
                    {fmtEth(r.pricePerHour)}
                  </div>
                </div>
                <button
                  onClick={() => toggle(r)}
                  disabled={actionId === String(r.id)}
                  className="btn-secondary"
                >
                  {actionId === String(r.id)
                    ? "Working…"
                    : r.active
                    ? "Deactivate"
                    : "Activate"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

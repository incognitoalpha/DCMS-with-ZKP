"use client";

import { useEffect, useState } from "react";
import { useWallet, shortAddr } from "@/lib/wallet";
import { fmtTime } from "@/lib/format";

type FeedItem = {
  key: string;
  ts: number;
  kind: "booking" | "cancel" | "proposal" | "vote" | "executed" | "resource" | "reputation" | "identity";
  title: string;
  detail: string;
  txHash?: string;
};

export default function ActivityPage() {
  const { contract, provider, address, connect } = useWallet();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (!contract || !provider) return;
    let cancelled = false;

    async function backfill() {
      if (!contract || !provider) return;
      const latest = await provider.getBlockNumber();
      const fromBlock = Math.max(0, latest - 5000);
      try {
        const [created, cancelled_, props, votes, executed, added, rep, idents] = await Promise.all([
          contract.queryFilter(contract.filters.BookingCreated(), fromBlock),
          contract.queryFilter(contract.filters.BookingCancelled(), fromBlock),
          contract.queryFilter(contract.filters.ProposalCreated(), fromBlock),
          contract.queryFilter(contract.filters.Voted(), fromBlock),
          contract.queryFilter(contract.filters.ProposalExecuted(), fromBlock),
          contract.queryFilter(contract.filters.ResourceAdded(), fromBlock),
          contract.queryFilter(contract.filters.ReputationClaimed(), fromBlock),
          contract.queryFilter(contract.filters.IdentityRegistered(), fromBlock),
        ]);

        const collected: FeedItem[] = [];
        for (const e of created) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [commitment, , resourceId] = a as [bigint, bigint, bigint];
          collected.push({
            key: `bk-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "booking",
            title: `Private Booking on resource #${resourceId}`,
            detail: `Commitment: ${commitment.toString().slice(0, 10)}...`,
            txHash: e.transactionHash,
          });
        }
        for (const e of cancelled_) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [id, user] = a as [bigint, string];
          collected.push({
            key: `cn-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "cancel",
            title: `Booking #${id} cancelled`,
            detail: `${shortAddr(user)} got refunded`,
            txHash: e.transactionHash,
          });
        }
        for (const e of props) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [id, proposer, description] = a as [bigint, string, string];
          collected.push({
            key: `pr-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "proposal",
            title: `Proposal #${id} created`,
            detail: `${shortAddr(proposer)}: "${description}"`,
            txHash: e.transactionHash,
          });
        }
        for (const e of votes) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [pid, , support] = a as [bigint, string, boolean];
          collected.push({
            key: `vt-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "vote",
            title: `Vote on proposal #${pid}`,
            detail: `Anonymous user voted ${support ? "yes" : "no"}`,
            txHash: e.transactionHash,
          });
        }
        for (const e of executed) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [id, passed] = a as [bigint, boolean];
          collected.push({
            key: `ex-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "executed",
            title: `Proposal #${id} executed`,
            detail: passed ? "Passed" : "Rejected",
            txHash: e.transactionHash,
          });
        }
        for (const e of added) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [id, name] = a as [bigint, string];
          collected.push({
            key: `rs-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "resource",
            title: `Resource #${id} added`,
            detail: name,
            txHash: e.transactionHash,
          });
        }
        for (const e of rep) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [user, commitment] = a as [string, bigint];
          collected.push({
            key: `rp-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "reputation",
            title: `Reputation Claimed`,
            detail: `${shortAddr(user)} claimed with proof ${commitment.toString().slice(0, 10)}...`,
            txHash: e.transactionHash,
          });
        }
        for (const e of idents) {
          const blk = await e.getBlock();
          const a = (e as unknown as { args: unknown[] }).args;
          const [user, commitment, index] = a as [string, bigint, bigint];
          collected.push({
            key: `id-${e.transactionHash}-${e.index}`,
            ts: Number(blk.timestamp),
            kind: "identity",
            title: `ZKP Identity Registered`,
            detail: `${shortAddr(user)} added commitment #${index}`,
            txHash: e.transactionHash,
          });
        }
        if (cancelled) return;
        collected.sort((a, b) => b.ts - a.ts);
        setItems(collected.slice(0, 100));
      } catch {
        /* silent */
      }
    }

    backfill();

    // Live listeners
    const onBookingCreated = (...args: unknown[]) => {
      const [commitment, nullifier, resourceId] = args as [bigint, bigint, bigint];
      setItems((prev) => prependItem(prev, {
        key: `bk-${Date.now()}-${commitment}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "booking",
        title: `Private Booking on resource #${resourceId}`,
        detail: `Commitment: ${commitment.toString().slice(0, 10)}...`,
      }));
    };
    const onBookingCancelled = (...args: unknown[]) => {
      const [id, user] = args as [bigint, string, unknown];
      setItems((prev) => prependItem(prev, {
        key: `cn-${Date.now()}-${id}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "cancel",
        title: `Booking #${id} cancelled`,
        detail: `${shortAddr(user)} got refunded`,
      }));
    };
    const onProposalCreated = (...args: unknown[]) => {
      const [id, proposer, description] = args as [bigint, string, string, bigint, unknown];
      setItems((prev) => prependItem(prev, {
        key: `pr-${Date.now()}-${id}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "proposal",
        title: `Proposal #${id} created`,
        detail: `${shortAddr(proposer)}: "${description}"`,
      }));
    };
    const onVoted = (...args: unknown[]) => {
      const [pid, , support] = args as [bigint, string, boolean, unknown];
      setItems((prev) => prependItem(prev, {
        key: `vt-${Date.now()}-${pid}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "vote",
        title: `Vote on proposal #${pid}`,
        detail: `Anonymous user voted ${support ? "yes" : "no"}`,
      }));
    };
    const onResourceAdded = (...args: unknown[]) => {
      const [id, name] = args as [bigint, string, bigint, unknown];
      setItems((prev) => prependItem(prev, {
        key: `rs-${Date.now()}-${id}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "resource",
        title: `Resource #${id} added`,
        detail: name,
      }));
    };
    const onReputation = (...args: unknown[]) => {
      const [user, commitment] = args as [string, bigint, unknown];
      setItems((prev) => prependItem(prev, {
        key: `rp-${Date.now()}-${user}-${commitment}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "reputation",
        title: `Reputation Claimed`,
        detail: `${shortAddr(user)} claimed with proof ${commitment.toString().slice(0, 10)}...`,
      }));
    };
    const onIdentity = (...args: unknown[]) => {
      const [user, commitment, index] = args as [string, bigint, bigint, unknown];
      setItems((prev) => prependItem(prev, {
        key: `id-${Date.now()}-${user}-${commitment}`,
        ts: Math.floor(Date.now() / 1000),
        kind: "identity",
        title: `ZKP Identity Registered`,
        detail: `${shortAddr(user)} added commitment #${index}`,
      }));
    };

    contract.on("BookingCreated", onBookingCreated);
    contract.on("BookingCancelled", onBookingCancelled);
    contract.on("ProposalCreated", onProposalCreated);
    contract.on("Voted", onVoted);
    contract.on("ResourceAdded", onResourceAdded);
    contract.on("ReputationClaimed", onReputation);
    contract.on("IdentityRegistered", onIdentity);
    setLive(true);

    return () => {
      contract.off("BookingCreated", onBookingCreated);
      contract.off("BookingCancelled", onBookingCancelled);
      contract.off("ProposalCreated", onProposalCreated);
      contract.off("Voted", onVoted);
      contract.off("ResourceAdded", onResourceAdded);
      contract.off("ReputationClaimed", onReputation);
      contract.off("IdentityRegistered", onIdentity);
      setLive(false);
    };
  }, [contract, provider]);

  if (!address) {
    return (
      <div className="card text-center">
        <h2 className="font-display text-2xl text-forest-800">Connect to view activity</h2>
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
          <h1 className="font-display text-3xl text-forest-800">Live activity</h1>
          <p className="text-forest-700/70">Streaming events directly from the chain.</p>
        </div>
        <span
          className={`chip ${
            live
              ? "bg-forest-500/15 text-forest-700 border-forest-500/30"
              : "bg-cream-100 text-forest-700/60"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              live ? "bg-forest-500 animate-pulse" : "bg-forest-700/30"
            }`}
          />
          {live ? "LIVE" : "idle"}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="card text-forest-700/80">
          No activity yet. Make a booking, propose a vote, or add a resource — events
          will appear here in real time.
        </div>
      ) : (
        <ol className="relative border-l-2 border-cream-200 pl-6 space-y-4">
          {items.map((it) => (
            <li key={it.key} className="card">
              <div className="absolute -left-[9px] mt-2 h-4 w-4 rounded-full bg-forest-500 ring-4 ring-cream-50" />
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="font-display text-lg text-forest-800">{it.title}</div>
                <div className="font-mono text-xs text-forest-700/60">{fmtTime(it.ts)}</div>
              </div>
              <div className="text-sm text-forest-700/80 mt-1">{it.detail}</div>
              <div className="mt-2 flex gap-2">
                <span className="chip">{it.kind}</span>
                {it.txHash && (
                  <span className="chip font-mono text-[10px]">
                    tx {it.txHash.slice(0, 10)}…
                  </span>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function prependItem(prev: FeedItem[], next: FeedItem): FeedItem[] {
  if (prev.some((p) => p.key === next.key)) return prev;
  return [next, ...prev].slice(0, 100);
}

import { formatEther } from "ethers";

export function fmtEth(weiBigInt: bigint | string | number): string {
  try {
    return `${formatEther(BigInt(weiBigInt))} ETH`;
  } catch {
    return "—";
  }
}

export function fmtTime(unixSeconds: bigint | number): string {
  const ms = Number(unixSeconds) * 1000;
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleString();
}

export function toLocalInput(unixSeconds?: number): string {
  const d = unixSeconds ? new Date(unixSeconds * 1000) : new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(value: string): number {
  return Math.floor(new Date(value).getTime() / 1000);
}

export function parseRevert(err: unknown): string {
  const e = err as { shortMessage?: string; reason?: string; message?: string; info?: { error?: { message?: string } } };
  return (
    e?.shortMessage ||
    e?.reason ||
    e?.info?.error?.message ||
    e?.message ||
    "Transaction failed"
  );
}

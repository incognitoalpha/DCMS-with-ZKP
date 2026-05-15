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
  const messages = collectErrorMessages(err);
  const revert = messages.find((message) => /execution reverted|reverted with reason string/i.test(message));
  const readable = revert ? extractRevertReason(revert) : messages.find(Boolean);
  return readable || "Transaction failed";
}

function collectErrorMessages(value: unknown, seen = new Set<unknown>()): string[] {
  if (!value || seen.has(value)) return [];
  if (typeof value === "string") return [value];
  if (typeof value !== "object") return [];

  seen.add(value);
  const record = value as Record<string, unknown>;
  const messages: string[] = [];

  for (const key of ["shortMessage", "reason", "message"] as const) {
    if (typeof record[key] === "string") {
      messages.push(record[key]);
    }
  }

  for (const key of ["error", "info", "data", "body", "payload"] as const) {
    messages.push(...collectErrorMessages(record[key], seen));
  }

  return messages;
}

function extractRevertReason(message: string): string {
  const reasonString = message.match(/reverted with reason string ['"]([^'"]+)['"]/i);
  if (reasonString?.[1]) return reasonString[1];

  const executionReverted = message.match(/execution reverted:?\s*([^,\n]*)/i);
  if (executionReverted?.[1]) return executionReverted[1].replace(/^['"]|['"]$/g, "").trim();

  return message;
}

"use client";

import { useEffect, useState } from "react";

type Tone = "info" | "success" | "error";

let setterRef: ((msg: { tone: Tone; text: string } | null) => void) | null = null;

export function toast(text: string, tone: Tone = "info") {
  setterRef?.({ tone, text });
}

export default function Toast() {
  const [msg, setMsg] = useState<{ tone: Tone; text: string } | null>(null);

  useEffect(() => {
    setterRef = setMsg;
    return () => {
      setterRef = null;
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), msg.tone === "error" ? 6000 : 3500);
    return () => clearTimeout(t);
  }, [msg]);

  if (!msg) return null;

  const tone =
    msg.tone === "success"
      ? "bg-forest-600 text-cream-50"
      : msg.tone === "error"
      ? "bg-red-600 text-white"
      : "bg-wood-600 text-cream-50";

  return (
    <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2">
      <div className={`rounded-full px-5 py-2.5 shadow-soft ${tone}`}>{msg.text}</div>
    </div>
  );
}

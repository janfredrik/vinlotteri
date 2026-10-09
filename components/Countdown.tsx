"use client";

import { useEffect, useState } from "react";

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function formatLeft(ms: number): string {
  if (ms <= 0) return "0:00";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}t`;
  if (h > 0) return `${h}t ${m}m`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function Countdown({ target, now }: { target: string; now: number }) {
  const left = new Date(target).getTime() - now;
  return <span>{formatLeft(left)}</span>;
}

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

// Pip positions on a 3×3 grid (0–8, row-major) for each die face.
const FACES: Record<number, number[]> = {
  1: [4],
  2: [2, 6],
  3: [2, 4, 6],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export function Die({ face, className = "h-5 w-5" }: { face: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
      <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
      {FACES[face].map((p) => (
        <circle key={p} cx={7 + (p % 3) * 5} cy={7 + Math.floor(p / 3) * 5} r="1.55" fill="currentColor" />
      ))}
    </svg>
  );
}

/** Die-shaped button in the round header that opens the rules. Each open is a fresh roll. */
export default function RulesButton({ children, connected }: { children: ReactNode; connected: boolean }) {
  const [open, setOpen] = useState(false);
  const [face, setFace] = useState(5);
  const [roll, setRoll] = useState(0);
  const [offline, setOffline] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // The poll fallback keeps the grid fresh anyway, so only mention the live link when it has
  // been down for a while, not during the normal connect on page load.
  useEffect(() => {
    if (connected) {
      setOffline(false);
      return;
    }
    const t = setTimeout(() => setOffline(true), 6000);
    return () => clearTimeout(t);
  }, [connected]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open) {
      setFace((f) => {
        const n = 1 + Math.floor(Math.random() * 5);
        return n >= f ? n + 1 : n; // always land on a different face
      });
      setRoll((r) => r + 1);
    }
    setOpen((o) => !o);
  };

  return (
    <div ref={wrap} className="relative flex shrink-0 flex-col-reverse items-end gap-1.5 sm:flex-row sm:items-center sm:gap-2">
      <div role="status" className="contents">
        {offline && (
          <button
            type="button"
            onClick={() => window.location.reload()}
            aria-label="Frakoblet – last inn siden på nytt"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-plum/15 px-2.5 text-xs text-plum/75 sm:h-10 sm:px-3 sm:text-sm transition-colors hover:border-plum/30 hover:bg-plum/5 hover:text-plum"
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-plum/40" />
            Frakoblet
            <span aria-hidden="true" className="hidden text-plum/50 sm:inline">
              · Last inn på nytt
            </span>
            <svg viewBox="0 0 24 24" aria-hidden="true" className="h-3.5 w-3.5 sm:hidden">
              <path
                d="M20 12a8 8 0 1 1-2.34-5.66M20 4v4.5h-4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className={`inline-flex h-10 items-center gap-1.5 rounded-full border pl-2.5 pr-3.5 text-sm font-medium transition-colors ${
          open
            ? "border-wine bg-wine text-cream"
            : "border-wine/20 text-wine hover:border-wine/40 hover:bg-wine/5"
        }`}
      >
        <span key={roll} className={roll ? "rules-die-roll" : undefined}>
          <Die face={face} />
        </span>
        Regler
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Regler"
          className="rules-panel absolute right-0 top-full z-40 mt-2 w-[min(19rem,calc(100vw-2rem))] rounded-2xl bg-cream p-4 shadow-[0_12px_32px_-8px_rgba(44,10,20,0.28),0_2px_6px_rgba(44,10,20,0.08)] ring-1 ring-plum/10"
        >
          <h2 className="font-display text-lg font-semibold text-wine">Regler</h2>
          {children}
        </div>
      )}
    </div>
  );
}

"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";

type Phase = "idle" | "busy" | "wrong" | "ok";

// The bowl's inside runs from the rim (y=16) down to the stem (y=100).
const RIM = 16;
const BOTTOM = 100;

/** How full the glass is: each digit pours a bit more, easing off so a long PIN never spills. */
function fillFor(len: number, phase: Phase) {
  if (phase === "ok") return 0.9;
  if (phase === "wrong") return 0;
  return 0.78 * (1 - Math.pow(0.68, len));
}

/** A drawn wine glass whose level follows the PIN. */
function Glass({ fill, phase }: { fill: number; phase: Phase }) {
  const level = BOTTOM - fill * (BOTTOM - RIM);
  return (
    <svg viewBox="0 0 120 172" className={`pin-glass h-44 w-auto ${phase === "ok" ? "pin-glass-cheer" : ""}`} aria-hidden>
      <defs>
        <clipPath id="pin-bowl">
          <path d="M24 16 C 21 52, 31 94, 60 100 C 89 94, 99 52, 96 16 Z" />
        </clipPath>
      </defs>

      <g clipPath="url(#pin-bowl)">
        <rect x="0" y="0" width="120" height="110" className="fill-white/70" />
        <g className="pin-wine" style={{ transform: `translateY(${level}px)` }}>
          {/* Two waves out of phase give the surface a slow swirl. */}
          <path
            className="pin-wave pin-wave-back fill-wine-dark/55"
            d="M-120 0 Q -105 -4 -90 0 T -60 0 T -30 0 T 0 0 T 30 0 T 60 0 T 90 0 T 120 0 T 150 0 T 180 0 T 210 0 T 240 0 V 120 H -120 Z"
          />
          <path
            className="pin-wave fill-wine"
            d="M-120 1 Q -105 5 -90 1 T -60 1 T -30 1 T 0 1 T 30 1 T 60 1 T 90 1 T 120 1 T 150 1 T 180 1 T 210 1 T 240 1 V 120 H -120 Z"
          />
        </g>
      </g>

      {/* Glass: bowl, a highlight along the left curve, stem and foot. */}
      <path
        d="M24 16 C 21 52, 31 94, 60 100 C 89 94, 99 52, 96 16"
        className="fill-none stroke-plum/35"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path d="M24 16 H 96" className="stroke-plum/20" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M32 28 C 31 50, 36 70, 46 82" className="fill-none stroke-white/80" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 100 V 152" className="stroke-plum/35" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M34 158 C 40 152, 80 152, 86 158" className="fill-none stroke-plum/35" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

function UnlockForm() {
  const params = useSearchParams();
  // Reject protocol-relative ("//evil.com") and absolute URLs — only same-site paths.
  const raw = params.get("next") || "/";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
  const [pin, setPin] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [tries, setTries] = useState(0);
  const input = useRef<HTMLInputElement>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || phase === "busy" || phase === "ok") return;
    setPhase("busy");
    const r = await fetch("/api/access", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    }).catch(() => null);
    if (r?.ok) {
      setPhase("ok");
      // Let the glass fill and clink before leaving. Hard navigation: guarantees the
      // just-set vl_access cookie is sent on a fresh document + RSC load. A soft
      // router.replace()+refresh() here races the cookie write.
      const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      setTimeout(() => window.location.assign(next), calm ? 0 : 750);
    } else {
      setPhase("wrong");
      setTries((t) => t + 1);
      setPin("");
    }
  }

  // The input is disabled while checking, so refocus once it's live again.
  useEffect(() => {
    if (phase === "wrong") input.current?.focus();
  }, [phase, tries]);

  const busy = phase === "busy" || phase === "ok";

  return (
    <form onSubmit={submit} className="mx-auto flex max-w-xs flex-col items-center pt-10 text-center sm:pt-20">
      <div key={tries} className={tries > 0 ? "animate-nope" : ""}>
        <Glass fill={fillFor(pin.length, phase)} phase={phase} />
      </div>

      <h1 className="mt-6 font-display text-3xl font-semibold text-wine">Vinlotteri</h1>
      <p className="mt-2 text-pretty text-sm text-plum/70">Skriv inn PIN-en for å komme inn.</p>

      {/* The real input sits invisibly on top of the squares, so typing, pasting and
          password managers all work as normal. */}
      <label className="pin-slots group relative mt-7 flex min-h-12 w-full cursor-text flex-wrap items-center justify-center gap-2 rounded-xl px-3 py-2">
        <span className="sr-only">PIN</span>
        <input
          ref={input}
          type="password"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value);
            if (phase === "wrong") setPhase("idle");
          }}
          autoFocus
          inputMode="numeric"
          autoComplete="current-password"
          enterKeyHint="go"
          disabled={busy}
          aria-invalid={phase === "wrong"}
          aria-describedby="pin-status"
          className="absolute inset-0 size-full cursor-text opacity-0"
        />
        {Array.from(pin, (_, i) => (
          <span
            key={i}
            aria-hidden
            className="pin-square size-8 rounded-md border border-wine-dark bg-wine shadow-[inset_0_1px_0_rgba(255,255,255,0.16),0_3px_6px_-3px_rgba(44,10,20,0.45)]"
          />
        ))}
        {!busy && (
          <span
            aria-hidden
            className="cell-blocked relative size-8 rounded-md border border-dashed border-plum/25 transition-colors group-focus-within:border-wine/60"
          >
            <span className="pin-caret absolute inset-y-2 left-1/2 hidden w-0.5 -translate-x-1/2 rounded-full bg-wine group-focus-within:block" />
          </span>
        )}
      </label>

      <p id="pin-status" role="status" className="mt-3 min-h-5 text-sm">
        {phase === "wrong" && <span className="text-wine">Feil PIN. Glasset er tømt, prøv igjen.</span>}
        {phase === "ok" && <span className="font-display italic text-wine">Lykke til!</span>}
      </p>

      <button
        disabled={busy || !pin}
        className={`mt-4 w-full rounded-lg bg-wine py-2.5 font-semibold text-cream transition-colors hover:bg-wine-dark disabled:cursor-not-allowed ${phase === "ok" ? "" : "disabled:bg-wine/45"}`}
      >
        {phase === "busy" ? "Sjekker…" : phase === "ok" ? "Velkommen" : "Kom inn"}
      </button>
    </form>
  );
}

export default function ApnePage() {
  return (
    <Suspense fallback={<p className="mt-16 text-center text-sm text-plum/60">Laster…</p>}>
      <UnlockForm />
    </Suspense>
  );
}

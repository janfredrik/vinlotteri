"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Prize } from "@/lib/types";
import { vinmonopoletImage } from "@/lib/vinmonopolet";

const prizeLabel = (p: Prize) => p.name || `Varenr. ${p.varenummer ?? "?"}`;

const EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Buyers rank the prizes up front, so a win while they're away (in a meeting, say) doesn't hold
 *  up the draw: the organiser hands them their top wish that is still left. Saved on every tap. */
export function WishList({
  prizes,
  saved,
  onSave,
}: {
  prizes: Prize[];
  /** What the server has; the draft follows it until the buyer starts tapping. */
  saved: number[];
  onSave: (prizeIds: number[]) => Promise<void>;
}) {
  const [order, setOrder] = useState<number[]>(saved);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  // Bumped on every successful save so the "Lagret" badge replays its entrance.
  const [saves, setSaves] = useState(0);
  const savedKey = saved.join(",");
  // FLIP: where each row sat before a tap, and which row the tap moved, so the reorder can glide.
  const rows = useRef(new Map<number, HTMLLIElement>());
  const before = useRef<Map<number, number> | null>(null);
  const tapped = useRef<number | null>(null);

  useEffect(() => {
    if (status === "idle") setOrder(savedKey ? savedKey.split(",").map(Number) : []);
  }, [savedKey, status]);

  async function save(next: number[], moved: number | null = null) {
    before.current = new Map([...rows.current].map(([id, el]) => [id, el.getBoundingClientRect().top]));
    tapped.current = moved;
    setOrder(next);
    setStatus("saving");
    setError(null);
    try {
      await onSave(next);
      setStatus("saved");
      setSaves((n) => n + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke lagre.");
      setStatus("error");
    }
  }

  const toggle = (id: number) => save(order.includes(id) ? order.filter((x) => x !== id) : [...order, id], id);
  // Prizes deleted after the wish was made just drop out.
  const ranked = order.filter((id) => prizes.some((p) => p.id === id));
  // Wishes float to the top in wish order; the rest keep the organiser's order below them.
  const listed = [
    ...ranked.map((id) => prizes.find((p) => p.id === id)!),
    ...prizes.filter((p) => !ranked.includes(p.id)),
  ];
  const listedKey = listed.map((p) => p.id).join(",");

  useLayoutEffect(() => {
    const prev = before.current;
    const moved = tapped.current;
    before.current = null;
    tapped.current = null;
    if (!prev) return;
    const still = reducedMotion();
    for (const [id, el] of rows.current) {
      const dy = (prev.get(id) ?? 0) - el.getBoundingClientRect().top;
      const badge = id === moved ? el.querySelector<HTMLElement>("[data-badge]") : null;
      if (badge && badge.textContent)
        badge.animate([{ transform: "scale(0.4)", opacity: 0 }, { transform: "scale(1)", opacity: 1 }], {
          duration: still ? 150 : 320,
          delay: still ? 0 : 180,
          easing: EASE_OUT,
          fill: "backwards",
        });
      if (still || Math.abs(dy) < 1) continue;
      // The row you tapped lifts above the others while it travels; the rest just make room.
      const lift = id === moved;
      el.style.position = "relative";
      el.style.zIndex = lift ? "2" : "1";
      el.animate(
        lift
          ? [
              { transform: `translateY(${dy}px) scale(1)`, boxShadow: "0 0 0 rgba(44,10,20,0)" },
              { transform: `translateY(${dy * 0.45}px) scale(1.025)`, boxShadow: "0 14px 28px -12px rgba(44,10,20,0.35)", offset: 0.45 },
              { transform: "none", boxShadow: "0 0 0 rgba(44,10,20,0)" },
            ]
          : [{ transform: `translateY(${dy}px)` }, { transform: "none" }],
        { duration: lift ? 480 : 380, easing: EASE_OUT },
      ).onfinish = () => {
        el.style.position = "";
        el.style.zIndex = "";
      };
    }
  }, [listedKey]);
  const summary = ranked.length
    ? ranked.map((id, i) => `${i + 1}. ${prizeLabel(prizes.find((p) => p.id === id)!)}`).join(" · ")
    : "Ikke til stede på trekningen? Meld hvilke premier du helst vil ha.";

  return (
    <details className="group rounded-xl border border-plum/10 bg-white shadow-sm">
      <summary className="flex cursor-pointer list-none items-center gap-3 rounded-xl px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="font-display text-lg font-semibold text-plum">Ønskeliste</span>
            <SaveBadge status={status} count={ranked.length} saves={saves} />
          </span>
          <span className="block truncate text-sm text-plum/70 group-open:hidden">{summary}</span>
        </span>
        <span className="shrink-0 text-sm font-medium text-wine group-open:hidden">
          {ranked.length ? "Endre" : "Lag liste"}
        </span>
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.75}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-5 w-5 shrink-0 text-plum/60 transition-transform duration-200 ease-out group-open:rotate-180"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </summary>

      <div className="border-t border-plum/10 px-4 pb-4 pt-3">
        <p className="text-sm text-plum/70">
          Trykk på premiene i den rekkefølgen du helst vil ha dem. Vinner du, får du det øverste ønsket som fortsatt er ledig.
          Gjelder rutene kjøpt på denne enheten.
        </p>
        <ul className="mt-3 space-y-1.5">
          {listed.map((p) => {
            const place = ranked.indexOf(p.id) + 1;
            const src = p.image_url || vinmonopoletImage(p.varenummer);
            return (
              <li
                key={p.id}
                // Solid underlay: the row's tinted fill is translucent, and a lifted row passes over others.
                className="rounded-lg bg-white"
                ref={(el) => {
                  if (el) rows.current.set(p.id, el);
                  else rows.current.delete(p.id);
                }}
              >
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-pressed={place > 0}
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm text-plum transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine ${
                    place ? "border-wine/40 bg-gold-soft/40" : "border-plum/15 bg-cream hover:border-wine/50"
                  }`}
                >
                  <span
                    data-badge
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                      place ? "bg-wine text-cream" : "border border-dashed border-plum/30"
                    }`}
                  >
                    {place || null}
                  </span>
                  <span className="flex h-11 w-8 shrink-0 items-center justify-center">
                    {src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={src} alt="" className="h-full w-auto object-contain" />
                    ) : (
                      <span aria-hidden="true" className="text-xl">🍾</span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 font-medium leading-tight">{prizeLabel(p)}</span>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-plum/10 pt-3 text-sm">
          <p aria-live="polite" className={status === "error" ? "font-medium text-wine" : "text-plum/70"}>
            {status === "saving" ? (
              "Lagrer …"
            ) : status === "error" ? (
              <>Ikke lagret: {error} Trykk på en premie for å prøve igjen.</>
            ) : ranked.length ? (
              <span className="inline-flex items-center gap-1.5 font-medium text-sage">
                <CheckIcon className="h-4 w-4" />
                {ranked.length === 1 ? "Ønsket ditt er lagret" : `${ranked.length} ønsker er lagret`}
              </span>
            ) : (
              "Ingen ønsker lagret ennå."
            )}
          </p>
          {ranked.length > 0 && (
            <button type="button" onClick={() => save([])} className="font-medium text-wine underline underline-offset-4">
              Nullstill ønskene
            </button>
          )}
        </div>
      </div>
    </details>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="m4.5 10.5 3.5 3.5 7.5-8" />
    </svg>
  );
}

/** Next to the heading, open or closed: whether the list on screen is what the organiser will see. */
function SaveBadge({ status, count, saves }: { status: "idle" | "saving" | "saved" | "error"; count: number; saves: number }) {
  const base = "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold";
  if (status === "saving") return <span className={`${base} bg-parchment text-plum/70`}>Lagrer …</span>;
  if (status === "error") return <span className={`${base} bg-wine/10 text-wine`}>Ikke lagret</span>;
  if (!count) return null;
  return (
    <span key={saves} className={`${base} bg-sage/12 text-sage ${saves ? "animate-reveal" : ""}`}>
      <CheckIcon className="h-3.5 w-3.5" />
      Lagret
    </span>
  );
}

/** You won while you were away and were skipped: pick from what is left, right here. */
export function PickYourPrize({
  rank,
  winner,
  prizes,
  onChoose,
}: {
  rank: number;
  /** Set when you're choosing for someone else (a square you bought for them on this device). */
  winner?: string | null;
  prizes: Prize[];
  onChoose: (prizeId: number) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(id: number) {
    setBusy(true);
    setError(null);
    try {
      await onChoose(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Noe gikk galt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-gold bg-gradient-to-br from-gold-soft/70 to-cream p-4 shadow-sm">
      <h2 className="font-display text-2xl font-semibold text-wine">
        {winner ? `${winner} vant! 🎉` : "Du vant! 🎉"}
      </h2>
      <p className="mt-1 text-sm text-plum/80">
        {winner
          ? `${winner} ble trukket som ${rank}. vinner, men var ikke til stede. Du kjøpte ruta, så du kan velge premie for ${winner} blant de som er igjen.`
          : `Du ble trukket som ${rank}. vinner mens du var borte. Velg premien du vil ha blant de som er igjen.`}
      </p>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {prizes.map((p) => {
          const src = p.image_url || vinmonopoletImage(p.varenummer);
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={busy}
                onClick={() => choose(p.id)}
                className="flex h-full w-full flex-col items-center gap-2 rounded-lg border border-plum/20 bg-white p-3 text-center text-sm text-plum transition-colors hover:border-wine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine disabled:opacity-60"
              >
                <span className="flex h-16 w-12 items-center justify-center">
                  {src ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={src} alt="" className="h-full w-auto object-contain" />
                  ) : (
                    <span aria-hidden="true" className="text-2xl">🍾</span>
                  )}
                </span>
                <span className="font-medium leading-tight">{prizeLabel(p)}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {error && <p className="mt-2 text-sm text-wine">{error}</p>}
    </section>
  );
}

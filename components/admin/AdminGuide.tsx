"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { weekdayTime } from "@/lib/datetime";
import type { RoundStatus } from "@/lib/types";
import { Die } from "@/components/RulesButton";
import { Crown } from "@/components/Grid";
import { IconAlert, IconArrowRight, IconCheck, btn } from "./ui";

const SEEN_KEY = "vinlotteri:arrangor-veiviser";

/**
 * Opens the guide by itself the first time someone visits the organiser pages, and lets
 * "Slik funker det" bring it back. Seen-state lives in this browser only, which is fine:
 * the worst case is seeing it once more on a new device.
 */
export function useAdminGuide() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true);
    } catch {
      /* storage blocked: don't nag */
    }
  }, []);
  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);
  return { open, show: useCallback(() => setOpen(true), []), close };
}

/** The bits of the round the guide can show or fill in. */
export interface GuideRound {
  id: number;
  status: RoundStatus;
  title: string;
  organizer: string;
  vipps: string;
  salesCloseAt: string | null;
  liftsAt?: string | null;
}

const STEPS = ["Vipps", "Premier", "Salg", "Trekning", "Oppgjør"] as const;

/**
 * First-run walkthrough of the organiser's week. It teaches only what needs a decision or a
 * habit (Vippsnummer, pasting prizes, ticking payments, entering the dice, checking the money)
 * and says plainly what can be left alone.
 */
export default function AdminGuide({
  open,
  onClose,
  round,
}: {
  open: boolean;
  onClose: () => void;
  round?: GuideRound | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setStep(0);
      d.showModal();
      heading.current?.focus();
    } else if (!open && d.open) d.close();
  }, [open]);

  const go = (n: number) => {
    setStep(n);
    requestAnimationFrame(() => heading.current?.focus());
  };

  const next = () => (step < STEPS.length - 1 ? go(step + 1) : onClose());

  const last = step === STEPS.length - 1;

  return (
    <dialog
      ref={ref}
      aria-labelledby="veiviser-tittel"
      onClose={onClose}
      className="mx-auto mb-4 mt-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg animate-pop overflow-y-auto rounded-2xl bg-cream p-0 text-plum shadow-[0_20px_50px_-12px_rgba(44,10,20,0.45)] backdrop:bg-plum/40 sm:my-auto"
    >
      {open && (
        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-6">
            <p className="text-sm text-plum/70">Slik arrangerer du vinlotteriet</p>
            <button type="button" onClick={onClose} className={`${btn.quiet} -mr-2`}>
              Hopp over
            </button>
          </div>

          <ol className="mt-3 grid grid-cols-5 gap-1.5 px-5 sm:px-6" aria-label="Steg i veiviseren">
            {STEPS.map((s, i) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => go(i)}
                  aria-current={i === step ? "step" : undefined}
                  className="group flex w-full flex-col gap-1.5 rounded-md pb-1 text-left"
                >
                  <span
                    className={`h-1 w-full rounded-full transition-colors duration-300 ${
                      i < step ? "bg-wine/45" : i === step ? "bg-wine" : "bg-plum/12"
                    }`}
                  />
                  <span
                    className={`truncate text-xs ${i === step ? "font-semibold text-wine" : "text-plum/70 group-hover:text-wine"}`}
                  >
                    {s}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div key={step} className="guide-step px-5 pb-2 pt-5 sm:min-h-[25rem] sm:px-6">
            {step === 0 && (
              <Step
                headingRef={heading}
                title="Hvor skal pengene?"
                lead="Mangler Vippsnummeret, fyller du det inn under «Forbered». Det er det eneste salget venter på."
              >
                <TypedNumber number="95123456" />

                <div className="mt-6">
                  <h3 className="text-sm font-semibold text-plum">Resten kan stå som det er</h3>
                  <ul className="mt-2 divide-y divide-plum/[0.07] rounded-lg bg-white text-sm">
                    {[
                      ["Tittel", round?.title || "Settes av seg selv"],
                      ["Salget stenger", round?.salesCloseAt ? weekdayTime(round.salesCloseAt) : "Satt opp på forhånd"],
                      ["Maks-grensen oppheves", round?.liftsAt ? weekdayTime(round.liftsAt) : "30 min før stenging"],
                      ["Flere valg", "Fylt ut fra før"],
                    ].map(([label, value], i) => (
                      <Preset key={label} label={label} value={value} delay={1500 + i * 170} />
                    ))}
                  </ul>
                </div>
              </Step>
            )}

            {step === 1 && (
              <Step
                headingRef={heading}
                title="Lim inn premien, resten fyller seg ut"
                lead="Kopier lenken til varen på vinmonopolet.no og lim den inn under «Premier». Navn, pris, volum og bilde hentes av seg selv."
              >
                <PasteDemo />
                <p className="mt-3 text-sm text-plum/80">
                  Varenummeret virker også, alternativt skjermbilde
                </p>
                <div className="mt-5 rounded-xl bg-gold-soft/45 px-4 py-3 text-sm">
                  <p className="font-semibold text-plum">Kost regnes ut av seg selv</p>
                  <p className="mt-0.5 text-plum/85">
                    Kost på polet er summen av premieprisene, så du slipper å taste inn kvitteringen. Ble den noe annet,
                    skriver du riktig beløp under «Flere valg».
                  </p>
                </div>
              </Step>
            )}

            {step === 2 && (
              <Step
                headingRef={heading}
                title="Salget går av seg selv"
                lead="Folk kjøper ruter selv fra forsiden og vippser deg."
              >
                <SalesDemo />
                <p className="mt-4 text-sm text-plum/80">
                  Under «Salg» viser <strong className="font-semibold text-plum">Mangler</strong> hvem som ikke har trykket
                  betalt. Har de vippset deg, markerer du dem som betalt selv.
                </p>
              </Step>
            )}

            {step === 3 && (
              <Step
                headingRef={heading}
                title="Terningene bestemmer"
                lead="Trekningen skjer fysisk. Du legger inn hva terningene viste, og hvilken premie vinneren valgte."
              >
                <DrawDemo />
                <ol className="mt-5 space-y-2.5 text-sm">
                  <Numbered n={1}>Første terning er kolonne, andre er rad. Trykk dem inn.</Numbered>
                  <Numbered n={2}>Vinneren velger blant premiene som er igjen. Trykk inn valget.</Numbered>
                  <Numbered n={3}>Gjenta til alle premiene er delt ut.</Numbered>
                </ol>
                <p className="mt-4 text-sm text-plum/70">
                  Tom rute, eller rute alt vunnet? Kast på nytt. Uten terninger kan du trekke
                  digitalt.
                </p>
              </Step>
            )}

            {step === 4 && (
              <Step
                headingRef={heading}
                title="Oppgjøret er regnet ut"
                lead="Når premiene er delt ut, står regnskapet klart. Det eneste du må se over, er betalingene."
              >
                <ul className="space-y-2 rounded-xl bg-white px-4 py-3 text-sm">
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold-soft text-plum">
                      <IconAlert className="h-3 w-3" />
                    </span>
                    <span>
                      <span className="font-semibold">Mangler noen betaling?</span>{" "}
                      <span className="text-plum/80">
                        Noen har vippset, men glemt å trykke. Andre har glemt å vippse. Sjekk Vipps-appen og marker eller
                        purr.
                      </span>
                    </span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage text-white">
                      <IconCheck className="h-3 w-3" />
                    </span>
                    <span>
                      <span className="font-semibold">Gjør opp runden.</span>{" "}
                      <span className="text-plum/80">Pengene som går videre, er regnet ut for deg.</span>
                    </span>
                  </li>
                </ul>

                <div className="mt-5 rounded-xl bg-wine px-4 py-4 text-cream">
                  <p className="font-display text-lg font-semibold">Stafettpinnen går videre</p>
                  <p className="mt-1 text-sm text-cream/85">
                    Den som ble trukket først, arrangerer neste runde, og står allerede fylt ut. Trykk «Start neste runde» og
                    vipps dem pengene som går videre. Ferdig for denne gang.
                  </p>
                </div>
              </Step>
            )}
          </div>

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t border-plum/10 bg-cream px-5 py-4 sm:px-6">
            {step > 0 ? (
              <button type="button" onClick={() => go(step - 1)} className={btn.quiet}>
                Tilbake
              </button>
            ) : (
              <span />
            )}
            <button type="button" onClick={next} className={btn.primary}>
              {last ? "Sett i gang" : "Neste"}
              {!last && <IconArrowRight />}
            </button>
            {last && (
              <p className="basis-full text-xs text-plum/70">
                Veiviseren finner du igjen under «Slik funker det» øverst på arrangørsiden.
              </p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

const input = "mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base font-normal sm:text-sm";

function Step({
  title,
  lead,
  headingRef,
  children,
}: {
  title: string;
  lead: ReactNode;
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  children: ReactNode;
}) {
  return (
    <>
      <h2
        id="veiviser-tittel"
        ref={headingRef}
        tabIndex={-1}
        className="font-display text-2xl font-semibold text-balance text-wine outline-none"
      >
        {title}
      </h2>
      <p className="mt-1.5 max-w-prose text-pretty text-plum/80">{lead}</p>
      <div className="mt-5">{children}</div>
    </>
  );
}

/** One "already set" line: its check ticks in after the number above has been typed. */
function Preset({ label, value, delay }: { label: string; value: string; delay: number }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <span
        style={{ animationDelay: `${delay}ms` }}
        className="guide-tick flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border text-white"
      >
        <IconCheck className="h-3 w-3" />
      </span>
      <span className="text-plum/85">{label}</span>
      <span className="ml-auto text-right text-plum/60 first-letter:uppercase">{value}</span>
    </li>
  );
}

/**
 * A clock for the little demos: milliseconds since mount, looping or stopping at `total`.
 * With reduced motion it sits still at `rest`, the frame that tells the whole story.
 */
function useClock(total: number, { loop = false, rest = total }: { loop?: boolean; rest?: number } = {}) {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setT(rest);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const e = Math.max(0, now - start); // the frame timestamp can predate start
      if (!loop && e >= total) return setT(total);
      setT(Math.floor((loop ? e % total : e) / 40) * 40);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [total, loop, rest]);
  return t;
}

/** The Vippsnummer being typed in, then ticked off. */
function TypedNumber({ number }: { number: string }) {
  const start = 350;
  const per = 85;
  const t = useClock(start + number.length * per + 200);
  const shown = Math.max(0, Math.min(number.length, Math.floor((t - start) / per)));
  const done = shown === number.length && t >= start + number.length * per + 150;
  return (
    <div>
      <span className="text-sm font-medium text-plum">Vippsnummer</span>
      <div
        className={`mt-1 flex items-center rounded-lg border bg-white px-3 py-2.5 text-base tabular-nums transition-[border-color,box-shadow] duration-300 ${
          done ? "border-sage/60 shadow-[0_0_0_3px_rgba(76,107,82,0.12)]" : "border-wine/50 shadow-[0_0_0_3px_rgba(123,30,59,0.1)]"
        }`}
      >
        <span aria-hidden="true" className="tracking-wide text-plum">
          {number.slice(0, shown)}
        </span>
        {!done && <span aria-hidden="true" className="guide-caret ml-px h-5 w-[1.5px] bg-wine" />}
        <span className="sr-only">{number}</span>
        <span
          className={`ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-sage text-white transition-[opacity,transform] duration-300 ${
            done ? "scale-100 opacity-100" : "scale-50 opacity-0"
          }`}
        >
          <IconCheck className="h-3 w-3" />
        </span>
      </div>
    </div>
  );
}

/** A pasted link turning into a filled-in prize: the fields light up one by one. */
function PasteDemo() {
  const fields = ["Navn", "Pris", "Volum", "Bilde"];
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="flex min-w-0 items-center gap-2 rounded-lg border border-plum/15 bg-white px-3 py-2 text-sm sm:w-48 sm:shrink-0">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true" className="h-4 w-4 shrink-0 text-plum/60">
          <path d="M8.5 11.5a3 3 0 0 0 4.2 0l2.6-2.6a3 3 0 0 0-4.2-4.2l-.9.9M11.5 8.5a3 3 0 0 0-4.2 0l-2.6 2.6a3 3 0 0 0 4.2 4.2l.9-.9" />
        </svg>
        <span className="truncate text-plum/80">vinmonopolet.no/p/…</span>
      </div>
      <IconArrowRight className="hidden h-5 w-5 shrink-0 text-plum/50 sm:block" />
      <ul className="grid flex-1 grid-cols-2 gap-1.5" aria-label="Feltene som fylles ut">
        {fields.map((f, i) => (
          <li
            key={f}
            style={{ animationDelay: `${350 + i * 220}ms` }}
            className="guide-fill flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-sm"
          >
            <span>{f}</span>
            <IconCheck className="guide-fill-check h-3.5 w-3.5 text-sage" />
          </li>
        ))}
      </ul>
    </div>
  );
}

type DemoCell = { name: string; state: "held" | "sold" };

// Several people buying at once: squares get reserved, then turn wine-red as people press
// "Jeg har betalt". Per never presses, so the round ends with one square in «Mangler».
const SALES_SCRIPT: { at: number; who: string; cells: string[]; state: DemoCell["state"]; say: string }[] = [
  { at: 500, who: "Kari", cells: ["2-1"], state: "held", say: "Kari velger 2-1" },
  { at: 950, who: "Ola", cells: ["5-2"], state: "held", say: "Ola velger 5-2" },
  { at: 1350, who: "Kari", cells: ["3-1"], state: "held", say: "Kari velger 3-1 også" },
  { at: 1900, who: "Siri", cells: ["1-3"], state: "held", say: "Siri velger 1-3" },
  { at: 2600, who: "Kari", cells: ["2-1", "3-1"], state: "sold", say: "Kari trykket betalt" },
  { at: 3200, who: "Ola", cells: ["5-2"], state: "sold", say: "Ola trykket betalt" },
  { at: 3800, who: "Per", cells: ["4-3"], state: "held", say: "Per velger 4-3" },
  { at: 4400, who: "Siri", cells: ["1-3"], state: "sold", say: "Siri trykket betalt" },
  { at: 5000, who: "Mia", cells: ["6-1"], state: "held", say: "Mia velger 6-1" },
  { at: 5700, who: "Mia", cells: ["6-1"], state: "sold", say: "Mia trykket betalt" },
  { at: 6500, who: "Per", cells: [], state: "held", say: "Per har ikke trykket betalt" },
];

function SalesDemo() {
  const t = useClock(10_000, { loop: true, rest: 9_000 });
  const cells = new Map<string, DemoCell>();
  let say = "Salget er åpent";
  for (const e of SALES_SCRIPT) {
    if (e.at > t) break;
    for (const c of e.cells) cells.set(c, { name: e.who, state: e.state });
    say = e.say;
  }
  const sold = [...cells.values()].filter((c) => c.state === "sold").length;
  const owing = cells.size - sold;

  return (
    <div className="rounded-xl bg-parchment/70 p-3 sm:p-4">
      <div className="grid grid-cols-6 gap-1 sm:gap-1.5" aria-hidden="true">
        {[1, 2, 3].flatMap((row) =>
          [1, 2, 3, 4, 5, 6].map((col) => {
            const id = `${col}-${row}`;
            const c = cells.get(id);
            return (
              <span
                key={id}
                className={`flex aspect-[5/4] items-center justify-center overflow-hidden rounded-md border text-[11px] transition-colors duration-300 sm:text-xs ${
                  !c
                    ? "border-plum/10 bg-white text-plum/40"
                    : c.state === "held"
                      ? "cell-held border-gold/70 font-semibold text-plum"
                      : "border-wine-dark bg-wine font-semibold text-cream"
                }`}
              >
                <span key={c ? `${c.name}${c.state}` : "free"} className={c ? "animate-pop" : "font-display tabular-nums"}>
                  {c ? c.name : id}
                </span>
              </span>
            );
          }),
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
        <span key={say} className="guide-say font-medium text-plum" aria-hidden="true">
          {say}
        </span>
        <span className="tabular-nums text-plum/75" aria-hidden="true">
          {sold} betalt · <span className={owing ? "font-semibold text-wine" : undefined}>{owing} mangler</span>
        </span>
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-plum/10 pt-3 text-xs text-plum/80">
        <li className="flex items-center gap-1.5">
          <span className="h-3.5 w-3.5 rounded-[4px] border border-wine-dark bg-wine" /> Betalt
        </li>
        <li className="flex items-center gap-1.5">
          <span className="cell-held h-3.5 w-3.5 rounded-[4px] border border-gold/70" /> Kjøpt rute, ikke trykket betalt
        </li>
      </ul>
    </div>
  );
}

// Squares nobody bought in the draw demo; everything else is sold.
const DRAW_EMPTY = new Set(["1-2", "4-5", "6-6", "2-4", "3-6"]);

/** Two dice tumble, land on 5 and 3, and the grid narrows to column 5, row 3, then the winner. */
function DrawDemo() {
  const t = useClock(7_500, { loop: true, rest: 4_000 });
  const rolling = t < 1_400;
  const phase = rolling ? 0 : t < 1_900 ? 1 : t < 2_500 ? 2 : t < 3_100 ? 3 : 4;
  const spin = Math.floor(t / 110);
  const col = rolling ? 1 + ((spin * 5 + 2) % 6) : 5;
  const row = rolling ? 1 + ((spin * 7 + 4) % 6) : 3;
  const say = rolling ? "Kaster …" : phase < 4 ? `Kolonne 5, rad 3` : "Rute 5-3: Kari vinner!";

  const lit = (c: number, r: number) =>
    phase < 2 ? true : phase === 2 ? c === 5 : phase === 3 ? c === 5 || r === 3 : c === 5 && r === 3;

  return (
    <div className="flex flex-col items-center gap-4 rounded-xl bg-parchment/70 p-4 sm:flex-row sm:items-center sm:gap-6" aria-hidden="true">
      <div className="flex shrink-0 flex-col items-center gap-3 sm:w-36">
        <div className="flex gap-3">
          {[
            { face: col, label: "Kolonne" },
            { face: row, label: "Rad" },
          ].map((d, i) => (
            <span key={d.label} className="flex flex-col items-center gap-1.5">
              <span
                key={rolling ? "roll" : "land"}
                style={{ animationDelay: rolling ? `${i * -90}ms` : `${i * 70}ms` }}
                className={`flex h-14 w-14 items-center justify-center rounded-xl bg-white text-wine shadow-[0_3px_8px_-2px_rgba(44,10,20,0.25)] ${
                  rolling ? "guide-die-tumble" : "guide-die-land"
                }`}
              >
                <Die face={d.face} className="h-11 w-11" />
              </span>
              <span className="text-xs text-plum/70">{d.label}</span>
            </span>
          ))}
        </div>
        <span key={say} className={`guide-say text-center text-sm font-semibold ${phase === 4 ? "text-wine" : "text-plum"}`}>
          {say}
        </span>
      </div>

      <div className="grid w-full max-w-[15rem] grid-cols-[auto_repeat(6,minmax(0,1fr))] gap-1">
        <span />
        {[1, 2, 3, 4, 5, 6].map((c) => (
          <span
            key={c}
            className={`text-center font-display text-[11px] font-semibold tabular-nums transition-colors duration-300 ${
              phase >= 2 && c === 5 ? "text-wine" : "text-wine/45"
            }`}
          >
            {c}
          </span>
        ))}
        {[1, 2, 3, 4, 5, 6].map((r) => (
          <div key={r} className="contents">
            <span
              className={`flex items-center pr-0.5 font-display text-[11px] font-semibold tabular-nums transition-colors duration-300 ${
                phase >= 3 && r === 3 ? "text-wine" : "text-wine/45"
              }`}
            >
              {r}
            </span>
            {[1, 2, 3, 4, 5, 6].map((c) => {
              const id = `${c}-${r}`;
              const win = phase === 4 && c === 5 && r === 3;
              return (
                <span
                  key={id}
                  className={`relative flex aspect-square items-center justify-center rounded-[4px] border transition-[opacity,transform,box-shadow] duration-300 ${
                    DRAW_EMPTY.has(id) ? "border-plum/10 bg-white" : "border-wine-dark bg-wine"
                  } ${lit(c, r) ? "opacity-100" : "opacity-25"} ${win ? "z-10 scale-[1.35] animate-winner-glow" : ""}`}
                >
                  {win && (
                    <>
                      <Crown className="guide-crown absolute -top-2.5 left-1/2 h-2.5 w-3.5 -translate-x-1/2 text-gold" />
                      <span className="text-[8px] font-semibold leading-none text-cream">Kari</span>
                    </>
                  )}
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function Numbered({ n, children }: { n: number; children: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-wine/10 font-display text-xs font-semibold tabular-nums text-wine">
        {n}
      </span>
      <span className="text-plum/90">{children}</span>
    </li>
  );
}

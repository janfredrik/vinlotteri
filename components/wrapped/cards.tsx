"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Crown } from "@/components/Grid";
import { MeSquare } from "@/components/MeSquare";
import { MeButton } from "@/components/MeButton";
import { TITLES, joinNames, type Leader, type PersonWrap, type SquareTally, type YearWrap } from "@/lib/wrapped-shared";

export type Tone = "plum" | "wine" | "red";

const NUM = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
const n = (v: number) => NUM.format(v);
const kr = (v: number) => `${v < 0 ? "−" : ""}${NUM.format(Math.abs(v))} kr`;
const times = (v: number) => (v === 1 ? "én gang" : `${n(v)} ganger`);
const plural = (v: number, one: string, many: string) => `${n(v)} ${v === 1 ? one : many}`;

/** Counts up to `value` when the card opens; shows the number straight away with reduced motion. */
function useCount(value: number, active: boolean): number {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!active || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let raf = 0;
    const start = performance.now();
    const dur = Math.min(1400, 500 + value * 4);
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur);
      setShown(Math.round(value * (1 - Math.pow(1 - k, 4))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    setShown(0);
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, active]);
  return shown;
}

function Count({ value, active }: { value: number; active: boolean }) {
  const shown = useCount(value, active);
  return (
    <span className="wr-num" aria-label={n(value)}>
      <span aria-hidden="true">{n(shown)}</span>
    </span>
  );
}

/** Staggered entry for the parts of a card, in reading order. */
function Rise({ i = 0, className = "", children }: { i?: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={`wr-rise ${className}`} style={{ "--i": i } as React.CSSProperties}>
      {children}
    </div>
  );
}

/** "Ola" -> "Olas", "Nils" -> "Nils'". */
function genitive(name: string): string {
  return /[sxz]$/i.test(name) ? `${name}'` : `${name}s`;
}

function names(l: Leader): string {
  return joinNames(l.names);
}

/* ------------------------------------------------------------------ grid --- */

/**
 * The 6×6 board drawn from the year's numbers, in the same square language as the buying grid.
 * Shown column-row like everywhere else; `mark` rings one square.
 */
function Board({
  size,
  squares,
  value,
  mark,
  label,
}: {
  size: number;
  squares: SquareTally[];
  value: (s: SquareTally) => number;
  mark?: { row: number; col: number } | null;
  label: string;
}) {
  const at = new Map(squares.map((s) => [`${s.row},${s.col}`, s]));
  const top = Math.max(1, ...squares.map(value));
  const idx = Array.from({ length: size }, (_, i) => i + 1);
  return (
    <figure aria-label={label} className="mx-auto w-full max-w-[min(100%,76cqmin,50cqh)]">
      <div className="grid gap-[1.1cqmin]" style={{ gridTemplateColumns: `1.2em repeat(${size}, minmax(0, 1fr))` }}>
        <span />
        {idx.map((c) => (
          <span key={`c${c}`} className="wr-small wr-soft text-center wr-num">
            {c}
          </span>
        ))}
        {idx.map((r) => (
          <Row key={r} r={r} idx={idx} at={at} top={top} value={value} mark={mark} />
        ))}
      </div>
    </figure>
  );
}

function Row({
  r,
  idx,
  at,
  top,
  value,
  mark,
}: {
  r: number;
  idx: number[];
  at: Map<string, SquareTally>;
  top: number;
  value: (s: SquareTally) => number;
  mark?: { row: number; col: number } | null;
}) {
  return (
    <>
      <span className="wr-small wr-soft self-center wr-num">{r}</span>
      {idx.map((c) => {
        const s = at.get(`${r},${c}`);
        const v = s ? value(s) : 0;
        const t = v / top;
        const marked = mark && mark.row === r && mark.col === c;
        return (
          <span
            key={c}
            className={`relative aspect-square rounded-[0.9cqmin] ${marked ? "outline outline-[0.7cqmin] outline-offset-[0.5cqmin] outline-[var(--wr-ink)]" : ""}`}
            style={{
              backgroundColor:
                v > 0
                  ? `color-mix(in srgb, var(--wr-print) ${Math.round(22 + t * 78)}%, transparent)`
                  : "color-mix(in srgb, var(--wr-ink) 8%, transparent)",
            }}
          >
            {marked && (
              <Crown className="absolute left-1/2 top-1/2 h-[42%] w-[56%] -translate-x-1/2 -translate-y-1/2 text-[var(--wr-ink)]" />
            )}
          </span>
        );
      })}
    </>
  );
}

/** The tasting note that closes each card: one line in the label's italic serif. */
function Note({ i = 4, children }: { i?: number; children: React.ReactNode }) {
  return (
    <Rise i={i} className="mt-[5cqmin]">
      <p className="wr-note wr-print">{children}</p>
    </Rise>
  );
}

/** A small diamond between the names in the organiser relay. */
function Baton() {
  return (
    <svg viewBox="0 0 8 8" aria-hidden="true" className="wr-print mx-[1.6cqmin] inline h-[0.42em] w-[0.42em] align-[0.12em] opacity-75">
      <path d="M4 0.6 7.4 4 4 7.4 0.6 4z" fill="currentColor" />
    </svg>
  );
}

/** The label's engraving: the 6×6 board in hairlines, with the year's best square inked in. */
function Engraving({ size, hot }: { size: number; hot: { row: number; col: number } | null }) {
  const cells = Array.from({ length: size * size }, (_, i) => ({ row: Math.floor(i / size) + 1, col: (i % size) + 1 }));
  return (
    <div aria-hidden="true" className="wr-engraving wr-print mx-auto grid w-[24cqmin] gap-[0.8cqmin]" style={{ gridTemplateColumns: `repeat(${size}, 1fr)` }}>
      {cells.map((c) => (
        <span
          key={`${c.row},${c.col}`}
          className={`aspect-square rounded-[0.4cqmin] border border-current ${hot && hot.row === c.row && hot.col === c.col ? "bg-current" : "opacity-45"}`}
        />
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- frames --- */

function Page({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`wr-pad flex h-full flex-col ${className}`}>{children}</div>;
}

/* ----------------------------------------------------------- common part --- */

export function LabelCard({ w }: { w: YearWrap }) {
  return (
    <div className="flex h-full items-center justify-center px-[7cqmin] pb-[13cqmin] pt-[17cqmin]">
      <div className="wr-label flex h-full w-full flex-col items-center justify-between px-[6cqmin] py-[9cqmin] text-center">
        <div className="wr-print">
          <p className="wr-caps">Vinlotteri</p>
          <div className="mx-auto mt-[3cqmin] flex items-center justify-center gap-[2cqmin]" aria-hidden="true">
            <span className="wr-rule w-[14cqmin]" />
            <Crown className="h-[2.6cqmin] w-[3.6cqmin]" />
            <span className="wr-rule w-[14cqmin]" />
          </div>
        </div>
        <Engraving size={w.gridSize} hot={w.hottest} />
        <div>
          <h1 className="wr-year font-display font-semibold leading-none tracking-[-0.04em] text-[clamp(4.5rem,30cqmin,15rem)]">
            {w.year}
          </h1>
          <p className="wr-note wr-print mt-[1.5cqmin]">årgang</p>
        </div>
        <div className="wr-print pt-[3cqmin]">
          <span aria-hidden="true" className="wr-rule mx-auto mb-[3cqmin] block w-[30cqmin]" />
          <p className="wr-body wr-num">
            <span className="block">
              {plural(w.rounds, "runde", "runder")} · {n(w.lodd)} lodd
            </span>
            <span className="block">{plural(w.bottles, "premie", "premier")}</span>
          </p>
          <p className="wr-small mt-[1.5cqmin] italic">Tappet på kontoret</p>
        </div>
      </div>
    </div>
  );
}

export function PeopleCard({ w, active }: { w: YearWrap; active: boolean }) {
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">Tappet av</h2>
      </Rise>
      <Rise i={1} className="my-auto py-[4cqmin]">
        <div aria-hidden="true" className="flex flex-wrap gap-[1.4cqmin]">
          {Array.from({ length: w.people }, (_, k) => (
            <span key={k} className="h-[5cqmin] w-[5cqmin] rounded-[0.8cqmin] bg-[var(--wr-print)] opacity-90" />
          ))}
        </div>
        <p className="wr-h mt-[5cqmin]">
          <span className="wr-print">
            <Count value={w.people} active={active} /> kolleger
          </span>{" "}
          kjøpte lodd i {w.year}.
        </p>
      </Rise>
      <div className="space-y-[3cqmin]">
        {w.newFaces != null && w.newFaces > 0 && (
          <Rise i={2}>
            <p className="wr-body">
              <span className="wr-print font-semibold wr-num">{n(w.newFaces)}</span> av dem var med for første gang.
            </p>
          </Rise>
        )}
        {w.regular && (
          <Rise i={3}>
            <p className="wr-body">
              Stamgjesten var <span className="font-semibold">{names(w.regular)}</span>, med i{" "}
              <span className="wr-num">{n(w.regular.value)}</span> av <span className="wr-num">{n(w.rounds)}</span> runder.
            </p>
          </Rise>
        )}
      </div>
      <Note>Bred og sosial, med {w.people} kolleger i glasset.</Note>
    </Page>
  );
}

export function CrownCard({ w }: { w: YearWrap }) {
  const crown = w.crown!;
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">Kronen gikk til</h2>
      </Rise>
      <Rise i={1} className="my-auto">
        <Crown className="wr-print mb-[3cqmin] h-[9cqmin] w-[13cqmin]" />
        <p className="wr-name">{names(crown)}</p>
        <p className="wr-body wr-soft mt-[3cqmin]">
          {crown.names.length > 1 ? "Delt førsteplass med" : "Trukket først"}{" "}
          <span className="wr-num">{times(crown.value)}</span>
          {crown.names.length > 1 ? " hver." : ", og arrangerte runden etter."}
        </p>
      </Rise>
      {w.topWinners.length > 1 && (
        <Rise i={2}>
          <h3 className="wr-body wr-print mb-[2cqmin] font-semibold">Flest gevinster</h3>
          <ol className="space-y-[1.2cqmin]">
            {w.topWinners.map((t) => (
              <li key={t.name} className="wr-body flex items-baseline justify-between gap-4 border-b border-current/15 pb-[1cqmin]">
                <span className="truncate">{t.name}</span>
                <span className="wr-num shrink-0 font-semibold">{n(t.wins)}</span>
              </li>
            ))}
          </ol>
        </Rise>
      )}
      <Note>Kongelig og selvsikker, med {times(crown.value)} ettersmak av førstepremie.</Note>
    </Page>
  );
}

export function TerroirCard({ w }: { w: YearWrap }) {
  const hot = w.hottest!;
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">
          Jordsmonnet: <span className="wr-print wr-num">rute {hot.col}-{hot.row}</span>
        </h2>
        <p className="wr-body wr-soft mt-[2cqmin]">Vant {times(hot.wins)}. Ingen rute ga mer i år.</p>
      </Rise>
      <Rise i={1} className="my-auto py-[4cqmin]">
        <Board
          size={w.gridSize}
          squares={w.squares}
          value={(s) => s.wins}
          mark={hot}
          label={`Gevinster per rute i ${w.year}. Rute ${hot.col}-${hot.row} vant flest.`}
        />
      </Rise>
      {w.coldest && (
        <Rise i={2}>
          <p className="wr-body">
            <span className="font-semibold wr-num">Rute {w.coldest.col}-{w.coldest.row}</span> ble kjøpt{" "}
            {times(w.coldest.sold)} og vant aldri.
          </p>
        </Rise>
      )}
      <Note>
        Mineralsk, med tydelig preg av rute {hot.col}-{hot.row}.
      </Note>
    </Page>
  );
}

export function RelayCard({ w }: { w: YearWrap }) {
  const top = w.topOrganizer!;
  const lead = new Set(top.names.map((x) => x.trim().toLowerCase()));
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">Stafetten</h2>
        <p className="wr-body wr-soft mt-[2cqmin]">Den som trekkes først, arrangerer neste uke. Slik gikk pinnen i år:</p>
      </Rise>
      <Rise i={1} className="my-auto py-[4cqmin]">
        <p className="wr-body leading-[1.75]">
          {w.relay.map((name, i) => (
            <span key={i}>
              <span className="whitespace-nowrap">
                <span className={lead.has(name.toLowerCase()) ? "wr-print font-semibold" : ""}>{name}</span>
                {i < w.relay.length - 1 && <Baton />}
              </span>{" "}
            </span>
          ))}
        </p>
      </Rise>
      <Rise i={2}>
        <p className="wr-body">
          <span className="font-semibold">{names(top)}</span> bar pinnen lengst, med{" "}
          <span className="wr-num">{plural(top.value, "runde", "runder")}</span>
          {top.names.length > 1 ? " hver." : "."}
        </p>
      </Rise>
      <Note>Lang og jevn, med {w.relay.length} skift underveis.</Note>
    </Page>
  );
}

export function CellarCard({ w, active }: { w: YearWrap; active: boolean }) {
  const c = w.cellar!;
  const most = Math.max(1, ...c.categories.map((x) => x.count));
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">Kjelleren</h2>
      </Rise>
      <Rise i={1} className="mt-[5cqmin]">
        <p className="wr-h">
          <span className="wr-print">
            <Count value={w.bottles} active={active} /> premier
          </span>{" "}
          gikk over bordet.
        </p>
      </Rise>
      {c.categories.length > 0 && (
        <Rise i={2} className="my-auto py-[4cqmin]">
          <ul className="space-y-[1.6cqmin]">
            {c.categories.slice(0, 6).map((cat) => (
              <li key={cat.name} className="wr-small grid grid-cols-[minmax(0,10em)_1fr_auto] items-center gap-[2.5cqmin]">
                <span className="truncate">{cat.name}</span>
                <span className="h-[2.2cqmin] rounded-full bg-current/10">
                  <span className="block h-full rounded-full bg-[var(--wr-print)]" style={{ width: `${(cat.count / most) * 100}%` }} />
                </span>
                <span className="wr-num font-semibold">{n(cat.count)}</span>
              </li>
            ))}
          </ul>
        </Rise>
      )}
      {c.priciest && (
        <Rise i={3} className={c.categories.length ? "" : "mt-auto"}>
          <p className="wr-body">
            Dyreste flaske: <span className="font-semibold">{c.priciest.name}</span> til{" "}
            <span className="wr-num">{kr(Math.round(c.priciest.price))}</span>.
          </p>
        </Rise>
      )}
      {c.categories[0] && <Note>Rik og variert, med mest {c.categories[0].name.toLowerCase()}.</Note>}
    </Page>
  );
}

export function MoneyCard({ w }: { w: YearWrap }) {
  const m = w.money;
  const rows: [string, number, boolean?][] = [
    [`Inn fra ${w.year - 1}`, m.start],
    ["Lodd solgt", m.lodd],
    ["Kost på polet", -m.polet],
  ];
  if (m.adjusted) rows.push(["Justert underveis", m.adjusted]);
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">Regnskapet går opp</h2>
        <p className="wr-body wr-soft mt-[2cqmin]">Hver krone er telt, runde for runde.</p>
      </Rise>
      <Rise i={1} className="my-auto">
        <dl className="wr-body wr-num">
          {rows.map(([label, v]) => (
            <div key={label} className="flex items-baseline gap-[2cqmin] py-[1.4cqmin]">
              <dt className="shrink-0">{label}</dt>
              <span aria-hidden="true" className="min-w-[4cqmin] flex-1 border-b border-dotted border-current/35" />
              <dd className="shrink-0 font-semibold">{v > 0 && label !== `Inn fra ${w.year - 1}` ? `+${kr(v)}` : kr(v)}</dd>
            </div>
          ))}
          <div className="mt-[2cqmin] flex items-baseline gap-[2cqmin] border-t-2 border-[var(--wr-print)] pt-[2.4cqmin]">
            <dt className="shrink-0 font-semibold">Videre til {w.year + 1}</dt>
            <span aria-hidden="true" className="flex-1" />
            <dd className="wr-print shrink-0 font-display text-[clamp(1.6rem,9cqmin,4rem)] font-semibold leading-none">{kr(m.end)}</dd>
          </div>
        </dl>
      </Rise>
      <Note>Balansert helt ned til siste krone.</Note>
    </Page>
  );
}

export function DryCard({ w }: { w: YearWrap }) {
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">Tørr finish</h2>
      </Rise>
      {w.optimist && (
        <Rise i={1} className="my-auto">
          <p className="wr-body">
            Årets evige optimist{w.optimist.names.length > 1 ? "er" : ""}:
          </p>
          <p className="wr-name wr-print mt-[2cqmin]">{names(w.optimist)}</p>
          <p className="wr-body wr-soft mt-[3cqmin]">
            <span className="wr-num">{plural(w.optimist.value, "lodd", "lodd")}</span>. Null gevinster. Respekt.
          </p>
        </Rise>
      )}
      {w.drought && (
        <Rise i={2} className={w.optimist ? "" : "my-auto"}>
          <p className="wr-body">
            Lengste tørke: <span className="font-semibold">{names(w.drought)}</span>, med{" "}
            <span className="wr-print font-semibold wr-num">{n(w.drought.value)}</span> runder på rad uten gevinst.
          </p>
        </Rise>
      )}
      <Note>Tørr og stram, med en snev av håp.</Note>
    </Page>
  );
}

/* --------------------------------------------------------- personal part --- */

export function YouCard({ p, w }: { p: PersonWrap; w: YearWrap }) {
  // Every lodd as a little square, the winning ones inked in gold: the year at a glance.
  const lodd = Array.from({ length: p.lodd }, (_, i) => i < p.wins);
  return (
    <Page>
      <Rise className="flex items-center gap-[3cqmin]">
        <MeSquare name={p.name} />
        <h2 className="wr-h">Din årgang, {p.name}</h2>
      </Rise>
      <Rise i={1} className="my-auto py-[4cqmin]">
        <div aria-hidden="true" className="flex flex-wrap gap-[1.1cqmin]">
          {lodd.map((won, k) => (
            <span
              key={k}
              className={`h-[4.6cqmin] w-[4.6cqmin] rounded-[0.7cqmin] ${won ? "bg-[var(--wr-print)]" : "border border-current/35"}`}
            />
          ))}
        </div>
      </Rise>
      <Rise i={2}>
        <p className="wr-h">
          <span className="wr-print">{plural(p.lodd, "lodd", "lodd")}</span> i {n(p.rounds)} av {n(w.rounds)} runder.
        </p>
        <p className="wr-body wr-soft mt-[3cqmin]">
          {p.wins === 0 ? (
            <>Ingen av dem vant i år. </>
          ) : (
            <>
              <span className="wr-num">{n(p.wins)}</span> av dem vant
              {p.firstPrizes > 0 && (
                <>
                  , <span className="wr-num">{plural(p.firstPrizes, "førstepremie", "førstepremier")}</span> blant dem
                </>
              )}
              .{" "}
            </>
          )}
          Du brukte <span className="wr-num">{kr(p.spent)}</span>
          {p.wonWorth != null && (
            <>
              {" "}
              og vant for <span className="wr-num">{kr(Math.round(p.wonWorth))}</span>
            </>
          )}
          , nr. <span className="wr-num">{p.loddRank}</span> av <span className="wr-num">{n(w.people)}</span> på antall lodd.
        </p>
      </Rise>
    </Page>
  );
}

export function YourSquaresCard({ p, w }: { p: PersonWrap; w: YearWrap }) {
  const lucky = p.lucky;
  return (
    <Page>
      <Rise>
        <h2 className="wr-h">
          {lucky && lucky.wins > 0 ? "Lykkeruta di" : "Favorittruta di"}:{" "}
          {lucky && (
            <span className="wr-print wr-num">
              {lucky.col}-{lucky.row}
            </span>
          )}
        </h2>
        {lucky && (
          <p className="wr-body wr-soft mt-[2cqmin]">
            {lucky.wins > 0 ? `Der vant du ${times(lucky.wins)}.` : `Kjøpt ${times(lucky.sold)}.`} Her er alle rutene dine i år.
          </p>
        )}
      </Rise>
      <Rise i={1} className="my-auto py-[4cqmin]">
        <Board
          size={w.gridSize}
          squares={p.squares}
          value={(s) => s.sold}
          mark={lucky}
          label={`Rutene du kjøpte i ${w.year}, mørkere jo oftere.`}
        />
      </Rise>
      {p.drought > 1 && (
        <Rise i={2}>
          <p className="wr-body">
            Lengste tørke: <span className="wr-num font-semibold">{n(p.drought)}</span> runder på rad uten gevinst.
          </p>
        </Rise>
      )}
    </Page>
  );
}

export function TitleCard({ p }: { p: PersonWrap }) {
  const t = TITLES[p.title];
  return (
    <div className="flex h-full items-center justify-center px-[7cqmin] pb-[10cqmin] pt-[17cqmin]">
      <div className="wr-label flex h-full w-full flex-col items-center justify-between px-[6cqmin] py-[9cqmin] text-center">
        <p className="wr-note wr-print">{genitive(p.name)} årgang</p>
        <div>
          <h2 className="wr-year wr-name wr-title">{t.name}</h2>
          <p className="wr-body mt-[3cqmin]">{t.line}</p>
        </div>
        <div>
          <div className="wr-print mx-auto mb-[3cqmin] flex items-center justify-center gap-[2cqmin]" aria-hidden="true">
            <span className="wr-rule w-[10cqmin]" />
            <Crown className="h-[2.4cqmin] w-[3.4cqmin]" />
            <span className="wr-rule w-[10cqmin]" />
          </div>
          <p className="wr-note">{p.note}</p>
        </div>
      </div>
    </div>
  );
}

export function ChooseCard({ year }: { year: number }) {
  return (
    <Page className="justify-center">
      <Rise>
        <h2 className="wr-h">Hvilken årgang er din?</h2>
        <p className="wr-body wr-soft mt-[3cqmin]">
          Velg hvem du er, så får du dine egne tall for {year}: lodd, lykkerute og din egen tittel.
        </p>
      </Rise>
      <Rise i={1} className="mt-[6cqmin]">
        <MeButton
          label="Velg hvem du er"
          className="wr-body inline-flex min-h-12 items-center gap-3 rounded-full bg-[var(--wr-print)] px-[6cqmin] py-[2.4cqmin] font-semibold text-plum shadow-[0_8px_20px_-10px_rgba(0,0,0,0.6)] transition-transform active:scale-[0.98] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wr-ink)]"
        />
      </Rise>
    </Page>
  );
}

export function SkippedCard({ name, year }: { name: string; year: number }) {
  return (
    <Page className="justify-center">
      <Rise>
        <MeSquare name={name} />
        <h2 className="wr-h mt-[4cqmin]">Du stod over i {year}, {name}</h2>
        <p className="wr-body wr-soft mt-[3cqmin]">Ingen lodd i år. Flaskene venter på deg neste år.</p>
      </Rise>
    </Page>
  );
}

export function CloseCard({ w, onRestart, big }: { w: YearWrap; onRestart: () => void; big: boolean }) {
  return (
    <div className="flex h-full items-center justify-center p-[7cqmin]">
      <div className="flex flex-col items-center text-center">
        <Crown className="wr-print h-[7cqmin] w-[10cqmin]" />
        <h2 className="wr-name mt-[4cqmin]">Skål for {w.year + 1}</h2>
        <p className="wr-body wr-soft mt-[3cqmin] max-w-[70cqmin]">
          {big ? "Takk for i år, alle sammen." : "Ta gjerne skjermbilde av årgangen din og del den i kanalen."}
        </p>
        <div className="mt-[7cqmin] flex flex-wrap items-center justify-center gap-[3cqmin]">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRestart();
            }}
            className="wr-body min-h-12 rounded-full border border-current/40 px-[5cqmin] py-[2cqmin] font-semibold transition-colors hover:border-current focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wr-print)]"
          >
            Smak en gang til
          </button>
          <Link
            href={`/historikk?ar=${w.year}`}
            onClick={(e) => e.stopPropagation()}
            className="wr-body inline-flex min-h-12 items-center rounded-full bg-[var(--wr-print)] px-[5cqmin] py-[2cqmin] font-semibold text-plum focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--wr-ink)]"
          >
            Se historikken
          </Link>
        </div>
      </div>
    </div>
  );
}

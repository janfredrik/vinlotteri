import Link from "next/link";
import { computeMoney } from "@/lib/money";
import { computeStats, getCells, getDraws, getPrizes, listRounds, personStats, type PersonStats } from "@/lib/repo";
import { readMe } from "@/lib/me-cookie";
import { normName } from "@/lib/format";
import { MeSquare, YouChip } from "./MeSquare";
import { Crown } from "./Grid";
import Receipt, { KR_INT, kr, signed } from "./Receipt";
import { prizeOfDraw } from "@/lib/phases";
import { featuredWrapped, isWrappedOpen } from "@/lib/wrapped";
import type { Draw, LotteryStats, MoneySummary, Prize, Round, SquareHeat } from "@/lib/types";

/** "Uke 36 – 2026" -> "Uke 36"; "Uke 36" -> "36" when short. */
function weekLabel(title: string, fallback: string): string {
  return title.replace(/\s*[–-]\s*\d{4}\s*$/, "").trim() || fallback;
}

function weekNumber(title: string): string | null {
  return title.match(/uke\s*(\d+)/i)?.[1] ?? null;
}

/** Placeholder prize names from the spreadsheet import ("1. premie") add nothing next to the rank. */
function prizeName(name: string | undefined): string | null {
  if (!name) return null;
  return /^\s*\d+\.?\s*premie\s*$/i.test(name) ? null : name;
}

/** Competition ranking: 11, 7, 7, 7, 6 -> 1, 2, 2, 2, 5. */
function competitionRanks(values: number[]): number[] {
  return values.map((v, i) => (i > 0 && v === values[i - 1] ? -1 : i + 1)).map((r, i, arr) => {
    let j = i;
    while (arr[j] === -1) j--;
    return arr[j];
  });
}

/** The year a round ran. created_at is either SQLite's "2026-10-09 13:16:53" or the import's ISO string. */
function roundYear(r: Round): number {
  return Number(r.created_at.slice(0, 4));
}

/** "Uke 36" within one year; the full "Uke 36 – 2025" once several years share the page. */
function roundLabel(round: Round, withYear: boolean): string {
  const fallback = `Runde ${round.id}`;
  return withYear ? round.title.trim() || fallback : weekLabel(round.title, fallback);
}

interface RoundRow {
  round: Round;
  prizes: Prize[];
  draws: Draw[];
  money: MoneySummary;
}

/** `ar` is a year, "alle", or empty for the year of the latest drawn round. */
export default async function HistoryPage({ ar }: { ar?: string }) {
  const me = await readMe();
  const rounds = listRounds();
  const allDone = rounds.filter((r) => r.status === "drawn" || r.status === "settled");

  const years = [...new Set(allDone.map(roundYear))];
  const all = ar === "alle" && years.length > 1;
  const year = all ? null : years.includes(Number(ar)) ? Number(ar) : years[0];
  const done = year == null ? allDone : allDone.filter((r) => roundYear(r) === year);
  const withYear = all;

  const rows: RoundRow[] = done.map((r) => {
    const prizes = getPrizes(r.id);
    return { round: r, prizes, draws: getDraws(r.id), money: computeMoney(r, getCells(r.id), prizes) };
  });

  const stats = computeStats(done.map((r) => r.id));
  const featured = featuredWrapped();
  const wrappedYear = year != null && isWrappedOpen(year) ? year : null;

  if (rows.length === 0) {
    return (
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-semibold text-wine">Historikk</h1>
        <p className="max-w-prose text-plum/70">
          Ingen runder er trukket ennå. Når første trekning er registrert, dukker vinnere, potten og
          statistikk opp her av seg selv.
        </p>
      </div>
    );
  }

  const chrono = [...rows].reverse();
  const totalLodd = rows.reduce((s, r) => s + r.money.sold, 0);
  const totalOmsatt = rows.reduce((s, r) => s + r.money.loddSolgt, 0);
  const winnerNames = new Set(
    rows.flatMap((r) => r.draws.filter((d) => d.winner_name).map((d) => d.winner_name!.trim().toLowerCase())),
  );
  // The pot is whatever the latest round carried forward, whichever year is shown.
  const latest = allDone[0];
  const pot = computeMoney(latest, getCells(latest.id), getPrizes(latest.id)).videre;

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <h1 className="font-display text-3xl font-semibold text-wine">Historikk</h1>
          {years.length > 1 && <YearPicker years={years} selected={year} />}
        </div>
        <p className="max-w-2xl text-pretty text-plum/70">
          {year != null ? <>I {year} er det </> : <>Gjennom alle år er det </>}
          <Num>{KR_INT.format(totalLodd)}</Num> lodd solgt for <Num>{KR_INT.format(totalOmsatt)} kr</Num>, og{" "}
          <Num>{stats.totalWins}</Num> premier fordelt på <Num>{winnerNames.size}</Num> forskjellige vinnere.
          Potten er nå på <Num>{kr(pot)} kr</Num>.
        </p>
        {!me && (
          <p className="text-sm text-plum/60">Velg hvem du er øverst til høyre for å se dine tall.</p>
        )}
      </header>

      {featured != null && (featured === year || year == null) ? (
        <WrappedBanner year={featured} />
      ) : (
        wrappedYear != null && (
          <Link
            href={`/wrapped/${wrappedYear}`}
            className="-mt-6 inline-flex items-center gap-2 font-medium text-wine underline-offset-4 hover:underline"
          >
            <Crown className="h-2.5 w-3.5" /> Se hele {wrappedYear} som årgang
          </Link>
        )
      )}

      {me && <YourNumbers name={me} stats={personStats(done.map((r) => r.id), me)} />}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_auto]">
        {chrono.length > 1 && <WeekCharts rows={chrono} withYear={withYear} />}
        <HeatmapPanel stats={stats} />
      </div>

      <Leaderboards stats={stats} me={me} />

      <RoundLedger rows={rows} me={me} withYear={withYear} />
    </div>
  );
}

/** December's year in review, the bottle on the shelf: a wine band that opens the story. */
function WrappedBanner({ year }: { year: number }) {
  return (
    <Link
      href={`/wrapped/${year}`}
      className="group flex items-center justify-between gap-4 rounded-2xl bg-plum px-5 py-5 text-cream shadow-[0_18px_40px_-22px_rgba(44,10,20,0.9)] transition-transform active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine sm:px-7"
    >
      <span className="min-w-0">
        <span className="block font-display text-2xl font-semibold text-balance sm:text-3xl">
          Årgang <span className="text-gold">{year}</span> er tappet
        </span>
        <span className="mt-1 block text-cream/80">Vinnerne, rutene, pengene og din egen årgang.</span>
      </span>
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-gold px-4 py-2 font-semibold text-plum transition-colors group-hover:bg-gold-soft">
        Smak på året
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7.5 4.5 13 10l-5.5 5.5" />
        </svg>
      </span>
    </Link>
  );
}

/** "Dine tall": your own line in the history, told as a sentence like the intro above it. */
function YourNumbers({ name, stats }: { name: string; stats: PersonStats }) {
  const { lodd, rounds, wins, firstPrizes, luckySquare } = stats;
  return (
    <section
      aria-labelledby="dine-tall"
      className="flex items-start gap-4 rounded-xl border border-gold/40 bg-gold-soft/20 p-4 sm:p-5"
    >
      <MeSquare name={name} ring />
      <div className="min-w-0 space-y-1">
        <h2 id="dine-tall" className="font-display text-xl font-semibold text-plum">
          Dine tall, {name}
        </h2>
        {lodd === 0 && wins === 0 ? (
          <p className="text-pretty text-plum/70">
            Ingen lodd i ferdige runder ennå. Kjøp en rute, så begynner historien din her.
          </p>
        ) : (
          <p className="max-w-2xl text-pretty text-plum/70">
            Du har kjøpt <Num>{lodd}</Num> lodd i <Num>{rounds}</Num> runde{rounds === 1 ? "" : "r"} og{" "}
            {wins === 0 ? (
              <>venter fortsatt på første seier.</>
            ) : (
              <>
                vunnet <Num>{wins}</Num> premie{wins === 1 ? "" : "r"}
                {firstPrizes > 0 && (
                  <>
                    {" "}
                    (<Crown className="inline h-2.5 w-3.5 -translate-y-px text-wine" />{" "}
                    <Num>{firstPrizes}</Num> førstepremie{firstPrizes === 1 ? "" : "r"})
                  </>
                )}
                .
              </>
            )}
            {luckySquare && (
              <>
                {" "}
                {luckySquare.wins > 0 ? "Lykkeruta" : "Favorittruta"} di er{" "}
                <Num>
                  {luckySquare.col}-{luckySquare.row}
                </Num>
                {luckySquare.wins > 0
                  ? ` – der har du vunnet ${luckySquare.wins === 1 ? "én gang" : `${luckySquare.wins} ganger`}.`
                  : ` – kjøpt ${luckySquare.sold === 1 ? "én gang" : `${luckySquare.sold} ganger`}.`}
              </>
            )}
          </p>
        )}
      </div>
    </section>
  );
}

function Num({ children }: { children: React.ReactNode }) {
  return <span className="font-semibold text-plum tabular-nums">{children}</span>;
}

function Panel({
  title,
  aside,
  children,
  className = "",
}: {
  title: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-xl border border-plum/10 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-xl font-semibold text-plum">{title}</h2>
        {aside && <div className="text-sm text-plum/60">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

/* ---------- Uke for uke: potten og solgte ruter ---------- */

function TrackHead({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5">
      <h3 className="text-sm font-semibold text-wine">{label}</h3>
      {children && <p className="text-xs text-plum/60 sm:text-sm">{children}</p>}
    </div>
  );
}

function WeekCharts({ rows, withYear }: { rows: RoundRow[]; withYear: boolean }) {
  const values = rows.map((r) => r.money.videre);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const posShare = max / span;
  const peakIdx = values.indexOf(max);
  const lastIdx = values.length - 1;
  const change = values[lastIdx] - rows[0].money.carriedOver;

  const sold = rows.map((r) => r.money.sold);
  const boardSize = Math.max(...rows.map((r) => r.round.grid_size ** 2));
  const avgSold = sold.reduce((s, n) => s + n, 0) / sold.length;
  const fullBoards = rows.filter((r) => r.money.sold >= r.round.grid_size ** 2).length;

  return (
    <Panel title="Uke for uke" className="flex flex-col">
      <p className="sr-only">
        To søylediagram over rundene: videreført beløp etter hver runde, og hvor mange ruter som ble solgt.
        Hver søyle lenker til runden.
      </p>

      <TrackHead label="Potten">
        Høyest <span className="font-semibold text-plum tabular-nums">{kr(max)} kr</span> etter{" "}
        {roundLabel(rows[peakIdx].round, withYear).toLowerCase()}
        <span className="mx-1.5 text-plum/30">·</span>
        {change >= 0 ? "Opp" : "Ned"} <span className="tabular-nums">{kr(Math.abs(change))} kr</span> totalt
      </TrackHead>
      <div className="flex h-32 gap-[3px] pt-5 sm:gap-1 lg:h-auto lg:min-h-32 lg:flex-[3]" role="list">
        {rows.map((r, i) => {
          const v = r.money.videre;
          const h = (Math.abs(v) / span) * 100;
          const label = roundLabel(r.round, withYear);
          const always = i === peakIdx || i === lastIdx;
          const delta = v - r.money.carriedOver;
          return (
            <Link
              key={r.round.id}
              href={`/runde/${r.round.id}`}
              role="listitem"
              title={`${label}: ${kr(v)} kr videreført (${signed(delta)} kr)`}
              aria-label={`${label}: ${kr(v)} kroner videreført`}
              className="group flex min-w-0 flex-1 flex-col rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-wine"
            >
              <div className="relative flex flex-col justify-end" style={{ height: `${posShare * 100}%` }}>
                {v >= 0 && (
                  <>
                    <span
                      className={`pointer-events-none mb-1 text-center text-[10px] leading-none tabular-nums transition-opacity duration-150 sm:text-[11px] ${
                        always
                          ? "font-semibold text-plum"
                          : "text-plum/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden"
                      }`}
                    >
                      {kr(Math.round(v))}
                    </span>
                    <span
                      className={`block rounded-t-[3px] transition-colors duration-150 ${
                        i === lastIdx ? "bg-wine" : "bg-wine/25 group-hover:bg-wine/60"
                      }`}
                      style={{ height: `${(h / (posShare * 100)) * 100}%`, minHeight: v > 0 ? 2 : 0 }}
                    />
                  </>
                )}
              </div>
              <div className="border-t border-plum/25" />
              <div className="flex flex-1 flex-col" style={{ maxHeight: `${(1 - posShare) * 100}%` }}>
                {v < 0 && (
                  <span
                    className="block rounded-b-[3px] bg-wine-dark"
                    style={{ height: `${(h / ((1 - posShare) * 100)) * 100}%` }}
                  />
                )}
              </div>
            </Link>
          );
        })}
      </div>

      <div className="mt-5">
        <TrackHead label="Solgte ruter">
          Snitt <span className="font-semibold text-plum tabular-nums">{KR_INT.format(Math.round(avgSold))}</span> av{" "}
          {boardSize}
          {fullBoards > 0 && (
            <>
              <span className="mx-1.5 text-plum/30">·</span>
              <span className="tabular-nums">{fullBoards}</span> {fullBoards === 1 ? "fullt brett" : "fulle brett"}
            </>
          )}
        </TrackHead>
      </div>
      <div className="flex h-20 gap-[3px] pt-5 sm:gap-1 lg:h-auto lg:min-h-20 lg:flex-[2]" role="list">
        {rows.map((r, i) => {
          const n = r.money.sold;
          const size = r.round.grid_size ** 2;
          const full = n >= size;
          const label = roundLabel(r.round, withYear);
          return (
            <Link
              key={r.round.id}
              href={`/runde/${r.round.id}`}
              role="listitem"
              title={`${label}: ${n} av ${size} ruter solgt`}
              aria-label={`${label}: ${n} av ${size} ruter solgt`}
              className="group flex min-w-0 flex-1 flex-col justify-end rounded-sm outline-offset-2 focus-visible:outline-2 focus-visible:outline-wine"
            >
              <span
                className={`pointer-events-none mb-1 text-center text-[10px] leading-none tabular-nums transition-opacity duration-150 sm:text-[11px] ${
                  i === lastIdx
                    ? "font-semibold text-plum"
                    : "text-plum/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 max-sm:hidden"
                }`}
              >
                {n}
              </span>
              <span
                className={`block rounded-t-[3px] transition-colors duration-150 ${
                  full ? "bg-gold" : i === lastIdx ? "bg-gold/70" : "bg-gold-soft/80 group-hover:bg-gold/60"
                }`}
                style={{ height: `${(n / boardSize) * 100}%`, minHeight: n > 0 ? 2 : 0 }}
              />
              <span className="border-t border-plum/25" />
            </Link>
          );
        })}
      </div>

      <div className="mt-1.5 flex gap-[3px] sm:gap-1" aria-hidden>
        {rows.map((r, i) => {
          const n = weekNumber(r.round.title) ?? String(r.round.id);
          return (
            <span
              key={r.round.id}
              className={`min-w-0 flex-1 text-center text-[10px] tabular-nums sm:text-[11px] ${
                i === lastIdx ? "font-semibold text-wine" : "text-plum/60"
              } ${i % 2 === 1 && i !== lastIdx ? "max-sm:invisible" : ""}`}
            >
              {n}
            </span>
          );
        })}
      </div>
      <p className="mt-1 text-center text-xs text-plum/60">
        {withYear ? `Uke, ${roundYear(rows[0].round)}–${roundYear(rows[lastIdx].round)}` : "Uke"}
      </p>
    </Panel>
  );
}

/* ---------- Årsvelger ---------- */

/** One choice filters the whole page. Links, not a form, so every year has its own URL. */
function YearPicker({ years, selected }: { years: number[]; selected: number | null }) {
  const options = [
    ...years.map((y) => ({ key: String(y), label: String(y), on: y === selected })),
    { key: "alle", label: "Alle år", on: selected == null },
  ];
  return (
    <nav aria-label="Velg år" className="flex flex-wrap gap-1 rounded-lg bg-parchment/60 p-1 text-sm">
      {options.map((o) => (
        <Link
          key={o.key}
          href={`/historikk?ar=${o.key}`}
          aria-current={o.on ? "page" : undefined}
          className={`rounded-md px-3 py-1 tabular-nums outline-offset-2 focus-visible:outline-2 focus-visible:outline-wine ${
            o.on ? "bg-white font-semibold text-wine shadow-sm" : "text-plum/70 hover:text-plum"
          }`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

/* ---------- Heatmap ---------- */

const HEAT_COLD = [243, 233, 219];
const HEAT_HOT = [123, 30, 59];

function heatColor(t: number): string {
  const c = HEAT_COLD.map((v, i) => Math.round(v + (HEAT_HOT[i] - v) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

function HeatmapPanel({ stats }: { stats: LotteryStats }) {
  const { squares, gridSize } = stats;
  const map = new Map(squares.map((s) => [`${s.row},${s.col}`, s]));
  const maxWins = Math.max(1, ...squares.map((s) => s.wins));
  const hottest = squares.filter((s) => s.wins === maxWins && s.wins > 0);
  const neverWon = squares.filter((s) => s.wins === 0 && s.sold > 0).sort((a, b) => b.sold - a.sold);
  const sq = (s: SquareHeat) => `${s.col}-${s.row}`;

  return (
    <Panel title="Vinnerruter" className="lg:w-[22rem]">
      <div className="mx-auto w-fit">
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `1.25rem repeat(${gridSize}, minmax(0, 2.5rem))` }}
        >
          <div />
          {Array.from({ length: gridSize }, (_, i) => (
            <div key={`h${i}`} className="pb-0.5 text-center text-[11px] font-semibold text-plum/60">
              {i + 1}
            </div>
          ))}
          {Array.from({ length: gridSize }, (_, r) => {
            const row = r + 1;
            return (
              <div key={row} className="contents">
                <div className="flex items-center justify-center text-[11px] font-semibold text-plum/60">
                  {row}
                </div>
                {Array.from({ length: gridSize }, (_, c) => {
                  const col = c + 1;
                  const s = map.get(`${row},${col}`);
                  const wins = s?.wins ?? 0;
                  const t = wins / maxWins;
                  return (
                    <div
                      key={col}
                      title={
                        s
                          ? `Rute ${col}-${row}: ${wins} seier${wins === 1 ? "" : "e"} på ${s.sold} solgte lodd`
                          : `Rute ${col}-${row}: aldri solgt`
                      }
                      className={`flex aspect-square items-center justify-center rounded-md text-xs font-semibold tabular-nums ${
                        s ? (t > 0.5 ? "text-cream" : "text-plum/80") : "border border-dashed border-plum/15"
                      }`}
                      style={s ? { backgroundColor: heatColor(t) } : undefined}
                    >
                      {s ? wins : ""}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-2 pl-6 text-xs text-plum/60">
          <span>0</span>
          <span
            className="h-2 flex-1 rounded-full"
            style={{ background: `linear-gradient(to right, ${heatColor(0)}, ${heatColor(1)})` }}
          />
          <span className="tabular-nums">{maxWins} seire</span>
        </div>
      </div>

      <dl className="mt-5 space-y-2 border-t border-plum/10 pt-4 text-sm">
        {hottest.length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-plum/60">Heldigst</dt>
            <dd className="text-right font-medium tabular-nums">
              {hottest.map(sq).join(", ")}{" "}
              <span className="font-normal text-plum/60">· {maxWins} seire</span>
            </dd>
          </div>
        )}
        {neverWon.length > 0 && (
          <div className="flex justify-between gap-3">
            <dt className="text-plum/60">Aldri vunnet</dt>
            <dd className="text-right font-medium tabular-nums">
              {neverWon.map(sq).join(", ")}
            </dd>
          </div>
        )}
      </dl>
      <p className="mt-3 text-xs text-plum/60">
        {stats.locatedWins < stats.totalWins &&
          `${stats.totalWins - stats.locatedWins} av ${stats.totalWins} trekninger mangler rute og er ikke med.`}
      </p>
    </Panel>
  );
}

/* ---------- Toppliste ---------- */

interface BoardRow {
  key: string;
  name: string;
  value: React.ReactNode;
  sort: number;
}

function Leaderboards({ stats, me }: { stats: LotteryStats; me: string | null }) {
  const boards: { title: string; note?: string; rows: BoardRow[] }[] = [
    {
      title: "Flest seire",
      rows: stats.topWinners.map((w) => ({
        key: w.name,
        name: w.name,
        sort: w.wins,
        value: `${w.wins} seier${w.wins === 1 ? "" : "e"}`,
      })),
    },
    {
      title: "Oftest med",
      rows: stats.topParticipants.map((p) => ({
        key: p.name,
        name: p.name,
        sort: p.rounds * 1000 + p.lodd,
        value: (
          <>
            {p.rounds} runde{p.rounds === 1 ? "" : "r"}
            <span className="text-plum/60"> · {p.lodd} lodd</span>
          </>
        ),
      })),
    },
    {
      title: "Flaks-indeks",
      note: "Seire delt på antall lodd. Bare de som har kjøpt minst 5 lodd totalt er med.",
      rows: stats.luckIndex.map((p) => ({
        key: p.name,
        name: p.name,
        sort: p.pct * 1000 + p.wins,
        value: (
          <>
            {p.pct} %<span className="text-plum/60"> · {p.wins}/{p.lodd}</span>
          </>
        ),
      })),
    },
    {
      title: "Lengst tørke",
      note: "Lodd kjøpt siden siste seier. For dem som aldri har vunnet, teller alle.",
      rows: stats.drought.map((p) => ({
        key: p.name,
        name: p.name,
        sort: p.lodd * 1000 + p.rounds,
        value: (
          <>
            {p.lodd} lodd
            <span className="text-plum/60">
              {" "}
              · {p.neverWon ? "aldri vunnet" : `${p.rounds} runde${p.rounds === 1 ? "" : "r"}`}
            </span>
          </>
        ),
      })),
    },
  ];

  return (
    <Panel title="Toppliste">
      <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-x-6">
        {boards.map((b) => (
          <div key={b.title}>
            <h3 className="mb-2 font-sans text-sm font-semibold text-wine">{b.title}</h3>
            {b.rows.length ? (
              <ol className="divide-y divide-plum/5 text-sm">
                {b.rows.map((row, i) => {
                  const rank = competitionRanks(b.rows.map((r) => r.sort))[i];
                  const isMe = !!me && normName(row.name) === normName(me);
                  return (
                    <li
                      key={row.key}
                      aria-current={isMe ? "true" : undefined}
                      className={`flex items-center gap-3 py-1.5 lg:gap-2 ${isMe ? "-mx-1.5 rounded-md bg-gold-soft/70 px-1.5" : ""}`}
                    >
                      <span
                        className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums ${
                          rank === 1 ? "bg-gold-soft text-plum" : "text-plum/60"
                        }`}
                      >
                        {rank}
                      </span>
                      <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                      <span className="shrink-0 text-plum/70 tabular-nums lg:text-xs">{row.value}</span>
                    </li>
                  );
                })}
              </ol>
            ) : (
              <p className="text-sm text-plum/60">Ingen data ennå.</p>
            )}
            {b.note && <p className="mt-2 text-xs text-plum/60">{b.note}</p>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/* ---------- Alle runder ---------- */

function RoundLedger({ rows, me, withYear }: { rows: RoundRow[]; me: string | null; withYear: boolean }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="font-display text-xl font-semibold text-plum">Alle runder</h2>
        <p className="text-sm text-plum/60">Nyeste først</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-plum/10 bg-white shadow-sm">
        <div className="hidden grid-cols-[9rem_1fr_15rem] gap-6 border-b border-plum/10 bg-parchment/40 px-5 py-2 text-xs font-semibold text-plum/60 md:grid">
          <span>Runde</span>
          <span>Vinnere</span>
          <span className="text-right">Potten</span>
        </div>
        <ol className="divide-y divide-plum/10">
          {rows.map((r) => (
            <RoundEntry key={r.round.id} row={r} me={me} withYear={withYear} />
          ))}
        </ol>
      </div>
    </section>
  );
}

function RoundEntry({ row, me, withYear }: { row: RoundRow; me: string | null; withYear: boolean }) {
  const { round, prizes, draws, money } = row;
  const winners = draws.filter((d) => d.winner_name).sort((a, b) => a.rank - b.rank);
  const label = roundLabel(round, withYear);

  return (
    <li className="grid grid-cols-[minmax(0,1fr)] gap-x-6 gap-y-3 px-4 py-4 sm:px-5 md:grid-cols-[9rem_minmax(0,1fr)_15rem]">
      <div className="flex items-baseline justify-between gap-3 md:block">
        <Link
          href={`/runde/${round.id}`}
          className="font-display text-lg font-semibold text-wine underline-offset-4 hover:underline"
        >
          {label}
        </Link>
        <p className="text-xs text-plum/60 tabular-nums md:mt-0.5">
          {new Date(round.created_at).toLocaleDateString("nb-NO", { day: "numeric", month: "short" })}
          {round.organizer_name && <> · {round.organizer_name}</>}
        </p>
      </div>

      {winners.length ? (
        <ol className="space-y-1 text-sm md:self-start">
          {winners.map((d) => {
            const name = prizeName(prizeOfDraw(prizes, d)?.name);
            const isMe = !!me && normName(d.winner_name!) === normName(me);
            return (
              <li
                key={d.rank}
                className={`flex min-w-0 items-baseline gap-2 ${isMe ? "-mx-1.5 rounded-md bg-gold-soft/40 px-1.5" : ""}`}
              >
                <span className="w-4 shrink-0 text-right text-xs font-semibold text-plum/60 tabular-nums">
                  {d.rank}
                </span>
                <span className="shrink-0 font-medium">{d.winner_name}</span>
                {isMe && <YouChip />}
                {name && (
                  <span className="min-w-0 truncate text-plum/60" title={name}>
                    {name}
                  </span>
                )}
                {d.col && d.row && (
                  <span className="ml-auto shrink-0 pl-1 text-xs text-plum/60 tabular-nums" title="Rute (kolonne-rad)">
                    {d.col}-{d.row}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="text-sm text-plum/60">Ingen registrerte vinnere.</p>
      )}

      <Receipt money={money} className="md:self-start" />
    </li>
  );
}

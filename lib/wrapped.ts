// "Årgang": the year in review (/wrapped/[year]). The tally is a pure function over loaded rounds,
// so it can be tested without a database; loading and the release switch (/superadmin) sit at the bottom.
import { db } from "./db";
import { roundYear } from "./datetime";
import { computeMoney } from "./money";
import { normName } from "./format";
import { getCells, getDraws, getPrizes, inDraw, listRounds } from "./repo";
import type { Round } from "./types";
import { type Leader, type PersonWrap, type SquareTally, type TitleId, type WrapRound, type YearWrap } from "./wrapped-shared";

export * from "./wrapped-shared";

const MIN_LODD_FOR_LUCK = 5;

interface Tally {
  name: string;
  lodd: number;
  rounds: Set<number>;
  wins: number;
  firstPrizes: number;
  organized: number;
  spent: number;
  wonWorth: number | null;
  squares: Map<string, SquareTally>;
  streak: number;
  drought: number;
}

function square(map: Map<string, SquareTally>, row: number, col: number): SquareTally {
  const key = `${row},${col}`;
  const s = map.get(key) ?? { row, col, sold: 0, wins: 0 };
  map.set(key, s);
  return s;
}

/** The top of a tally, ties included; null when nobody scores above zero. */
function best<T>(items: T[], value: (t: T) => number, name: (t: T) => string): Leader | null {
  const top = Math.max(0, ...items.map(value));
  if (top <= 0) return null;
  const names = items.filter((t) => value(t) === top).map(name);
  return { names: names.sort((a, b) => a.localeCompare(b, "nb")), value: top };
}

function tallyYear(rounds: WrapRound[]) {
  const people = new Map<string, Tally>();
  const squares = new Map<string, SquareTally>();
  const person = (raw: string) => {
    const key = normName(raw);
    let p = people.get(key);
    if (!p) {
      p = { name: raw.trim(), lodd: 0, rounds: new Set(), wins: 0, firstPrizes: 0, organized: 0, spent: 0, wonWorth: 0, squares: new Map(), streak: 0, drought: 0 };
      people.set(key, p);
    }
    return p;
  };

  for (const { round, cells, draws, prizes } of rounds) {
    if (round.organizer_name.trim()) person(round.organizer_name).organized += 1;

    const inRound = new Set<string>();
    for (const c of cells) {
      if (!inDraw(c) || !c.buyer_name) continue;
      const p = person(c.buyer_name);
      p.lodd += 1;
      p.spent += round.ticket_price;
      p.rounds.add(round.id);
      square(p.squares, c.row, c.col).sold += 1;
      square(squares, c.row, c.col).sold += 1;
      inRound.add(normName(c.buyer_name));
    }

    const wonHere = new Set<string>();
    for (const d of draws) {
      if (!d.winner_name) continue;
      const p = person(d.winner_name);
      p.wins += 1;
      if (d.rank === 1) p.firstPrizes += 1;
      const price = prizes.find((x) => x.id === d.prize_id)?.price;
      p.wonWorth = p.wonWorth == null || price == null ? null : p.wonWorth + price;
      if (d.row && d.col) {
        square(p.squares, d.row, d.col).wins += 1;
        square(squares, d.row, d.col).wins += 1;
      }
      wonHere.add(normName(d.winner_name));
    }

    // A dry spell counts the rounds you played without winning; sitting a round out doesn't end it.
    for (const key of inRound) {
      const p = people.get(key)!;
      p.streak = wonHere.has(key) ? 0 : p.streak + 1;
      p.drought = Math.max(p.drought, p.streak);
    }
  }
  return { people, squares };
}

/** Competition rank of `value` in a list: ties share the place. */
function rankOf(values: number[], value: number): number {
  return values.filter((v) => v > value).length + 1;
}

function luckiest(tallies: Tally[]): string[] {
  const eligible = tallies.filter((p) => p.lodd >= MIN_LODD_FOR_LUCK && p.wins > 0);
  const top = Math.max(0, ...eligible.map((p) => p.wins / p.lodd));
  return top > 0 ? eligible.filter((p) => p.wins / p.lodd === top).map((p) => normName(p.name)) : [];
}

function titleFor(p: Tally, all: Tally[], roundCount: number, isNew: boolean): TitleId {
  const key = normName(p.name);
  const crown = best(all, (t) => t.firstPrizes, (t) => normName(t.name));
  if (crown?.names.includes(key)) return "polkongen";
  if (luckiest(all).includes(key)) return "snikskytter";
  if (p.wins === 0 && p.lodd >= MIN_LODD_FOR_LUCK) return "optimist";
  if (roundCount >= 4 && p.rounds.size >= Math.ceil(roundCount * 0.85)) return "stamgjest";
  if (p.organized >= 3) return "arrangor";
  const fav = [...p.squares.values()].sort((a, b) => b.sold - a.sold)[0];
  if (fav && fav.sold >= 4 && fav.sold >= p.lodd * 0.4) return "vanedyr";
  if (isNew) return "nykommer";
  return "smaker";
}

/** A tasting note for one person's year, built from their numbers. */
export function tastingNote(p: { lodd: number; rounds: number; wins: number; firstPrizes: number; lucky: SquareTally | null }): string {
  const body = p.lodd >= 30 ? "Fyldig" : p.lodd >= 12 ? "Middels fyldig" : "Lett og frisk";
  const character =
    p.firstPrizes > 0
      ? "med en kongelig ettersmak"
      : p.wins >= 3
        ? "med rikelig frukt"
        : p.wins > 0
          ? "med et hint av hell"
          : "med en tørr finish";
  const sq = p.lucky ? `, og tydelige toner av rute ${p.lucky.col}-${p.lucky.row}` : "";
  const rounds = p.rounds === 1 ? "én runde" : `${p.rounds} runder`;
  return `${body}, ${character}${sq}. Lang ettersmak av ${rounds}.`;
}

/** The common part of the year. `earlier` are the names with lodd in any earlier year, or null when there are none. */
export function buildYearWrap(year: number, rounds: WrapRound[], earlier: Set<string> | null): YearWrap {
  const { people, squares } = tallyYear(rounds);
  const tallies = [...people.values()];
  const buyers = tallies.filter((p) => p.lodd > 0);

  const sq = [...squares.values()];
  const hottest = [...sq].sort((a, b) => b.wins - a.wins || b.sold - a.sold)[0] ?? null;
  const coldest = sq.filter((s) => s.wins === 0).sort((a, b) => b.sold - a.sold)[0] ?? null;

  let lodd = 0;
  let polet = 0;
  for (const r of rounds) {
    const m = computeMoney(r.round, r.cells, r.prizes);
    lodd += m.loddSolgt;
    polet += m.poletCost;
  }
  const start = rounds[0]?.round.carried_over ?? 0;
  const last = rounds[rounds.length - 1];
  // Imported Polet costs can carry øre; the ledger is whole kroner.
  const end = last ? Math.round(computeMoney(last.round, last.cells, last.prizes).videre) : 0;
  polet = Math.round(polet);

  const allPrizes = rounds.flatMap((r) => r.prizes);
  const withCategory = allPrizes.filter((p) => p.category);
  const priced = allPrizes.filter((p) => p.price != null && p.name);
  const categories = [...withCategory.reduce((m, p) => m.set(p.category!, (m.get(p.category!) ?? 0) + 1), new Map<string, number>())]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
  const priciest = [...priced].sort((a, b) => b.price! - a.price!)[0];

  return {
    year,
    rounds: rounds.length,
    lodd: buyers.reduce((s, p) => s + p.lodd, 0),
    bottles: allPrizes.length,
    people: buyers.length,
    newFaces: earlier ? buyers.filter((p) => !earlier.has(normName(p.name))).length : null,
    regular: best(buyers, (p) => p.rounds.size, (p) => p.name),
    topWinners: tallies
      .filter((p) => p.wins > 0)
      .sort((a, b) => b.wins - a.wins)
      .slice(0, 3)
      .map((p) => ({ name: p.name, wins: p.wins })),
    crown: best(tallies, (p) => p.firstPrizes, (p) => p.name),
    gridSize: Math.max(6, ...rounds.map((r) => r.round.grid_size)),
    squares: sq,
    hottest: hottest && hottest.wins > 0 ? hottest : null,
    coldest,
    relay: rounds.map((r) => r.round.organizer_name.trim()).filter(Boolean),
    topOrganizer: best(tallies, (p) => p.organized, (p) => p.name),
    money: { start, lodd, polet, end, adjusted: end - (start + lodd - polet) },
    cellar:
      withCategory.length >= 3 || priced.length >= 3
        ? { categories, priciest: priciest ? { name: priciest.name, price: priciest.price! } : null }
        : null,
    optimist: best(
      buyers.filter((p) => p.wins === 0),
      (p) => p.lodd,
      (p) => p.name,
    ),
    drought: best(buyers, (p) => p.drought, (p) => p.name),
  };
}

/** One person's year, or null when they had no lodd and no wins. */
export function buildPersonWrap(name: string, rounds: WrapRound[], earlier: Set<string> | null): PersonWrap | null {
  const { people } = tallyYear(rounds);
  const p = people.get(normName(name));
  if (!p || (p.lodd === 0 && p.wins === 0)) return null;
  const all = [...people.values()];
  const isNew = !!earlier && !earlier.has(normName(name));
  const squares = [...p.squares.values()];
  const lucky =
    [...squares].sort((a, b) => b.wins - a.wins || b.sold - a.sold)[0] ?? null;
  const base = { lodd: p.lodd, rounds: p.rounds.size, wins: p.wins, firstPrizes: p.firstPrizes, lucky };
  return {
    ...base,
    name: p.name,
    organized: p.organized,
    spent: p.spent,
    wonWorth: p.wins > 0 ? p.wonWorth : null,
    loddRank: rankOf(
      all.filter((t) => t.lodd > 0).map((t) => t.lodd),
      p.lodd,
    ),
    squares,
    drought: p.drought,
    isNew,
    title: titleFor(p, all, rounds.length, isNew),
    note: tastingNote(base),
  };
}

/* ------------------------------------------------------------- loading --- */

const done = (r: Round) => r.status === "drawn" || r.status === "settled";

function load(r: Round): WrapRound {
  return { round: r, cells: getCells(r.id), draws: getDraws(r.id), prizes: getPrizes(r.id) };
}

/** The year's drawn rounds in the order they ran, and everyone with lodd in earlier years. */
export function loadYear(year: number): { rounds: WrapRound[]; earlier: Set<string> | null } {
  const all = listRounds().filter(done).reverse();
  const rounds = all.filter((r) => roundYear(r) === year).map(load);
  const before = all.filter((r) => roundYear(r) < year);
  if (!before.length) return { rounds, earlier: null };
  const earlier = new Set<string>();
  for (const r of before) for (const c of getCells(r.id)) if (inDraw(c) && c.buyer_name_norm) earlier.add(c.buyer_name_norm);
  return { rounds, earlier };
}

/* ------------------------------------------------------------- release --- */

function releasedYears(): Set<number> {
  const rows = db.prepare("SELECT year FROM wrapped_releases").all() as { year: number }[];
  return new Set(rows.map((r) => Number(r.year)));
}

/** The first year with an Årgang. Earlier years were imported from the spreadsheet and stay in /historikk. */
export const FIRST_WRAPPED_YEAR = 2026;

/** Years that can have an Årgang (drawn rounds, from FIRST_WRAPPED_YEAR), newest first. Each opens
 *  only when the superadmin releases it. */
export function wrappedYears(): { year: number; open: boolean; released: boolean }[] {
  const released = releasedYears();
  const years = [...new Set(listRounds().filter(done).map(roundYear))].filter((y) => y >= FIRST_WRAPPED_YEAR);
  return years.map((year) => ({ year, released: released.has(year), open: released.has(year) }));
}

export function isWrappedOpen(year: number): boolean {
  return wrappedYears().some((y) => y.year === year && y.open);
}

export function setWrappedReleased(year: number, released: boolean): void {
  if (released) db.prepare("INSERT OR IGNORE INTO wrapped_releases (year) VALUES (?)").run(year);
  else db.prepare("DELETE FROM wrapped_releases WHERE year = ?").run(year);
}

/** The year to feature on /historikk: a current-year release, or last year's through January. */
export function featuredWrapped(now = new Date()): number | null {
  const y = now.getFullYear();
  const open = wrappedYears().filter((w) => w.open);
  if (open.some((w) => w.year === y)) return y;
  if (now.getMonth() === 0 && open.some((w) => w.year === y - 1)) return y - 1;
  return null;
}

/** The last drawn round of a year, which carries the release notification. */
export function lastRoundOf(year: number): number | null {
  const r = listRounds().find((x) => done(x) && roundYear(x) === year);
  return r?.id ?? null;
}

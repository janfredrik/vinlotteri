import { normName } from "./format";
import type { Cell, Draw, Round } from "./types";

/** One round a name shows up in, newest first in `NameUse.rounds`. */
export interface NameRound {
  id: number;
  title: string;
  /** When the round was played: sales close, else when it was created. ISO. */
  date: string;
  lodd: number;
  wins: number;
  organized: boolean;
}

/** Everything one name (as spelled up to case and spacing) has been used for. */
export interface NameUse {
  norm: string;
  /** The spelling used most. */
  name: string;
  spellings: string[];
  lodd: number;
  wins: number;
  organized: number;
  rounds: NameRound[];
}

/** SQLite's datetime('now') gives "2026-10-09 17:49:36" in UTC, without the T and Z. */
function isoDate(s: string): string {
  return /^\d{4}-\d\d-\d\d \d/.test(s) ? `${s.replace(" ", "T")}Z` : s;
}

export function roundDate(r: Pick<Round, "sales_close_at" | "created_at">): string {
  return isoDate(r.sales_close_at ?? r.created_at);
}

/** Every name used in the lottery: as buyer, winner or organiser, with the rounds it appears in. */
export function buildNameUses(rounds: Round[], cells: Cell[], draws: Draw[]): NameUse[] {
  const byId = new Map(rounds.map((r) => [r.id, r]));
  const uses = new Map<string, { spellings: Map<string, number>; rounds: Map<number, NameRound> }>();

  const touch = (raw: string | null, roundId: number) => {
    const name = raw?.trim();
    const round = byId.get(roundId);
    if (!name || !round) return null;
    const norm = normName(name);
    const u = uses.get(norm) ?? { spellings: new Map(), rounds: new Map() };
    uses.set(norm, u);
    u.spellings.set(name, (u.spellings.get(name) ?? 0) + 1);
    const nr = u.rounds.get(roundId) ?? {
      id: roundId,
      title: round.title || `Runde ${roundId}`,
      date: roundDate(round),
      lodd: 0,
      wins: 0,
      organized: false,
    };
    u.rounds.set(roundId, nr);
    return nr;
  };

  for (const c of cells) {
    if (c.status !== "held" && c.status !== "sold") continue;
    const nr = touch(c.buyer_name, c.round_id);
    if (nr) nr.lodd += 1;
  }
  for (const d of draws) {
    const nr = touch(d.winner_name, d.round_id);
    if (nr) nr.wins += 1;
  }
  for (const r of rounds) {
    const nr = touch(r.organizer_name, r.id);
    if (nr) nr.organized = true;
  }

  return [...uses.entries()].map(([norm, u]) => {
    const list = [...u.rounds.values()].sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
    const spellings = [...u.spellings.entries()].sort((a, b) => b[1] - a[1]).map(([s]) => s);
    return {
      norm,
      name: spellings[0],
      spellings,
      lodd: list.reduce((n, r) => n + r.lodd, 0),
      wins: list.reduce((n, r) => n + r.wins, 0),
      organized: list.filter((r) => r.organized).length,
      rounds: list,
    };
  });
}

/** Rounds where two or more of the names bought squares: then they're most likely different people.
 *  Winning and organising don't count, since those follow from buying (or not) on their own. */
export function sharedRounds(uses: NameUse[]): { id: number; title: string; names: string[] }[] {
  const seen = new Map<number, { id: number; title: string; names: string[] }>();
  for (const u of uses) {
    for (const r of u.rounds) {
      if (!r.lodd) continue;
      const s = seen.get(r.id) ?? { id: r.id, title: r.title, names: [] };
      s.names.push(u.name);
      seen.set(r.id, s);
    }
  }
  const dates = new Map(uses.flatMap((u) => u.rounds.map((r) => [r.id, r.date] as const)));
  return [...seen.values()]
    .filter((s) => s.names.length > 1)
    .sort((a, b) => dates.get(b.id)!.localeCompare(dates.get(a.id)!) || b.id - a.id);
}

/** The name among these that was used last. */
export function mostRecent(uses: NameUse[]): NameUse | undefined {
  return [...uses].sort((a, b) => (b.rounds[0]?.date ?? "").localeCompare(a.rounds[0]?.date ?? ""))[0];
}

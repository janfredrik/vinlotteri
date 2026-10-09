// The weekly ritual as phases, shared by the admin page and the action route so the
// rules for "kan vi gjøre opp nå?" live in one place.
import type { Cell, Draw, Prize, RoundStatus } from "./types";

export type Phase = "forbered" | "selg" | "trekk" | "oppgjor" | "stafett";

export const PHASES: { id: Phase; label: string }[] = [
  { id: "forbered", label: "Forbered" },
  { id: "selg", label: "Salg" },
  { id: "trekk", label: "Trekning" },
  { id: "oppgjor", label: "Oppgjør" },
  { id: "stafett", label: "Avslutt runde" },
];

export const STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "Utkast",
  open: "Salget er åpent",
  closed: "Salget er stengt",
  drawn: "Trukket",
  settled: "Gjort opp",
};

const ORDER: Record<RoundStatus, number> = { draft: 0, open: 1, closed: 2, drawn: 3, settled: 4 };

export function currentPhase(status: RoundStatus): Phase {
  return (["forbered", "selg", "trekk", "oppgjor", "stafett"] as Phase[])[ORDER[status]];
}

export function phaseIndex(p: Phase): number {
  return PHASES.findIndex((x) => x.id === p);
}

export interface SettleCheck {
  prizes: number;
  drawn: number;
  allDrawn: boolean;
  unpaid: number;
  held: number;
  /** Hard requirements: no settling without them. */
  ready: boolean;
  /** Soft: settling anyway needs an explicit "ja, likevel". */
  needsForce: boolean;
}

/** Draws are numbered by draw order (1. vinner, 2. vinner …), not by prize: each winner picks
 *  a prize from what is left, so a draw only has a prize once the winner has chosen. */
export function prizeOfDraw(prizes: Prize[], draw: Pick<Draw, "prize_id">): Prize | undefined {
  return draw.prize_id == null ? undefined : prizes.find((p) => p.id === draw.prize_id);
}

/** Prizes nobody has picked yet (optionally ignoring one draw, e.g. the one choosing now). */
export function unclaimedPrizes(prizes: Prize[], draws: Draw[], exceptRank?: number): Prize[] {
  const claimed = new Set(
    draws.filter((d) => d.winner_name && d.rank !== exceptRank && d.prize_id != null).map((d) => d.prize_id),
  );
  return prizes.filter((p) => !claimed.has(p.id));
}

/** The earliest winner who still has to say which prize they want. Winners who weren't there
 *  (skipped) pick later, so they don't hold up the draw. */
export function awaitingChoice(draws: Draw[]): Draw | undefined {
  return draws
    .filter((d) => d.winner_name && d.prize_id == null && !d.skipped)
    .sort((a, b) => a.rank - b.rank)[0];
}

/** Winners who were skipped and still haven't picked, in draw order. */
export function skippedWinners(draws: Draw[]): Draw[] {
  return draws.filter((d) => d.winner_name && d.prize_id == null && d.skipped).sort((a, b) => a.rank - b.rank);
}

/** A square's prize wishes, most wanted first. */
export function parseWishes(raw: string | null | undefined): number[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => Number.isInteger(x)) : [];
  } catch {
    return [];
  }
}

/** The winner's most wanted prize that is still left, and where it was on their list (1-based). */
export function wishedPrize(
  cell: Pick<Cell, "wishes"> | undefined,
  prizes: Prize[],
  draws: Draw[],
  rank: number,
): { prize: Prize; place: number } | undefined {
  const left = unclaimedPrizes(prizes, draws, rank);
  const wishes = parseWishes(cell?.wishes);
  for (let i = 0; i < wishes.length; i++) {
    const prize = left.find((p) => p.id === wishes[i]);
    if (prize) return { prize, place: i + 1 };
  }
  return undefined;
}

export function settleCheck(cells: Cell[], prizes: Prize[], draws: Draw[]): SettleCheck {
  // A prize counts as drawn once a winner has picked it.
  const drawn = prizes.length - unclaimedPrizes(prizes, draws).length;
  const unpaid = cells.filter((c) => c.status === "sold" && !c.paid).length;
  const held = cells.filter((c) => c.status === "held").length;
  const allDrawn = prizes.length > 0 && drawn === prizes.length;
  return {
    prizes: prizes.length,
    drawn,
    allDrawn,
    unpaid,
    held,
    ready: allDrawn,
    needsForce: unpaid > 0 || held > 0,
  };
}

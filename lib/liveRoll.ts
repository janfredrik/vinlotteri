import type { LiveRoll, LiveOutcome } from "./types";

/**
 * The dice roll in progress, per round, for the big screen (/runde/[id]/skjerm). Held in memory
 * only: the app runs as a single instance, and a roll that is lost on a restart just means the
 * screen plays the short version of the next winner.
 *
 * `seq` goes up for every new roll, so the screen can tell "the same roll, one more die" from
 * "a new roll" even when the numbers repeat.
 */

const globalForRolls = globalThis as unknown as { __vlRolls?: Map<number, LiveRoll> };
const rolls: Map<number, LiveRoll> = globalForRolls.__vlRolls ?? (globalForRolls.__vlRolls = new Map());
// Seeded from the clock, so it keeps rising across a restart: an open screen ignores any roll
// numbered lower than one it has already seen.
let seq = Date.now();

export function getLiveRoll(roundId: number): LiveRoll | null {
  return rolls.get(roundId) ?? null;
}

/** A die was tapped on the organiser's phone. After an outcome, any tap starts a new roll, and so
 *  does a tap that drops a die already shown (the phone was reloaded): the screen only ever adds
 *  dice within one roll, so it can ignore late, out-of-order updates. */
export function rollDice(roundId: number, rank: number, col: number | null, row: number | null): LiveRoll {
  const cur = rolls.get(roundId);
  const dropped = !!cur && ((cur.col != null && col == null) || (cur.row != null && row == null));
  const fresh = !cur || cur.rank !== rank || cur.outcome != null || dropped;
  const next: LiveRoll = {
    seq: fresh ? ++seq : cur.seq,
    rank,
    col,
    row,
    outcome: null,
    method: "physical",
  };
  rolls.set(roundId, next);
  return next;
}

/** The draw was registered. A digital draw (or a roll the screen never saw) arrives here without dice steps. */
export function settleRoll(
  roundId: number,
  rank: number,
  outcome: LiveOutcome,
  col: number | null,
  row: number | null,
  method: LiveRoll["method"],
): LiveRoll {
  const cur = rolls.get(roundId);
  const same = cur && cur.rank === rank && cur.outcome == null && cur.col === col && cur.row === row;
  const next: LiveRoll = { seq: same ? cur.seq : ++seq, rank, col, row, outcome, method };
  rolls.set(roundId, next);
  return next;
}

/** The draw was undone: drop a roll that belongs to it. */
export function clearRoll(roundId: number, rank?: number): void {
  const cur = rolls.get(roundId);
  if (cur && (rank == null || cur.rank === rank)) rolls.delete(roundId);
}

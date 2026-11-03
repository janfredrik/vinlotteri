// The odds a buyer sees under the grid. Each prize draws a different square among those in the
// draw (an empty or already drawn square is rolled again), so it is drawing without replacement.

/** Chance that at least one of `mine` squares wins, when one square per prize is drawn among `inDraw`. */
export function chanceOfAnyPrize(mine: number, inDraw: number, prizes: number): number {
  const draws = Math.min(prizes, inDraw);
  if (mine <= 0 || draws <= 0) return 0;
  if (inDraw - mine < draws) return 1;
  // None of yours drawn: C(S−m, P) / C(S, P), one draw at a time.
  let none = 1;
  for (let i = 0; i < draws; i++) none *= (inDraw - mine - i) / (inDraw - i);
  return 1 - none;
}

/** Chance that 1. premie (and with it next week's round) lands on one of yours. */
export function chanceOfFirst(mine: number, inDraw: number): number {
  return inDraw > 0 ? Math.min(1, Math.max(0, mine) / inDraw) : 0;
}

/** "31 %" - never "0 %" or "100 %" for a chance that is neither. */
export function percent(p: number): string {
  if (p >= 1) return "100 %";
  if (p <= 0) return "0 %";
  const n = Math.round(p * 100);
  if (n < 1) return "under 1 %";
  if (n > 99) return "over 99 %";
  return `${n} %`;
}

import { describe, expect, it } from "vitest";
import { buildPersonWrap, buildYearWrap, tastingNote, type WrapRound } from "./wrapped";
import { joinNames } from "./wrapped-shared";
import { cell, draw, prize, round } from "./testFactories";

/** One round: `buyers` are [name, row, col]; `winners` are [name, row, col] in draw order. */
function wr(
  id: number,
  opts: {
    buyers: [string, number, number][];
    winners?: [string, number, number][];
    organizer?: string;
    carried?: number;
    polet?: number;
    prices?: (number | null)[];
  },
): WrapRound {
  const prizes = (opts.prices ?? (opts.winners ?? []).map(() => null)).map((price, i) =>
    prize({ id: id * 100 + i, round_id: id, rank: i + 1, price, name: `Vin ${i + 1}` }),
  );
  return {
    round: round({
      id,
      status: "settled",
      ticket_price: 20,
      grid_size: 6,
      organizer_name: opts.organizer ?? "",
      carried_over: opts.carried ?? 0,
      polet_cost: opts.polet ?? 0,
    }),
    cells: opts.buyers.map(([name, row, col], i) =>
      cell({ id: id * 100 + i, round_id: id, row, col, status: "sold", paid: 1, buyer_name: name, buyer_name_norm: name.toLowerCase() }),
    ),
    draws: (opts.winners ?? []).map(([name, row, col], i) =>
      draw({ id: id * 100 + i, round_id: id, rank: i + 1, row, col, winner_name: name, prize_id: prizes[i]?.id ?? null }),
    ),
    prizes,
  };
}

const year = [
  wr(1, {
    buyers: [["Ada", 1, 1], ["Ada", 1, 2], ["Bo", 2, 2], ["Cy", 3, 3]],
    winners: [["Ada", 1, 1], ["Bo", 2, 2]],
    organizer: "Cy",
    carried: 100,
    polet: 60,
  }),
  wr(2, { buyers: [["Ada", 1, 1], ["Bo", 2, 2], ["Cy", 3, 3]], winners: [["Bo", 2, 2]], organizer: "Ada", polet: 50 }),
  wr(3, { buyers: [["Ada", 1, 1], ["Cy", 3, 3]], winners: [["Ada", 1, 1]], organizer: "Bo", polet: 40 }),
];

describe("buildYearWrap", () => {
  const w = buildYearWrap(2025, year, new Set(["ada"]));

  it("counts the year", () => {
    expect(w).toMatchObject({ rounds: 3, lodd: 9, people: 3, bottles: 4, newFaces: 2 });
  });

  it("shares a record between ties", () => {
    // Ada was drawn first twice (rounds 1 and 3), Bo once.
    expect(w.crown).toEqual({ names: ["Ada"], value: 2 });
    expect(w.regular).toEqual({ names: ["Ada", "Cy"], value: 3 });
  });

  it("finds the hottest square and the one bought most without a win", () => {
    expect(w.hottest).toMatchObject({ row: 1, col: 1, wins: 2 });
    expect(w.coldest).toMatchObject({ row: 3, col: 3, sold: 3, wins: 0 });
  });

  it("names the optimist and the longest dry spell", () => {
    expect(w.optimist).toEqual({ names: ["Cy"], value: 3 });
    expect(w.drought).toEqual({ names: ["Cy"], value: 3 });
  });

  it("follows the organiser relay in order", () => {
    expect(w.relay).toEqual(["Cy", "Ada", "Bo"]);
  });

  it("makes the money add up from the first round to the last", () => {
    // 100 in, 9 lodd × 20 = 180, Polet 150 -> 130 carried on. The rounds here don't chain, so
    // the last round's own videre (0 + 2×20 − 40 = 0) differs, and the gap shows as an adjustment.
    expect(w.money).toEqual({ start: 100, lodd: 180, polet: 150, end: 0, adjusted: -130 });
  });

  it("skips the cellar when the prizes carry no categories or prices", () => {
    expect(w.cellar).toBeNull();
  });

  it("has no new faces without earlier years", () => {
    expect(buildYearWrap(2025, year, null).newFaces).toBeNull();
  });
});

describe("buildPersonWrap", () => {
  it("tallies one person's year", () => {
    const p = buildPersonWrap("ada", year, new Set(["ada"]))!;
    expect(p).toMatchObject({ name: "Ada", lodd: 4, rounds: 3, wins: 2, firstPrizes: 2, spent: 80, loddRank: 1, isNew: false });
    expect(p.lucky).toMatchObject({ row: 1, col: 1, wins: 2 });
    expect(p.title).toBe("polkongen");
  });

  it("calls someone with plenty of lodd and no wins an optimist", () => {
    const five: [string, number, number][] = [1, 2, 3, 4, 5].map((c) => ["Cy", 4, c]);
    const rounds = [wr(1, { buyers: [...five, ["Ada", 1, 1]], winners: [["Ada", 1, 1]] })];
    expect(buildPersonWrap("Cy", rounds, null)!.title).toBe("optimist");
  });

  it("only values the wins when every won prize has a price", () => {
    expect(buildPersonWrap("Bo", year, null)!.wonWorth).toBeNull();
    const priced = [wr(1, { buyers: [["Bo", 1, 1]], winners: [["Bo", 1, 1]], prices: [149.9] })];
    expect(buildPersonWrap("Bo", priced, null)!.wonWorth).toBe(149.9);
  });

  it("is null for someone who sat the year out", () => {
    expect(buildPersonWrap("Dag", year, null)).toBeNull();
  });
});

describe("texts", () => {
  it("joins names the Norwegian way", () => {
    expect(joinNames(["Ada"])).toBe("Ada");
    expect(joinNames(["Ada", "Bo", "Cy"])).toBe("Ada, Bo og Cy");
  });

  it("writes a tasting note from the numbers", () => {
    expect(tastingNote({ lodd: 3, rounds: 1, wins: 0, firstPrizes: 0, lucky: { row: 2, col: 5, sold: 3, wins: 0 } })).toBe(
      "Lett og frisk, med en tørr finish, og tydelige toner av rute 5-2. Lang ettersmak av én runde.",
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  awaitingChoice,
  currentPhase,
  parseWishes,
  phaseIndex,
  settleCheck,
  skippedWinners,
  unclaimedPrizes,
  wishedPrize,
} from "./phases";
import { cell, draw, prize } from "./testFactories";

describe("currentPhase", () => {
  it("maps each round status to its phase in order", () => {
    expect(currentPhase("draft")).toBe("forbered");
    expect(currentPhase("open")).toBe("selg");
    expect(currentPhase("closed")).toBe("trekk");
    expect(currentPhase("drawn")).toBe("oppgjor");
    expect(currentPhase("settled")).toBe("stafett");
    expect(phaseIndex(currentPhase("closed"))).toBe(2);
  });
});

describe("unclaimedPrizes", () => {
  const prizes = [prize({ id: 1 }), prize({ id: 2 }), prize({ id: 3 })];

  it("removes prizes a winner has picked", () => {
    const draws = [draw({ rank: 1, winner_name: "Kari", prize_id: 2 })];
    expect(unclaimedPrizes(prizes, draws).map((p) => p.id)).toEqual([1, 3]);
  });

  it("ignores draws without a winner or without a chosen prize", () => {
    const draws = [draw({ rank: 1, winner_name: null, prize_id: 1 }), draw({ rank: 2, winner_name: "Ola" })];
    expect(unclaimedPrizes(prizes, draws)).toHaveLength(3);
  });

  it("can leave out the draw that is choosing right now", () => {
    const draws = [draw({ rank: 1, winner_name: "Kari", prize_id: 2 })];
    expect(unclaimedPrizes(prizes, draws, 1)).toHaveLength(3);
  });
});

describe("awaitingChoice", () => {
  it("returns the earliest winner who has not chosen a prize", () => {
    const draws = [
      draw({ id: 3, rank: 3, winner_name: "C" }),
      draw({ id: 1, rank: 1, winner_name: "A", prize_id: 1 }),
      draw({ id: 2, rank: 2, winner_name: "B" }),
    ];
    expect(awaitingChoice(draws)?.rank).toBe(2);
  });

  it("doesn't wait for winners who weren't there (they pick later)", () => {
    const draws = [draw({ rank: 1, winner_name: "A", skipped: 1 }), draw({ rank: 2, winner_name: "B" })];
    expect(awaitingChoice(draws)?.rank).toBe(2);
  });

  it("returns undefined when everyone has chosen", () => {
    expect(awaitingChoice([draw({ winner_name: "A", prize_id: 1 })])).toBeUndefined();
  });
});

describe("settleCheck", () => {
  const prizes = [prize({ id: 1 }), prize({ id: 2 })];
  const allPicked = [
    draw({ rank: 1, winner_name: "A", prize_id: 1 }),
    draw({ rank: 2, winner_name: "B", prize_id: 2 }),
  ];

  it("is ready when every prize is picked and everything is paid", () => {
    const c = settleCheck([cell({ status: "sold", paid: 1 })], prizes, allPicked);
    expect(c).toMatchObject({ drawn: 2, allDrawn: true, ready: true, needsForce: false });
  });

  it("is not ready while a prize is still unclaimed", () => {
    const c = settleCheck([], prizes, allPicked.slice(0, 1));
    expect(c).toMatchObject({ drawn: 1, allDrawn: false, ready: false });
  });

  it("is not ready with no prizes at all", () => {
    expect(settleCheck([], [], []).ready).toBe(false);
  });

  it("needs force when there are unpaid or held cells", () => {
    const unpaid = settleCheck([cell({ status: "sold", paid: 0 })], prizes, allPicked);
    expect(unpaid).toMatchObject({ ready: true, needsForce: true, unpaid: 1 });
    const held = settleCheck([cell({ status: "held" })], prizes, allPicked);
    expect(held).toMatchObject({ ready: true, needsForce: true, held: 1 });
  });
});

describe("skippedWinners", () => {
  it("lists skipped winners who haven't picked yet, in draw order", () => {
    const draws = [
      draw({ rank: 3, winner_name: "C", skipped: 1 }),
      draw({ rank: 1, winner_name: "A", skipped: 1, prize_id: 1 }),
      draw({ rank: 2, winner_name: "B", skipped: 1 }),
      draw({ rank: 4, winner_name: "D" }),
    ];
    expect(skippedWinners(draws).map((d) => d.rank)).toEqual([2, 3]);
  });
});

describe("parseWishes", () => {
  it("reads a JSON list of prize ids and drops anything else", () => {
    expect(parseWishes("[3,1,2]")).toEqual([3, 1, 2]);
    expect(parseWishes('[1,"x",2.5,4]')).toEqual([1, 4]);
  });

  it("is empty for missing or broken data", () => {
    expect(parseWishes(null)).toEqual([]);
    expect(parseWishes("not json")).toEqual([]);
    expect(parseWishes('{"a":1}')).toEqual([]);
  });
});

describe("wishedPrize", () => {
  const prizes = [prize({ id: 1 }), prize({ id: 2 }), prize({ id: 3 })];

  it("picks the most wanted prize that is still left", () => {
    const taken = [draw({ rank: 1, winner_name: "A", prize_id: 3 })];
    expect(wishedPrize(cell({ wishes: "[3,2,1]" }), prizes, taken, 2)).toMatchObject({
      prize: { id: 2 },
      place: 2,
    });
  });

  it("gives nothing when no wish is left or there are no wishes", () => {
    const taken = [draw({ rank: 1, winner_name: "A", prize_id: 1 })];
    expect(wishedPrize(cell({ wishes: "[1]" }), prizes, taken, 2)).toBeUndefined();
    expect(wishedPrize(cell(), prizes, [], 1)).toBeUndefined();
    expect(wishedPrize(undefined, prizes, [], 1)).toBeUndefined();
  });
});

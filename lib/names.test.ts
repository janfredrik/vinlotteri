import { describe, expect, it } from "vitest";
import { buildNameUses, mostRecent, roundDate, sharedRounds } from "./names";
import { cell, draw, round } from "./testFactories";

const rounds = [
  round({ id: 1, title: "Uke 1", created_at: "2026-01-01 18:00:00", organizer_name: "" }),
  round({ id: 2, title: "Uke 2", sales_close_at: "2026-01-09T14:00:00.000Z", organizer_name: "kr" }),
  round({ id: 3, title: "Uke 3", sales_close_at: "2026-01-16T14:00:00.000Z", organizer_name: "" }),
];

describe("buildNameUses", () => {
  const cells = [
    cell({ id: 1, round_id: 1, status: "sold", buyer_name: "KR" }),
    cell({ id: 2, round_id: 1, status: "sold", buyer_name: "KR" }),
    cell({ id: 3, round_id: 2, status: "held", buyer_name: "Kr " }),
    cell({ id: 4, round_id: 3, status: "sold", buyer_name: "Kristin" }),
    cell({ id: 5, round_id: 3, status: "available", buyer_name: "Gammel" }),
  ];
  const draws = [draw({ round_id: 1, winner_name: "KR" })];
  const uses = buildNameUses(rounds, cells, draws);
  const kr = uses.find((u) => u.norm === "kr")!;

  it("folds case and spacing together and keeps the most used spelling", () => {
    expect(kr.name).toBe("KR");
    expect(kr.spellings).toEqual(["KR", "Kr", "kr"]);
  });

  it("counts squares, wins and organised rounds, newest round first", () => {
    expect(kr.lodd).toBe(3);
    expect(kr.wins).toBe(1);
    expect(kr.organized).toBe(1);
    expect(kr.rounds.map((r) => r.id)).toEqual([2, 1]);
  });

  it("ignores free squares", () => {
    expect(uses.find((u) => u.norm === "gammel")).toBeUndefined();
  });

  it("picks the most recently used name", () => {
    expect(mostRecent(uses)?.name).toBe("Kristin");
  });
});

describe("sharedRounds", () => {
  it("flags rounds where more than one of the names bought", () => {
    const uses = buildNameUses(
      rounds,
      [
        cell({ id: 1, round_id: 1, status: "sold", buyer_name: "KR" }),
        cell({ id: 2, round_id: 1, status: "sold", buyer_name: "KRL" }),
        cell({ id: 3, round_id: 2, status: "sold", buyer_name: "KR" }),
      ],
      [],
    );
    expect(sharedRounds(uses)).toEqual([{ id: 1, title: "Uke 1", names: ["KR", "KRL"] }]);
  });

  it("doesn't count organising a round you didn't buy in", () => {
    const uses = buildNameUses(rounds, [cell({ id: 1, round_id: 2, status: "sold", buyer_name: "Kristin" })], []);
    expect(sharedRounds(uses)).toEqual([]);
  });
});

describe("roundDate", () => {
  it("reads SQLite's own timestamps as UTC", () => {
    expect(roundDate({ sales_close_at: null, created_at: "2026-01-01 18:00:00" })).toBe("2026-01-01T18:00:00Z");
  });
});

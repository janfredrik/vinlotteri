import { describe, expect, it } from "vitest";
import { computeMoney } from "./money";
import { cell, prize, round } from "./testFactories";

describe("computeMoney", () => {
  it("counts sold, paid and unpaid cells, ignoring held and available ones", () => {
    const cells = [
      cell({ id: 1, status: "sold", paid: 1 }),
      cell({ id: 2, status: "sold", paid: 0 }),
      cell({ id: 3, status: "sold", paid: 1 }),
      cell({ id: 4, status: "held" }),
      cell({ id: 5, status: "available" }),
    ];
    const m = computeMoney(round({ ticket_price: 20 }), cells, []);
    expect(m.sold).toBe(3);
    expect(m.paidCount).toBe(2);
    expect(m.unpaidCount).toBe(1);
    expect(m.loddSolgt).toBe(60);
  });

  it("uses the sum of prize prices as Polet cost when none is set, rounded once on the total", () => {
    const prizes = [prize({ id: 1, price: 169.9 }), prize({ id: 2, price: 99.9 }), prize({ id: 3, price: null })];
    const m = computeMoney(round({ polet_cost: null }), [], prizes);
    expect(m.poletCostAuto).toBe(true);
    expect(m.poletCost).toBe(270); // 269.8 -> 270, not 170 + 100
  });

  it("uses a manually entered Polet cost when set", () => {
    const m = computeMoney(round({ polet_cost: 250 }), [], [prize({ price: 169.9 })]);
    expect(m.poletCostAuto).toBe(false);
    expect(m.poletCost).toBe(250);
  });

  it("carries over: previous balance + tickets sold − Polet cost", () => {
    const cells = Array.from({ length: 10 }, (_, i) => cell({ id: i + 1, status: "sold", paid: 1 }));
    const m = computeMoney(round({ ticket_price: 20, carried_over: 50, polet_cost: 300 }), cells, []);
    expect(m.videre).toBe(50 + 200 - 300);
  });
});

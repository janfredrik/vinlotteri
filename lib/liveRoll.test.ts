import { describe, expect, it } from "vitest";
import { clearRoll, getLiveRoll, rollDice, settleRoll } from "./liveRoll";

describe("live roll", () => {
  it("keeps one roll while its dice come in, and settles it with the outcome", () => {
    const col = rollDice(901, 1, 4, null);
    const both = rollDice(901, 1, 4, 2);
    expect(both.seq).toBe(col.seq);
    expect(getLiveRoll(901)).toMatchObject({ col: 4, row: 2, outcome: null });

    const done = settleRoll(901, 1, "empty", 4, 2, "physical");
    expect(done.seq).toBe(col.seq);
    expect(getLiveRoll(901)?.outcome).toBe("empty");
  });

  it("starts a new roll after a miss, even with the same numbers", () => {
    const first = rollDice(902, 1, 3, 3);
    settleRoll(902, 1, "taken", 3, 3, "physical");
    const again = rollDice(902, 1, 3, null);
    expect(again.seq).toBeGreaterThan(first.seq);
    expect(again).toMatchObject({ col: 3, row: null, outcome: null });
  });

  it("starts a new roll when a die already shown is dropped (the phone was reloaded)", () => {
    const first = rollDice(907, 1, 5, 2);
    const again = rollDice(907, 1, 1, null);
    expect(again.seq).toBeGreaterThan(first.seq);
  });

  it("gives a digital draw its own roll, with no dice steps first", () => {
    const dice = rollDice(903, 2, 1, 1);
    const digital = settleRoll(903, 2, "winner", 5, 6, "digital");
    expect(digital.seq).toBeGreaterThan(dice.seq);
    expect(digital).toMatchObject({ col: 5, row: 6, outcome: "winner", method: "digital" });
  });

  it("is dropped when its draw is undone, but not for another draw", () => {
    rollDice(904, 3, 2, 2);
    clearRoll(904, 1);
    expect(getLiveRoll(904)).not.toBeNull();
    clearRoll(904, 3);
    expect(getLiveRoll(904)).toBeNull();
  });

  it("keeps rounds apart", () => {
    rollDice(905, 1, 6, null);
    expect(getLiveRoll(906)).toBeNull();
  });
});

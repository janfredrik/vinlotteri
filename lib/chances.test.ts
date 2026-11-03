import { describe, expect, it } from "vitest";
import { chanceOfAnyPrize, chanceOfFirst, percent } from "./chances";

describe("chanceOfAnyPrize", () => {
  it("is one square's share with a single prize", () => {
    expect(chanceOfAnyPrize(1, 36, 1)).toBeCloseTo(1 / 36);
    expect(chanceOfAnyPrize(3, 30, 1)).toBeCloseTo(0.1);
  });

  it("draws without replacement", () => {
    // 1 − C(33,4)/C(36,4) = 1 − 40920/58905
    expect(chanceOfAnyPrize(3, 36, 4)).toBeCloseTo(1 - 40920 / 58905);
  });

  it("is certain when there are fewer other squares than prizes", () => {
    expect(chanceOfAnyPrize(2, 5, 4)).toBe(1);
    expect(chanceOfAnyPrize(3, 3, 4)).toBe(1);
  });

  it("is zero without squares or prizes", () => {
    expect(chanceOfAnyPrize(0, 36, 4)).toBe(0);
    expect(chanceOfAnyPrize(2, 36, 0)).toBe(0);
  });

  it("falls as more squares are sold", () => {
    expect(chanceOfAnyPrize(2, 36, 4)).toBeLessThan(chanceOfAnyPrize(2, 20, 4));
  });
});

describe("chanceOfFirst", () => {
  it("is your share of the squares in the draw", () => {
    expect(chanceOfFirst(3, 24)).toBe(0.125);
    expect(chanceOfFirst(1, 0)).toBe(0);
  });
});

describe("percent", () => {
  it("rounds to whole percent with a space", () => {
    expect(percent(0.3123)).toBe("31 %");
  });

  it("never rounds a real chance to 0 or 100", () => {
    expect(percent(0.004)).toBe("under 1 %");
    expect(percent(0.996)).toBe("over 99 %");
    expect(percent(1)).toBe("100 %");
  });
});

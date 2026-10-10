import { describe, expect, it } from "vitest";
import { makeSeed, seededRolls } from "./draw";

describe("seededRolls", () => {
  it("gives the same rolls for the same seed, so a draw can be verified afterwards", () => {
    expect(seededRolls("abc123", 10)).toEqual(seededRolls("abc123", 10));
  });

  it("gives different rolls for different seeds", () => {
    expect(seededRolls("abc123", 10)).not.toEqual(seededRolls("xyz789", 10));
  });

  it("keeps every roll inside the grid", () => {
    for (const size of [1, 5, 10]) {
      for (const [row, col] of seededRolls(makeSeed(), size, 1000)) {
        expect(row).toBeGreaterThanOrEqual(1);
        expect(row).toBeLessThanOrEqual(size);
        expect(col).toBeGreaterThanOrEqual(1);
        expect(col).toBeLessThanOrEqual(size);
        expect(Number.isInteger(row) && Number.isInteger(col)).toBe(true);
      }
    }
  });

  it("returns the requested number of rolls", () => {
    expect(seededRolls("s", 10)).toHaveLength(400);
    expect(seededRolls("s", 10, 3)).toHaveLength(3);
  });

  it("reaches every square on a 10x10 grid", () => {
    const seen = new Set(seededRolls("coverage", 10, 4000).map(([r, c]) => `${r},${c}`));
    expect(seen.size).toBe(100);
  });
});

describe("makeSeed", () => {
  it("makes url-safe, unique seeds", () => {
    const a = makeSeed();
    expect(a).toMatch(/^[A-Za-z0-9_-]{12}$/);
    expect(makeSeed()).not.toBe(a);
  });
});

import { describe, expect, it } from "vitest";
import { seasonGreeting, shouldNudge } from "./notify";

// Friday 2026-10-16, local time.
const at = (h: number, m: number) => new Date(2026, 9, 16, h, m);
const closeAt = (h: number) => at(h, 0).toISOString();

describe("shouldNudge", () => {
  const base = { sales_close_at: closeAt(14), sold: 17, total: 36 };

  it("nudges at 11 when less than half is sold", () => {
    expect(shouldNudge(base, at(11, 0))).toBe(true);
    expect(shouldNudge(base, at(11, 29))).toBe(true);
  });

  it("stays quiet at half or more", () => {
    expect(shouldNudge({ ...base, sold: 18 }, at(11, 0))).toBe(false);
    expect(shouldNudge({ ...base, total: 0, sold: 0 }, at(11, 0))).toBe(false);
  });

  it("only in the 11:00 window", () => {
    expect(shouldNudge(base, at(10, 59))).toBe(false);
    expect(shouldNudge(base, at(11, 30))).toBe(false);
    expect(shouldNudge(base, at(12, 0))).toBe(false);
  });

  it("only on the day sales close", () => {
    expect(shouldNudge(base, new Date(2026, 9, 15, 11, 0))).toBe(false);
    expect(shouldNudge(base, new Date(2026, 9, 13, 11, 0))).toBe(false);
    expect(shouldNudge({ ...base, sales_close_at: null }, at(11, 0))).toBe(false);
  });

  it("leaves the last hour to the closing reminder, and closed sales alone", () => {
    expect(shouldNudge({ ...base, sales_close_at: closeAt(12) }, at(11, 0))).toBe(false);
    expect(shouldNudge({ ...base, sales_close_at: closeAt(10) }, at(11, 0))).toBe(false);
  });
});

describe("seasonGreeting", () => {
  it("greets with the round's theme", () => {
    expect(seasonGreeting("halloween")).toBe("🎃 Knask eller knep!");
    expect(seasonGreeting("jul")).toBe("🎄 God jul!");
  });

  it("says nothing without a theme", () => {
    expect(seasonGreeting("none")).toBeNull();
    expect(seasonGreeting("auto")).toBeNull();
    expect(seasonGreeting(null)).toBeNull();
  });
});

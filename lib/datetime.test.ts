import { describe, expect, it } from "vitest";
import { atTime, fromLocalInput, isoWeek, nextWeekday, toLocalInput } from "./datetime";

// vitest.config.mts pins TZ to Europe/Oslo.

describe("toLocalInput / fromLocalInput", () => {
  it("round-trips through the datetime-local format in local time", () => {
    const iso = "2026-10-09T12:30:00.000Z";
    expect(toLocalInput(iso)).toBe("2026-10-09T14:30"); // CEST, UTC+2
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
  });

  it("handles empty and invalid input", () => {
    expect(toLocalInput(null)).toBe("");
    expect(toLocalInput("not a date")).toBe("");
    expect(fromLocalInput("")).toBeNull();
    expect(fromLocalInput("not a date")).toBeNull();
  });
});

describe("nextWeekday", () => {
  it("finds the next given weekday, never today", () => {
    const thursday = new Date(2026, 9, 8, 15, 0);
    expect(nextWeekday(5, thursday)).toEqual(new Date(2026, 9, 9)); // Friday
    expect(nextWeekday(4, thursday)).toEqual(new Date(2026, 9, 15)); // next Thursday
  });
});

describe("atTime", () => {
  it("sets a local time of day on a date", () => {
    expect(atTime(new Date(2026, 9, 9), 14, 30)).toBe("2026-10-09T12:30:00.000Z");
  });
});

describe("isoWeek", () => {
  it("follows ISO-8601 week numbering, including year boundaries", () => {
    expect(isoWeek(new Date(2026, 9, 8))).toBe(41);
    expect(isoWeek(new Date(2026, 0, 1))).toBe(1); // Thursday
    expect(isoWeek(new Date(2021, 0, 3))).toBe(53); // Sunday, belongs to 2020-W53
    expect(isoWeek(new Date(2024, 11, 30))).toBe(1); // Monday, 2025-W01
  });
});

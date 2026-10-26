import { describe, expect, it } from "vitest";
import { atTime, fromLocalInput, isoWeek, isoWeekYear, nextWeekday, roundYear, toLocalInput } from "./datetime";

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

describe("isoWeekYear", () => {
  it("pairs the week with its ISO year, not the calendar year", () => {
    expect(isoWeekYear(new Date(2026, 11, 25))).toEqual({ week: 52, year: 2026 });
    expect(isoWeekYear(new Date(2027, 0, 1))).toEqual({ week: 53, year: 2026 }); // Friday
    expect(isoWeekYear(new Date(2027, 0, 8))).toEqual({ week: 1, year: 2027 });
    expect(isoWeekYear(new Date(2024, 11, 30))).toEqual({ week: 1, year: 2025 });
  });
});

describe("roundYear", () => {
  it("uses the year sales close, so a December setup for a January draw counts for January", () => {
    const friday = atTime(new Date(2027, 0, 8), 15, 0);
    expect(roundYear({ created_at: "2026-12-18 15:20:00", sales_close_at: friday })).toBe(2027);
  });

  it("reads the closing time in local time, not UTC", () => {
    // 00:30 on 1 Jan in Oslo is still 2026 in UTC.
    expect(roundYear({ created_at: "2026-12-30 10:00:00", sales_close_at: "2026-12-31T23:30:00.000Z" })).toBe(2027);
  });

  it("falls back to created_at without a closing time (imported history)", () => {
    expect(roundYear({ created_at: "2025-09-05T12:00:00.000Z", sales_close_at: null })).toBe(2025);
    expect(roundYear({ created_at: "2026-10-09 13:16:53", sales_close_at: null })).toBe(2026);
  });
});

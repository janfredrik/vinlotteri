import { describe, expect, it } from "vitest";
import { cleanMeName } from "./me-shared";

describe("cleanMeName", () => {
  it("trims and collapses spaces in the profile name", () => {
    expect(cleanMeName("  Ola   N ")).toBe("Ola N");
  });

  it("caps the length", () => {
    expect(cleanMeName("x".repeat(100))).toHaveLength(40);
  });

  it("is null for empty or non-text values", () => {
    expect(cleanMeName("   ")).toBeNull();
    expect(cleanMeName(undefined)).toBeNull();
    expect(cleanMeName(42)).toBeNull();
  });
});

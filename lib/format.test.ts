import { describe, expect, it } from "vitest";
import { formatPrice, gridLabel, initials, kr, NAME_DISPLAY_MAX, normName } from "./format";

describe("gridLabel", () => {
  it("trims and cuts names to fit a grid square", () => {
    expect(gridLabel("  Kari  ")).toBe("Kari");
    expect(gridLabel("Bartholomew")).toBe("Barthol");
    expect(gridLabel("Bartholomew")).toHaveLength(NAME_DISPLAY_MAX);
  });

  it("returns null for empty names", () => {
    expect(gridLabel(null)).toBeNull();
    expect(gridLabel(undefined)).toBeNull();
    expect(gridLabel("")).toBeNull();
  });
});

describe("gridLabel with emoji", () => {
  it("cuts by characters, never in the middle of an emoji", () => {
    expect(gridLabel("Kari🍷🍷🍷🍷")).toBe("Kari🍷🍷🍷");
  });
});

describe("formatPrice", () => {
  it("uses a decimal comma and two decimals only when needed", () => {
    expect(formatPrice(169.9)).toBe("169,90");
    expect(formatPrice(170)).toBe("170");
  });
});

describe("kr", () => {
  it("uses a real minus sign for negative amounts", () => {
    expect(kr(119)).toBe("kr 119");
    expect(kr(-70)).toBe("kr −70");
    expect(kr(0)).toBe("kr 0");
  });
});

describe("normName", () => {
  it("ignores case and extra spaces, so one person is one name", () => {
    expect(normName("  Ola   N ")).toBe("ola n");
    expect(normName("ØYVIND")).toBe(normName("øyvind"));
    expect(normName("")).toBe("");
  });
});

describe("initials", () => {
  it("keeps short names as they are, in capitals", () => {
    expect(initials("JF")).toBe("JF");
    expect(initials("ef")).toBe("EF");
    expect(initials("ÆØÅ")).toBe("ÆØÅ");
  });

  it("uses the first letter of the first two words", () => {
    expect(initials("Per H")).toBe("PH");
    expect(initials("Ola  Nordmann Hansen")).toBe("ON");
    expect(initials("Nora")).toBe("N");
  });

  it("reads joined-up names by their capitals", () => {
    expect(initials("OlaN")).toBe("ON");
    expect(initials("KariAnne")).toBe("KA");
    expect(initials("åseØ")).toBe("ÅØ");
  });

  it("shows a question mark for an empty name", () => {
    expect(initials("   ")).toBe("?");
  });
});

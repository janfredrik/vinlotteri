import { describe, expect, it } from "vitest";
import { removeBackground } from "./cutout";
import { largeImage, vinmonopoletImage } from "./vinmonopolet";

const WHITE = [255, 255, 255];
const WINE = [120, 20, 50];

/** A w×h RGBA image from rows of "." (white) and "#" (wine). */
function image(rows: string[]) {
  const px = new Uint8Array(rows.length * rows[0].length * 4);
  rows.join("").split("").forEach((ch, i) => px.set([...(ch === "#" ? WINE : WHITE), 255], i * 4));
  return { px, w: rows[0].length, h: rows.length };
}
const alpha = (px: Uint8Array, w: number, x: number, y: number) => px[(y * w + x) * 4 + 3];

describe("removeBackground", () => {
  it("clears the white around the bottle and keeps the bottle", () => {
    const { px, w, h } = image([".....", ".###.", ".###.", "....."]);
    removeBackground(px, w, h);
    expect(alpha(px, w, 0, 0)).toBe(0);
    expect(alpha(px, w, 4, 3)).toBe(0);
    expect(alpha(px, w, 2, 1)).toBe(255);
    expect([...px.slice((1 * w + 2) * 4, (1 * w + 2) * 4 + 3)]).toEqual(WINE);
  });

  it("keeps white enclosed by the bottle, like a label", () => {
    const { px, w, h } = image([".....", ".###.", ".#.#.", ".###.", "....."]);
    removeBackground(px, w, h);
    expect(alpha(px, w, 2, 2)).toBe(255);
  });

  it("softens a pale rim instead of leaving a white halo", () => {
    const { px, w, h } = image(["...", ".#.", "..."]);
    px.set([230, 225, 228, 255], (1 * w + 1) * 4); // almost white, but not backdrop-grey
    removeBackground(px, w, h);
    const a = alpha(px, w, 1, 1);
    expect(a).toBeGreaterThan(0);
    expect(a).toBeLessThan(255);
  });
});

describe("Polet image URLs", () => {
  it("go through the cutout route, and grow for the big view", () => {
    const src = vinmonopoletImage("20501602")!;
    expect(src).toBe("/api/polet-bilde/20501602?s=300x300-0");
    expect(largeImage(src)).toBe("/api/polet-bilde/20501602?s=1200x1200-0");
  });

  it("still enlarge an old direct link", () => {
    expect(largeImage("https://bilder.vinmonopolet.no/cache/300x300-0/1-1.jpg")).toBe(
      "https://bilder.vinmonopolet.no/cache/1200x1200-0/1-1.jpg",
    );
  });
});

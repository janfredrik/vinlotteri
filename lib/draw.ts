import { createHash, randomBytes } from "node:crypto";

export function makeSeed(): string {
  return randomBytes(9).toString("base64url");
}

function mulberry32(seedInt: number) {
  let a = seedInt >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic sequence of dice rolls from a seed. Verifiable after the fact. */
export function seededRolls(seed: string, gridSize: number, count = 400): [number, number][] {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  const rng = mulberry32(parseInt(hex, 16));
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    out.push([1 + Math.floor(rng() * gridSize), 1 + Math.floor(rng() * gridSize)]);
  }
  return out;
}

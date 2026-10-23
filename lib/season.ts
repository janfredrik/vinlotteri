// Seasonal themes for the buyer page. A round stores "auto" (pick by the draw date), "none", or
// one season by name; the page resolves that to a season and styles itself from it.

export type Season = "jul" | "paske" | "17mai" | "sommer" | "halloween";
export type ThemeSetting = "auto" | "none" | Season;

export const SEASONS: { id: Season; label: string; emoji: string; greeting: string; particles: string[] }[] = [
  { id: "jul", label: "Jul", emoji: "🎄", greeting: "God jul!", particles: ["❄️", "❄️", "✨"] },
  { id: "paske", label: "Påske", emoji: "🐣", greeting: "God påske!", particles: ["🐣", "🌼", "🥚"] },
  { id: "17mai", label: "17. mai", emoji: "🇳🇴", greeting: "Hipp hipp hurra!", particles: ["🇳🇴", "🎈", "🌭"] },
  { id: "sommer", label: "Sommer", emoji: "☀️", greeting: "God sommer!", particles: ["🍓", "☀️", "🌸"] },
  // Only by hand: seasonFor never picks it, so "auto" stays as it was.
  { id: "halloween", label: "Halloween", emoji: "🎃", greeting: "Knask eller knep!", particles: ["🎃", "🦇", "👻"] },
];

export const THEME_SETTINGS: ThemeSetting[] = ["auto", "none", ...SEASONS.map((s) => s.id)];

export const isThemeSetting = (v: unknown): v is ThemeSetting =>
  typeof v === "string" && (THEME_SETTINGS as string[]).includes(v);

export const seasonInfo = (s: Season) => SEASONS.find((x) => x.id === s)!;

/** Easter Sunday (Gregorian, anonymous algorithm), as a local date. */
function easter(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

const DAY = 86_400_000;

/** The season a date falls in, if any. */
export function seasonFor(date: Date): Season | null {
  const y = date.getFullYear();
  const md = (date.getMonth() + 1) * 100 + date.getDate();
  if (md >= 1201 || md <= 106) return "jul";
  const sunday = easter(y).getTime();
  const day = new Date(y, date.getMonth(), date.getDate()).getTime();
  if (day >= sunday - 14 * DAY && day <= sunday + DAY) return "paske"; // to uker før til 2. påskedag
  if (md >= 510 && md <= 517) return "17mai";
  if (md >= 615 && md <= 815) return "sommer";
  return null;
}

/** The season a round shows. "auto" goes by when the draw is (sales close), else today. */
export function resolveSeason(theme: string | null | undefined, drawAt: string | null, now = new Date()): Season | null {
  if (theme === "none") return null;
  if (theme && theme !== "auto" && isThemeSetting(theme)) return theme as Season;
  const when = drawAt ? new Date(drawAt) : now;
  return seasonFor(Number.isNaN(when.getTime()) ? now : when);
}

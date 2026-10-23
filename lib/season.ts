// Seasonal themes for the buyer page. A round stores "none" or one season by name, picked by hand
// in the admin; the page styles itself from it.

export type Season = "jul" | "paske" | "halloween";
export type ThemeSetting = "none" | Season;

export const SEASONS: { id: Season; label: string; emoji: string; greeting: string; particles: string[] }[] = [
  { id: "jul", label: "Jul", emoji: "🎄", greeting: "God jul!", particles: ["❄️", "❄️", "✨"] },
  { id: "paske", label: "Påske", emoji: "🐣", greeting: "God påske!", particles: ["🐣", "🌼", "🥚"] },
  { id: "halloween", label: "Halloween", emoji: "🎃", greeting: "Knask eller knep!", particles: ["🎃", "🦇", "👻"] },
];

export const THEME_SETTINGS: ThemeSetting[] = ["none", ...SEASONS.map((s) => s.id)];

export const isThemeSetting = (v: unknown): v is ThemeSetting =>
  typeof v === "string" && (THEME_SETTINGS as string[]).includes(v);

export const seasonInfo = (s: Season) => SEASONS.find((x) => x.id === s)!;

/** The season this browser turned off on the buyer page. Only that one: the next season shows again. */
export const SEASON_OFF_COOKIE = "vl_season_off";

export const cleanSeasonOff = (v: string | undefined | null): Season | null =>
  SEASONS.some((s) => s.id === v) ? (v as Season) : null;

/** The season a round shows, if any. Anything that isn't a season (old "auto", removed seasons) is none. */
export function roundSeason(theme: string | null | undefined): Season | null {
  return SEASONS.some((s) => s.id === theme) ? (theme as Season) : null;
}

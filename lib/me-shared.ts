/** "Who am I" on this device: just a buyer name, no password. Squares bought in that
 *  name count as yours on every device that picks it. Shared by server and client. */
export const ME_COOKIE = "vl_me";
/** Fired on window whenever the profile changes, so the header and the round view follow along. */
export const ME_EVENT = "vl-me";

const ME_MAX = 40;

export function cleanMeName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/\s+/g, " ").slice(0, ME_MAX);
  return t || null;
}

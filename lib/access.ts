// Site-wide access gate. One shared PIN (SITE_PIN) unlocks everything, including
// /admin — whoever is trusted with the PIN can also run rounds (they arrange the
// next one if they win). No PIN set = open (fine for local dev).

import { PinThrottle, clientIp } from "./throttle";

const SITE_PIN = (process.env.SITE_PIN || "").trim();

/** Gate is active unless SITE_PIN is empty or explicitly "off". */
export const GATE_ON = SITE_PIN.length > 0 && SITE_PIN.toLowerCase() !== "off";

/** A second PIN for /superadmin: the switches only the one running the lottery should touch
 *  (releasing the year in review, merging names, correcting history). Unset = /superadmin is
 *  closed, except on a local site without SITE_PIN, where it is open like everything else. */
const SUPER_PIN = (process.env.SUPERADMIN_PIN || "").trim();
export const SUPER_COOKIE = "vl_super";

export const ACCESS_COOKIE = "vl_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, salt: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return b64url(await crypto.subtle.sign("HMAC", key, enc.encode(salt)));
}

let cachedToken: Promise<string> | undefined;
let cachedSuper: Promise<string> | undefined;

/** The value we store in the access cookie: HMAC(SITE_PIN, salt). One-way, so it
 *  can't be reversed to the PIN, and can't be forged without the PIN. */
export function accessToken(): Promise<string> {
  return (cachedToken ??= hmac(SITE_PIN, "vl-access-v1"));
}

/** The superadmin cookie, made the same way from SUPERADMIN_PIN. */
export function superToken(): Promise<string> {
  return (cachedSuper ??= hmac(SUPER_PIN, "vl-super-v1"));
}

export function pinMatches(pin: string): boolean {
  return GATE_ON && typeof pin === "string" && pin === SITE_PIN;
}

// One brake shared by the proxy (?k=) and /api/access. They run in the same
// Node process but may be bundled separately, so the instance lives on globalThis.
const g = globalThis as typeof globalThis & { __vlPinThrottle?: PinThrottle };
const g2 = g as typeof g & { __vlSuperThrottle?: PinThrottle };
const throttle = (g.__vlPinThrottle ??= new PinThrottle());
const superThrottle = (g2.__vlSuperThrottle ??= new PinThrottle());

export type PinResult = { ok: true } | { ok: false; retryAfter: number };

/** Checks a PIN attempt through the brute-force brake. `retryAfter` (seconds) is 0 for
 *  a plain wrong PIN and above 0 when the caller is locked out (the PIN is not even checked). */
export function tryPin(pin: string, headers: Headers): PinResult {
  return attempt(throttle, pinMatches(pin), "access", headers);
}

/** Same as tryPin, for SUPERADMIN_PIN, with a brake of its own. */
export function trySuperPin(pin: string, headers: Headers): PinResult {
  return attempt(superThrottle, SUPER_PIN.length > 0 && typeof pin === "string" && pin === SUPER_PIN, "superadmin", headers);
}

function attempt(brake: PinThrottle, matches: boolean, tag: string, headers: Headers): PinResult {
  const ip = clientIp(headers);
  const wait = brake.wait(ip);
  if (wait > 0) {
    console.warn(`[${tag}] ${ip} er sperret i ${wait} s`);
    return { ok: false, retryAfter: wait };
  }
  if (matches) {
    brake.hit(ip);
    return { ok: true };
  }
  const misses = brake.miss(ip);
  console.warn(`[${tag}] Feil PIN fra ${ip} (${misses} på rad)`);
  return { ok: false, retryAfter: brake.wait(ip) };
}

export async function hasAccess(cookieValue: string | undefined | null): Promise<boolean> {
  if (!GATE_ON) return true;
  if (!cookieValue) return false;
  return cookieValue === (await accessToken());
}

/** Whether /superadmin can be unlocked at all. */
export const SUPER_ON = SUPER_PIN.length > 0;

export async function hasSuper(cookieValue: string | undefined | null): Promise<boolean> {
  if (!SUPER_ON) return !GATE_ON;
  if (!cookieValue) return false;
  return cookieValue === (await superToken());
}

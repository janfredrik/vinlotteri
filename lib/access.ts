// Site-wide access gate. One shared PIN (SITE_PIN) unlocks everything, including
// /admin — whoever is trusted with the PIN can also run rounds (they arrange the
// next one if they win). No PIN set = open (fine for local dev).

const SITE_PIN = (process.env.SITE_PIN || "").trim();

/** Gate is active unless SITE_PIN is empty or explicitly "off". */
export const GATE_ON = SITE_PIN.length > 0 && SITE_PIN.toLowerCase() !== "off";

export const ACCESS_COOKIE = "vl_access";
export const ACCESS_MAX_AGE = 60 * 60 * 24 * 60; // 60 days

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

let cachedToken: Promise<string> | undefined;

/** The value we store in the access cookie: HMAC(SITE_PIN, salt). One-way, so it
 *  can't be reversed to the PIN, and can't be forged without the PIN. */
export function accessToken(): Promise<string> {
  if (!cachedToken) {
    cachedToken = (async () => {
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey(
        "raw",
        enc.encode(SITE_PIN),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const sig = await crypto.subtle.sign("HMAC", key, enc.encode("vl-access-v1"));
      return b64url(sig);
    })();
  }
  return cachedToken;
}

export function pinMatches(pin: string): boolean {
  return GATE_ON && typeof pin === "string" && pin === SITE_PIN;
}

export async function hasAccess(cookieValue: string | undefined | null): Promise<boolean> {
  if (!GATE_ON) return true;
  if (!cookieValue) return false;
  return cookieValue === (await accessToken());
}

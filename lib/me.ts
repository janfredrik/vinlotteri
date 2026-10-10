import { useEffect, useState } from "react";
import { ME_COOKIE, ME_EVENT, cleanMeName } from "./me-shared";

export { ME_EVENT };

function readCookie(): string | null {
  const hit = document.cookie.split("; ").find((c) => c.startsWith(`${ME_COOKIE}=`));
  if (!hit) return null;
  try {
    return cleanMeName(decodeURIComponent(hit.slice(ME_COOKIE.length + 1)));
  } catch {
    return null;
  }
}

/** The current profile. `undefined` until the cookie has been read on the client
 *  (unless the server already told us via `initial`). */
export function useMe(initial?: string | null): string | null | undefined {
  const [me, setMe] = useState<string | null | undefined>(initial);
  useEffect(() => {
    const sync = () => setMe(readCookie());
    sync();
    window.addEventListener(ME_EVENT, sync);
    return () => window.removeEventListener(ME_EVENT, sync);
  }, []);
  return me;
}

/** Pick (or with null, forget) the profile on this device. */
export async function chooseMe(name: string | null): Promise<string | null> {
  const r = await fetch("/api/me", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || "Noe gikk galt.");
  window.dispatchEvent(new Event(ME_EVENT));
  return data.me ?? null;
}

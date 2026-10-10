// Brute-force brake for the shared PIN. Each IP gets a few free misses, then has to
// wait (doubling per miss). A global cap on misses per day catches attacks spread
// over many IPs, or forged IP headers from someone hitting the origin directly.
// Tuned so a 4-digit PIN takes ~50 days on average to guess, 6 digits ~14 years.
// In memory only: a container restart resets it, which an attacker can't trigger.

export const FREE_MISSES = 3;
const BASE_WAIT_MS = 5 * 60_000; // 5 min on the miss that uses up the free ones
const MAX_WAIT_MS = 24 * 60 * 60_000; // never more than a day
const FORGET_MS = 7 * 24 * 60 * 60_000; // an IP's misses are forgotten after a quiet week (must exceed MAX_WAIT_MS)
export const GLOBAL_MISSES = 100;
const GLOBAL_WINDOW_MS = 24 * 60 * 60_000;

type Entry = { misses: number; until: number; last: number };

export class PinThrottle {
  private ips = new Map<string, Entry>();
  private recent: number[] = [];

  constructor(private now: () => number = Date.now) {}

  /** Seconds the caller must wait before trying again, or 0 if a try is allowed. */
  wait(ip: string): number {
    const t = this.now();
    this.recent = this.recent.filter((at) => at > t - GLOBAL_WINDOW_MS);
    let until = this.recent.length >= GLOBAL_MISSES ? this.recent[0] + GLOBAL_WINDOW_MS : 0;
    const e = this.entry(ip, t);
    if (e) until = Math.max(until, e.until);
    return until > t ? Math.ceil((until - t) / 1000) : 0;
  }

  /** Records a wrong PIN. Returns how many misses in a row this IP has now. */
  miss(ip: string): number {
    const t = this.now();
    this.recent.push(t);
    const e = this.entry(ip, t) ?? { misses: 0, until: 0, last: t };
    e.misses += 1;
    e.last = t;
    if (e.misses >= FREE_MISSES) {
      e.until = t + Math.min(BASE_WAIT_MS * 2 ** (e.misses - FREE_MISSES), MAX_WAIT_MS);
    }
    this.ips.set(ip, e);
    if (this.ips.size > 10_000) this.prune(t);
    return e.misses;
  }

  /** A correct PIN clears the IP's record (not the global count). */
  hit(ip: string): void {
    this.ips.delete(ip);
  }

  private entry(ip: string, t: number): Entry | undefined {
    const e = this.ips.get(ip);
    if (e && e.last < t - FORGET_MS) {
      this.ips.delete(ip);
      return undefined;
    }
    return e;
  }

  private prune(t: number) {
    for (const [ip, e] of this.ips) if (e.last < t - FORGET_MS && e.until < t) this.ips.delete(ip);
  }
}

/** Best guess at the real client behind Cloudflare → SWAG. Only a key for the brake —
 *  it can be forged by anyone reaching the app without Cloudflare, hence the global cap. */
export function clientIp(headers: Headers): string {
  const cf = headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf;
  const real = headers.get("x-real-ip")?.trim();
  if (real) return real;
  const fwd = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || "ukjent";
}

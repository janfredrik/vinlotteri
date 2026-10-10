import { describe, expect, it } from "vitest";
import { FREE_MISSES, GLOBAL_MISSES, PinThrottle, clientIp } from "./throttle";

function clock() {
  let t = 1_000_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("PinThrottle", () => {
  it("lets an IP miss a few times before it has to wait", () => {
    const c = clock();
    const th = new PinThrottle(c.now);
    for (let i = 0; i < FREE_MISSES - 1; i++) {
      expect(th.wait("a")).toBe(0);
      th.miss("a");
    }
    expect(th.wait("a")).toBe(0);
    th.miss("a");
    expect(th.wait("a")).toBe(300);
    expect(th.wait("b")).toBe(0); // other IPs are unaffected
  });

  it("doubles the wait for every further miss, capped at a day", () => {
    const c = clock();
    const th = new PinThrottle(c.now);
    const waits: number[] = [];
    for (let i = 0; i < FREE_MISSES + 11; i++) {
      c.advance(th.wait("a") * 1000);
      th.miss("a");
      waits.push(th.wait("a"));
    }
    expect(waits.slice(FREE_MISSES - 1)).toEqual([
      300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 76800, 86400, 86400, 86400,
    ]);
  });

  it("clears an IP after a correct PIN", () => {
    const th = new PinThrottle(clock().now);
    for (let i = 0; i < FREE_MISSES; i++) th.miss("a");
    th.hit("a");
    expect(th.wait("a")).toBe(0);
  });

  it("forgets old misses after a quiet week", () => {
    const c = clock();
    const th = new PinThrottle(c.now);
    for (let i = 0; i < FREE_MISSES - 1; i++) th.miss("a");
    c.advance(8 * 24 * 60 * 60_000);
    th.miss("a");
    expect(th.wait("a")).toBe(0);
  });

  it("locks everyone out when too many misses come from many IPs", () => {
    const c = clock();
    const th = new PinThrottle(c.now);
    for (let i = 0; i < GLOBAL_MISSES; i++) th.miss(`ip${i}`);
    expect(th.wait("fresh")).toBe(86400);
    c.advance(24 * 60 * 60_000);
    expect(th.wait("fresh")).toBe(0);
  });
});

describe("clientIp", () => {
  it("prefers Cloudflare's header, then the proxy's", () => {
    expect(clientIp(new Headers({ "cf-connecting-ip": "1.1.1.1", "x-real-ip": "2.2.2.2" }))).toBe("1.1.1.1");
    expect(clientIp(new Headers({ "x-real-ip": "2.2.2.2" }))).toBe("2.2.2.2");
    expect(clientIp(new Headers({ "x-forwarded-for": "3.3.3.3, 4.4.4.4" }))).toBe("3.3.3.3");
    expect(clientIp(new Headers())).toBe("ukjent");
  });
});

import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_COOKIE,
  ACCESS_MAX_AGE,
  GATE_ON,
  accessToken,
  hasAccess,
  tryPin,
} from "@/lib/access";

export const config = {
  // Proxy always runs on Node, so process.env.SITE_PIN is read at runtime, not inlined at build.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|manifest.webmanifest|sw.js|icons/|robots.txt|apne|api/access).*)"],
};

// No `secure` flag: the app is also reachable on the plain-HTTP port behind SWAG,
// and the token is an HMAC (not the PIN itself), httpOnly and sameSite=lax.
const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: ACCESS_MAX_AGE,
};

export async function proxy(req: NextRequest) {
  if (!GATE_ON) return NextResponse.next();

  const url = req.nextUrl;

  const access = await hasAccess(req.cookies.get(ACCESS_COOKIE)?.value);

  // Magic link: /whatever?k=<pin> sets the cookie and drops the param. Goes through
  // the same brute-force brake as /apne; a wrong or locked-out k lands on /apne.
  const k = url.searchParams.get("k");
  let retryAfter = 0;
  if (k !== null) {
    url.searchParams.delete("k");
    if (access) return NextResponse.redirect(url);
    const result = tryPin(k, req.headers);
    if (result.ok) {
      const res = NextResponse.redirect(url);
      res.cookies.set(ACCESS_COOKIE, await accessToken(), COOKIE_OPTS);
      return res;
    }
    retryAfter = result.retryAfter;
  }

  if (access) return NextResponse.next();

  if (url.pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Krever tilgangs-PIN." }, { status: 401 });
  }

  const unlock = new URL("/apne", req.url);
  unlock.searchParams.set("next", url.pathname + url.search);
  if (retryAfter > 0) unlock.searchParams.set("vent", String(retryAfter));
  return NextResponse.redirect(unlock);
}

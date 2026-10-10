import { NextResponse } from "next/server";
import { ACCESS_COOKIE, ACCESS_MAX_AGE, accessToken, tryPin } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const result = tryPin(String(body.pin ?? ""), req.headers);
  if (!result.ok) {
    if (result.retryAfter > 0) {
      return NextResponse.json(
        { error: "For mange feil forsøk.", retryAfter: result.retryAfter },
        { status: 429, headers: { "Retry-After": String(result.retryAfter) } },
      );
    }
    return NextResponse.json({ error: "Feil PIN." }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, await accessToken(), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_MAX_AGE,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ACCESS_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

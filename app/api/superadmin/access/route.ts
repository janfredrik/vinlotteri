import { NextResponse } from "next/server";
import { ACCESS_MAX_AGE, SUPER_COOKIE, superToken, trySuperPin } from "@/lib/access";
import { guardAccess } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const result = trySuperPin(String(body.pin ?? ""), req.headers);
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
  res.cookies.set(SUPER_COOKIE, await superToken(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: ACCESS_MAX_AGE });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPER_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}

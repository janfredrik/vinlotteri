import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, SUPER_COOKIE, hasAccess, hasSuper } from "./access";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Backstop for the admin API routes — the proxy already gates them, this is
 *  defence in depth in case a request somehow bypasses it. */
export async function guardAccess(): Promise<NextResponse | null> {
  const store = await cookies();
  if (await hasAccess(store.get(ACCESS_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "Krever tilgangs-PIN." }, { status: 401 });
}

/** For /superadmin pages: does this visitor hold the superadmin cookie? */
export async function isSuper(): Promise<boolean> {
  return hasSuper((await cookies()).get(SUPER_COOKIE)?.value);
}

/** For the /api/superadmin routes: the site PIN is not enough, they need the superadmin cookie. */
export async function guardSuper(): Promise<NextResponse | null> {
  const store = await cookies();
  if (!(await hasAccess(store.get(ACCESS_COOKIE)?.value))) return NextResponse.json({ error: "Krever tilgangs-PIN." }, { status: 401 });
  if (await hasSuper(store.get(SUPER_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "Krever superadmin-PIN." }, { status: 403 });
}

export function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

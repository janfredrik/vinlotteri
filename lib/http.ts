import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE, hasAccess } from "./access";

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Backstop for the admin API routes — middleware already gates them, this is
 *  defence in depth in case a request somehow bypasses it. */
export async function guardAccess(): Promise<NextResponse | null> {
  const store = await cookies();
  if (await hasAccess(store.get(ACCESS_COOKIE)?.value)) return null;
  return NextResponse.json({ error: "Krever tilgangs-PIN." }, { status: 401 });
}

export function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

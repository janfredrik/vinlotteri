import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

export const HOLDS_COOKIE = "vl_holds";

export async function readHoldIds(): Promise<number[]> {
  const raw = (await cookies()).get(HOLDS_COOKIE)?.value;
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((x) => Number.isInteger(x)).slice(-30) : [];
  } catch {
    return [];
  }
}

export function writeHoldIds(res: NextResponse, ids: number[]): void {
  res.cookies.set(HOLDS_COOKIE, JSON.stringify(ids.slice(-30)), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 60, // holds don't expire — keep ownership around for the whole round
  });
}

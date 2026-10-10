import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { ME_COOKIE, cleanMeName } from "./me-shared";

export async function readMe(): Promise<string | null> {
  return cleanMeName((await cookies()).get(ME_COOKIE)?.value);
}

export function writeMe(res: NextResponse, name: string | null): void {
  // Readable from JS so the header can show the initials without a round trip.
  res.cookies.set(ME_COOKIE, name ?? "", {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: name ? 60 * 60 * 24 * 365 : 0,
  });
}

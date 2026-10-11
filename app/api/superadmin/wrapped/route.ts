import { NextResponse } from "next/server";
import { badRequest, guardSuper } from "@/lib/http";
import { onWrappedReleased } from "@/lib/notify";
import { FIRST_WRAPPED_YEAR, lastRoundOf, setWrappedReleased, wrappedYears } from "@/lib/wrapped";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guardSuper();
  if (denied) return denied;
  return NextResponse.json({ years: wrappedYears(), first: FIRST_WRAPPED_YEAR });
}

/** Release or withdraw a year's Wrapped: { year: number, released: boolean }. */
export async function POST(req: Request) {
  const denied = await guardSuper();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const year = Number(body.year);
  if (!wrappedYears().some((y) => y.year === year)) return badRequest(`Årgang finnes fra ${FIRST_WRAPPED_YEAR}, for år med trukne runder.`);
  setWrappedReleased(year, !!body.released);
  const last = lastRoundOf(year);
  if (body.released && last != null) onWrappedReleased(last, year);
  return NextResponse.json({ ok: true, years: wrappedYears() });
}

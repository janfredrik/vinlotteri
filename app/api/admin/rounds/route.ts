import { NextResponse } from "next/server";
import { guardAccess } from "@/lib/http";
import { HISTORY_EDIT } from "@/lib/access";
import { createRound, listRoundSummaries, settledYears } from "@/lib/repo";
import { notifyRound } from "@/lib/events";

export const dynamic = "force-dynamic";

/** The rounds in progress and the latest year of settled ones. `?ar=2025` fetches the settled rounds of an older year. */
export async function GET(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const ar = Number(new URL(req.url).searchParams.get("ar"));
  if (ar) return NextResponse.json({ rounds: listRoundSummaries(ar).filter((r) => r.status === "settled") });
  const years = settledYears();
  return NextResponse.json({ rounds: listRoundSummaries(years[0]), years, historyEdit: HISTORY_EDIT });
}

export async function POST(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = createRound(body ?? {});
  notifyRound(id);
  return NextResponse.json({ ok: true, id });
}

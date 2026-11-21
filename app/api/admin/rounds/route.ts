import { NextResponse } from "next/server";
import { guardAccess } from "@/lib/http";
import { historyEdit } from "@/lib/settings";
import { createRound, listRoundSummaries, settledYears } from "@/lib/repo";
import { notifyRound } from "@/lib/events";
import { logAudit } from "@/lib/audit";
import { readMe } from "@/lib/me-cookie";
import { requestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

/** The rounds in progress and the latest year of settled ones. `?ar=2025` fetches the settled rounds of an older year. */
export async function GET(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const ar = Number(new URL(req.url).searchParams.get("ar"));
  if (ar) return NextResponse.json({ rounds: listRoundSummaries(ar).filter((r) => r.status === "settled") });
  const years = settledYears();
  return NextResponse.json({ rounds: listRoundSummaries(years[0]), years, historyEdit: historyEdit() });
}

export async function POST(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = createRound(body ?? {});
  logAudit({ roundId: id, actor: await readMe(), ip: await requestIp(), action: "create", summary: "Opprettet runden" });
  notifyRound(id);
  return NextResponse.json({ ok: true, id });
}

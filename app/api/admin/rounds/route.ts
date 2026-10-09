import { NextResponse } from "next/server";
import { guardAccess } from "@/lib/http";
import { createRound, listRoundSummaries } from "@/lib/repo";
import { notifyRound } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guardAccess();
  if (denied) return denied;
  return NextResponse.json({ rounds: listRoundSummaries() });
}

export async function POST(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const id = createRound(body ?? {});
  notifyRound(id);
  return NextResponse.json({ ok: true, id });
}

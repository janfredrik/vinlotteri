import { NextResponse } from "next/server";
import { guardSuper } from "@/lib/http";
import { historyEdit, setHistoryEdit } from "@/lib/settings";
import { logAudit } from "@/lib/audit";
import { readMe } from "@/lib/me-cookie";
import { requestIp } from "@/lib/request-ip";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guardSuper();
  if (denied) return denied;
  return NextResponse.json({ historyEdit: historyEdit() });
}

/** Flip a switch: { historyEdit: boolean }. */
export async function POST(req: Request) {
  const denied = await guardSuper();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  if (typeof body.historyEdit === "boolean" && body.historyEdit !== historyEdit()) {
    setHistoryEdit(body.historyEdit);
    logAudit({
      roundId: null,
      actor: await readMe(),
      ip: await requestIp(),
      action: "historyEdit",
      summary: `Superadmin slo ${body.historyEdit ? "på" : "av"} retting av historikk`,
    });
  }
  return NextResponse.json({ historyEdit: historyEdit() });
}

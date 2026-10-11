import { NextResponse } from "next/server";
import { guardSuper } from "@/lib/http";
import { historyEdit, setHistoryEdit } from "@/lib/settings";

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
  if (typeof body.historyEdit === "boolean") setHistoryEdit(body.historyEdit);
  return NextResponse.json({ historyEdit: historyEdit() });
}

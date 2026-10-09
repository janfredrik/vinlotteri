import { NextResponse } from "next/server";
import { buildRoundState } from "@/lib/repo";
import { vippsPresentation } from "@/lib/present";
import { readHoldIds } from "@/lib/holds-cookie";
import { num } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = num((await params).id);
  if (id == null) return NextResponse.json({ error: "Ugyldig runde." }, { status: 400 });
  const state = buildRoundState(id, await readHoldIds());
  if (!state) return NextResponse.json({ error: "Runden finnes ikke." }, { status: 404 });
  const vipps = await vippsPresentation(state.round);
  return NextResponse.json({ ...state, vipps });
}

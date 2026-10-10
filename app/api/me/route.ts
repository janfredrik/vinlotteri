import { NextResponse } from "next/server";
import { getActiveRound, getCells, knownBuyerNames } from "@/lib/repo";
import { cleanMeName } from "@/lib/me-shared";
import { readMe, writeMe } from "@/lib/me-cookie";
import { normName } from "@/lib/format";

export const dynamic = "force-dynamic";

/** The profile picker: everyone who has ever bought, this round's buyers first. */
export async function GET() {
  const round = getActiveRound();
  const current = new Set(
    round ? getCells(round.id).flatMap((c) => (c.buyer_name_norm ? [c.buyer_name_norm] : [])) : [],
  );
  const all = knownBuyerNames();
  const names = [...all.filter((n) => current.has(normName(n))), ...all.filter((n) => !current.has(normName(n)))];
  return NextResponse.json({ me: await readMe(), names });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = body.name === null ? null : cleanMeName(body.name);
  if (body.name !== null && !name) return NextResponse.json({ error: "Mangler navn." }, { status: 400 });
  const out = NextResponse.json({ ok: true, me: name });
  writeMe(out, name);
  return out;
}

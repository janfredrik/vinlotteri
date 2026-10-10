import { NextResponse } from "next/server";
import { knownBuyerNames } from "@/lib/repo";
import { cleanMeName } from "@/lib/me-shared";
import { readMe, writeMe } from "@/lib/me-cookie";

export const dynamic = "force-dynamic";

const byName = new Intl.Collator("nb", { sensitivity: "base", numeric: true });

/** The profile picker: everyone who has ever bought, alphabetically (Norwegian order, Æ Ø Å last). */
export async function GET() {
  const names = knownBuyerNames().sort(byName.compare);
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

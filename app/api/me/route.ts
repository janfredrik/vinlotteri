import { NextResponse } from "next/server";
import { knownBuyerNames } from "@/lib/repo";
import { cleanMeName } from "@/lib/me-shared";
import { normName } from "@/lib/format";
import { readMe, writeMe } from "@/lib/me-cookie";

export const dynamic = "force-dynamic";

const byName = new Intl.Collator("nb", { sensitivity: "base", numeric: true });

// Old colleagues drop out of the picker once they've sat out a year of rounds.
const PICKER_WINDOW_MS = 365 * 86_400_000;

/** The profile picker: everyone who has bought in the last year, alphabetically (Norwegian
 *  order, Æ Ø Å last). The chosen profile stays listed even if it's older, so it shows as picked. */
export async function GET() {
  const me = await readMe();
  const names = knownBuyerNames(new Date(Date.now() - PICKER_WINDOW_MS).toISOString());
  if (me && !names.some((n) => normName(n) === normName(me))) names.push(me);
  return NextResponse.json({ me, names: names.sort(byName.compare) });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const name = body.name === null ? null : cleanMeName(body.name);
  if (body.name !== null && !name) return NextResponse.json({ error: "Mangler navn." }, { status: 400 });
  const out = NextResponse.json({ ok: true, me: name });
  writeMe(out, name);
  return out;
}

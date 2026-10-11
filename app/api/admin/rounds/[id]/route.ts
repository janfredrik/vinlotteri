import { NextResponse } from "next/server";
import { guardAccess, num } from "@/lib/http";
import { historyEdit } from "@/lib/settings";
import { db } from "@/lib/db";
import { computeMoney } from "@/lib/money";
import {
  getCells,
  getDraws,
  getPrizes,
  getRound,
  getSuccessor,
  knownBuyerNames,
  restrictionActive,
  salesOpen,
  updateRound,
} from "@/lib/repo";
import { vippsPresentation } from "@/lib/present";
import { notifyRound } from "@/lib/events";
import { isThemeSetting } from "@/lib/season";

export const dynamic = "force-dynamic";

/** What a settled round lets you correct while history editing is on. */
const HISTORY_FIELDS = ["title", "organizer_name", "vipps_number"];

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAccess();
  if (denied) return denied;
  const id = num((await params).id);
  if (id == null) return NextResponse.json({ error: "Ugyldig runde." }, { status: 400 });
  const round = getRound(id);
  if (!round) return NextResponse.json({ error: "Runden finnes ikke." }, { status: 404 });

  const cells = getCells(id);
  const prizes = getPrizes(id);
  const draws = getDraws(id);

  return NextResponse.json({
    round,
    cells,
    prizes,
    draws,
    money: computeMoney(round, cells, prizes),
    salesOpen: salesOpen(round),
    restrictionActive: restrictionActive(round),
    vipps: await vippsPresentation(round),
    successor: (({ id, title }) => ({ id, title }))(getSuccessor(id) ?? { id: 0, title: "" }),
    knownNames: knownBuyerNames(),
    historyEdit: historyEdit(),
    now: new Date().toISOString(),
  });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAccess();
  if (denied) return denied;
  const id = num((await params).id);
  if (id == null) return NextResponse.json({ error: "Ugyldig runde." }, { status: 400 });
  const round = getRound(id);
  if (!round) return NextResponse.json({ error: "Runden finnes ikke." }, { status: 404 });
  let body = await req.json().catch(() => ({}));
  if (round.status === "settled") {
    // With history editing on (/superadmin), the facts that don't touch the money can be corrected.
    if (!historyEdit())
      return NextResponse.json({ error: "Runden er gjort opp. Angre oppgjøret først hvis noe må endres." }, { status: 409 });
    body = Object.fromEntries(Object.entries(body ?? {}).filter(([k]) => HISTORY_FIELDS.includes(k)));
  }

  const pick = (k: "restriction_lifts_at" | "sales_close_at") => (body && k in body ? body[k] : round[k]);
  const lifts = pick("restriction_lifts_at");
  const closes = pick("sales_close_at");
  if (lifts && closes && Date.parse(lifts) > Date.parse(closes))
    return NextResponse.json({ error: "Maks-grensen må oppheves før loddsalget stenger." }, { status: 400 });
  if (body && "theme" in body && !isThemeSetting(body.theme))
    return NextResponse.json({ error: "Ukjent tema." }, { status: 400 });
  updateRound(id, body ?? {});
  notifyRound(id);
  return NextResponse.json({ ok: true, round: getRound(id) });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAccess();
  if (denied) return denied;
  const id = num((await params).id);
  if (id == null) return NextResponse.json({ error: "Ugyldig runde." }, { status: 400 });
  const round = getRound(id);
  if (!round) return NextResponse.json({ error: "Runden finnes ikke." }, { status: 404 });
  if (round.status === "settled")
    return NextResponse.json({ error: "En avsluttet runde kan ikke slettes." }, { status: 409 });
  db.prepare("DELETE FROM rounds WHERE id = ?").run(id);
  notifyRound(id);
  return NextResponse.json({ ok: true });
}

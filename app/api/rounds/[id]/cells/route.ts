import { NextResponse } from "next/server";
import {
  buildRoundState,
  confirmCell,
  getRound,
  holdCell,
  myCellIds,
  wishCellIds,
  ownSkippedChoice,
  releaseCell,
  restrictionActive,
  salesOpen,
  setWishes,
  syncAfterChoice,
} from "@/lib/repo";
import { onStatusChange } from "@/lib/notify";
import { notifyRound } from "@/lib/events";
import { readHoldIds, writeHoldIds } from "@/lib/holds-cookie";
import { readMe } from "@/lib/me-cookie";
import { num } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const roundId = num((await params).id);
  if (roundId == null) return NextResponse.json({ error: "Ugyldig runde." }, { status: 400 });

  const round = getRound(roundId);
  if (!round) return NextResponse.json({ error: "Runden finnes ikke." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const action = body.action as string;
  const holdIds = await readHoldIds();

  if (action === "hold") {
    if (!salesOpen(round)) return NextResponse.json({ error: "Loddsalget er stengt." }, { status: 409 });
    const row = num(body.row);
    const col = num(body.col);
    if (row == null || col == null) return NextResponse.json({ error: "Mangler rute." }, { status: 400 });
    const res = holdCell(roundId, row, col, String(body.name ?? ""), restrictionActive(round));
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: 409 });
    notifyRound(roundId);
    const out = NextResponse.json({ ok: true, cellId: res.cellId });
    writeHoldIds(out, [...holdIds, res.cellId!]);
    return out;
  }

  if (action === "confirm") {
    const cellId = num(body.cellId);
    if (cellId == null || !holdIds.includes(cellId))
      return NextResponse.json({ error: "Fant ikke reservasjonen din." }, { status: 409 });
    if (!confirmCell(roundId, cellId))
      return NextResponse.json(
        { error: "Fant ikke reservasjonen – ruten kan være frigitt av arrangør." },
        { status: 409 },
      );
    notifyRound(roundId);
    return NextResponse.json({ ok: true });
  }

  if (action === "release") {
    const cellId = num(body.cellId);
    if (!salesOpen(round))
      return NextResponse.json(
        { error: "Salget er stengt, så reservasjonen er med i trekningen. Kontakt arrangøren hvis noe er feil." },
        { status: 409 },
      );
    if (cellId != null && holdIds.includes(cellId)) {
      releaseCell(roundId, cellId);
      notifyRound(roundId);
      const out = NextResponse.json({ ok: true });
      writeHoldIds(out, holdIds.filter((x) => x !== cellId));
      return out;
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "wishes") {
    if (round.status === "drawn" || round.status === "settled")
      return NextResponse.json({ error: "Trekningen er ferdig." }, { status: 409 });
    const err = setWishes(roundId, wishCellIds(roundId, holdIds, await readMe()), Array.isArray(body.prizeIds) ? body.prizeIds : []);
    if (err) return NextResponse.json({ error: err }, { status: 409 });
    notifyRound(roundId);
    return NextResponse.json({ ok: true });
  }

  // A winner who was skipped (not there) picks their prize themselves.
  if (action === "choose") {
    if (round.status !== "closed") return NextResponse.json({ error: "Trekningen pågår ikke." }, { status: 409 });
    const prizeId = num(body.prizeId);
    if (prizeId == null) return NextResponse.json({ error: "Velg en premie." }, { status: 400 });
    const err = ownSkippedChoice(roundId, myCellIds(roundId, holdIds, await readMe()), prizeId);
    if (err) return NextResponse.json({ error: err }, { status: 409 });
    if (syncAfterChoice(roundId) === "drawn") onStatusChange(roundId, "drawn");
    notifyRound(roundId);
    return NextResponse.json({ ok: true });
  }

  if (action === "state") {
    return NextResponse.json(buildRoundState(roundId, myCellIds(roundId, holdIds, await readMe())));
  }

  return NextResponse.json({ error: "Ukjent handling." }, { status: 400 });
}

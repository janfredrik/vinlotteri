import { NextResponse } from "next/server";
import { guardAccess, num } from "@/lib/http";
import { historyEdit } from "@/lib/settings";
import { notifyRound } from "@/lib/events";
import { clearRoll, rollDice, settleRoll } from "@/lib/liveRoll";
import { onStatusChange } from "@/lib/notify";
import {
  addPrize,
  adminAssignCell,
  adminRenameBuyer,
  choosePrize,
  adminClearCell,
  clearDraw,
  createNextRound,
  deletePrize,
  digitalDraw,
  getCells,
  getDraws,
  getPrizes,
  getRound,
  getSuccessor,
  movePrize,
  physicalDraw,
  setCellPaid,
  setDrawSquare,
  setRoundStatus,
  skipChoice,
  syncAfterChoice,
  updatePrize,
  updateRound,
} from "@/lib/repo";
import { computeMoney } from "@/lib/money";
import { awaitingChoice, settleCheck } from "@/lib/phases";
import { STATUS_LABEL } from "@/lib/phases";
import { describePrizePatch, logAudit, square, squareWithBuyer } from "@/lib/audit";
import { readMe } from "@/lib/me-cookie";
import { requestIp } from "@/lib/request-ip";
import type { RoundStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUSES: RoundStatus[] = ["draft", "open", "closed", "drawn", "settled"];

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await guardAccess();
  if (denied) return denied;
  const roundId = num((await params).id);
  if (roundId == null) return NextResponse.json({ error: "Ugyldig runde." }, { status: 400 });
  const round = getRound(roundId);
  if (!round) return NextResponse.json({ error: "Runden finnes ikke." }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const type = body.type as string;
  const conflict = (error: string) => NextResponse.json({ error }, { status: 409 });
  const actor = await readMe();
  const ip = await requestIp();
  const log = (summary: string, details?: unknown) => logAudit({ roundId, actor, ip, action: type, summary, details });
  const cellById = (id: number) => getCells(roundId).find((c) => c.id === id);
  const prizeById = (id: number) => getPrizes(roundId).find((p) => p.id === id);
  const prizeName = (p: { name: string; rank: number } | undefined) => (p ? `«${p.name || `${p.rank}. premie`}»` : "premien");
  const drawByRank = (rank: number) => getDraws(roundId).find((d) => d.rank === rank);

  // A settled round is history: the money has been carried forward, so nothing may change
  // until the settlement is undone.
  // The exceptions are what the stats read, not money: a buyer's name, a winning square and a prize's
  // details, and only while history editing is switched on in /superadmin. The money stays put: see prizeUpdate.
  const historyFix = ["cellRename", "drawSquare", "prizeUpdate"].includes(type);
  if (round.status === "settled" && type !== "status" && type !== "next" && !(historyFix && historyEdit()))
    return conflict(
      historyFix
        ? "Retting av historikk er ikke slått på."
        : "Runden er gjort opp. Angre oppgjøret først hvis noe må endres.",
    );

  switch (type) {
    case "status": {
      const next = body.status as RoundStatus;
      if (!STATUSES.includes(next)) return NextResponse.json({ error: "Ugyldig status." }, { status: 400 });
      if (next === "open" && !round.vipps_number.trim())
        return NextResponse.json({ error: "Vippsnummer må fylles inn før loddsalget kan åpnes." }, { status: 400 });
      if (next === "settled") {
        const check = settleCheck(getCells(roundId), getPrizes(roundId), getDraws(roundId));
        if (!check.prizes) return conflict("Runden har ingen premier.");
        if (!check.allDrawn) return conflict(`Bare ${check.drawn} av ${check.prizes} premier har fått en vinner.`);
        if (check.needsForce && !body.force)
          return conflict("Noen lodd er ikke betalt. Bekreft at du vil gjøre opp likevel.");
      }
      if (round.status === "settled") {
        if (getSuccessor(roundId)) return conflict("Neste runde er allerede startet – oppgjøret kan ikke angres.");
        if (next !== "drawn") return conflict("Et oppgjør kan bare angres tilbake til «trukket».");
      }
      setRoundStatus(roundId, next);
      onStatusChange(roundId, next);
      if (next !== round.status)
        log(
          `Status: ${STATUS_LABEL[round.status]} → ${STATUS_LABEL[next]}${next === "settled" && body.force ? " (med ubetalte lodd)" : ""}`,
          { from: round.status, to: next },
        );
      break;
    }
    case "next": {
      if (round.status !== "settled") return conflict("Gjør opp runden før du starter neste.");
      const existing = getSuccessor(roundId);
      if (existing) return NextResponse.json({ error: "Neste runde finnes allerede.", id: existing.id }, { status: 409 });
      const id = createNextRound(roundId, {
        organizer_name: typeof body.organizer_name === "string" ? body.organizer_name : undefined,
        vipps_number: typeof body.vipps_number === "string" ? body.vipps_number : undefined,
      });
      if (id) {
        log(`Startet neste runde (#${id})`, { next: id });
        logAudit({ roundId: id, actor, ip, action: "create", summary: `Runden ble startet fra runde #${roundId}` });
      }
      notifyRound(roundId);
      if (id) notifyRound(id);
      return NextResponse.json({ ok: true, id });
    }
    case "roll": {
      // A die tapped on the organiser's phone, sent on to the big screen. Nothing is stored.
      if (round.status !== "closed") return conflict("Trekningen er ikke i gang.");
      const rank = num(body.rank);
      if (rank == null) return NextResponse.json({ error: "Mangler trekning." }, { status: 400 });
      const die = (v: unknown) => {
        const n = num(v);
        return n != null && n >= 1 && n <= round.grid_size ? n : null;
      };
      rollDice(roundId, rank, die(body.col), die(body.row));
      break;
    }
    case "draw": {
      if (round.status === "draft" || round.status === "open")
        return conflict("Steng loddsalget før trekningen.");
      const rank = num(body.rank);
      if (rank == null) return NextResponse.json({ error: "Mangler premie." }, { status: 400 });
      // Winners pick in draw order, so the next draw waits until the previous winner has chosen.
      const waiting = awaitingChoice(getDraws(roundId));
      if (waiting && waiting.rank !== rank) return conflict(`${waiting.winner_name} må velge premie først.`);
      const method = body.method === "digital" || body.method === "physical" ? body.method : round.draw_mode;
      let result;
      if (method === "digital") {
        result = digitalDraw(roundId, rank);
      } else {
        const row = num(body.row);
        const col = num(body.col);
        if (row == null || col == null) return NextResponse.json({ error: "Tast kolonne og rad." }, { status: 400 });
        result = physicalDraw(roundId, rank, row, col);
      }
      // Misses (empty/taken squares) aren't stored, so they aren't logged either.
      if (result.outcome === "winner")
        log(`${rank}. trekning: ${square({ row: result.row!, col: result.col! })} → ${result.winnerName}${method === "digital" ? " (digital)" : ""}`, {
          rank,
          row: result.row,
          col: result.col,
          winner: result.winnerName,
          method,
          seed: result.seed,
        });
      else if (result.outcome === "no-eligible" && result.recorded) log(`${rank}. trekning: ingen ruter kunne vinne`, { rank });
      // The big screen shows misses too; they aren't stored anywhere else.
      settleRoll(roundId, rank, result.outcome, result.col, result.row, method);
      // The status follows the draw: every prize has a winner -> "trukket".
      if (result.outcome === "winner" && settleCheck(getCells(roundId), getPrizes(roundId), getDraws(roundId)).allDrawn) {
        setRoundStatus(roundId, "drawn");
        onStatusChange(roundId, "drawn");
      }
      notifyRound(roundId);
      return NextResponse.json({ ok: true, result });
    }
    case "choosePrize": {
      const rank = num(body.rank);
      if (rank == null) return NextResponse.json({ error: "Mangler trekning." }, { status: 400 });
      const prizeId = body.prizeId == null ? null : num(body.prizeId);
      const err = choosePrize(roundId, rank, prizeId);
      if (err) return conflict(err);
      const winner = drawByRank(rank)?.winner_name ?? "Vinneren";
      log(
        prizeId == null
          ? `${rank}. trekning: valget av premie ble angret`
          : `${rank}. trekning: ${winner} valgte ${prizeName(prizeById(prizeId))}`,
        { rank, prizeId },
      );
      if (syncAfterChoice(roundId) === "drawn") onStatusChange(roundId, "drawn");
      break;
    }
    case "skipChoice": {
      const rank = num(body.rank);
      if (rank == null) return NextResponse.json({ error: "Mangler trekning." }, { status: 400 });
      const err = skipChoice(roundId, rank);
      if (err) return conflict(err);
      log(`${rank}. trekning: ${drawByRank(rank)?.winner_name ?? "vinneren"} var ikke til stede og velger senere`, { rank });
      if (syncAfterChoice(roundId) === "drawn") onStatusChange(roundId, "drawn");
      break;
    }
    case "clearDraw": {
      const rank = num(body.rank);
      if (rank == null) return NextResponse.json({ error: "Mangler premie." }, { status: 400 });
      const was = drawByRank(rank);
      clearDraw(roundId, rank);
      clearRoll(roundId, rank);
      if (was)
        log(
          `Angret ${rank}. trekning${was.row && was.col ? ` (${square({ row: was.row, col: was.col })}, ${was.winner_name ?? "ingen vinner"})` : ""}`,
          { rank, row: was.row, col: was.col, winner: was.winner_name },
        );
      if (round.status === "drawn") setRoundStatus(roundId, "closed");
      break;
    }
    case "drawSquare": {
      if (!historyEdit()) return NextResponse.json({ error: "Retting av historikk er ikke slått på." }, { status: 403 });
      if (round.status !== "settled") return conflict("Bare avsluttede runder kan rettes her.");
      const rank = num(body.rank);
      if (rank == null) return NextResponse.json({ error: "Mangler trekning." }, { status: 400 });
      const cellId = body.cellId == null ? null : num(body.cellId);
      const was = drawByRank(rank);
      const err = setDrawSquare(roundId, rank, cellId);
      if (err) return conflict(err);
      const now = drawByRank(rank);
      const where = (d: typeof was) => (d?.row && d.col ? `${square({ row: d.row, col: d.col })} (${d.winner_name ?? "ingen"})` : "ingen rute");
      log(`Rettet vinnerrute for ${rank}. trekning: ${where(was)} → ${where(now)}`, {
        rank,
        from: was && { row: was.row, col: was.col, winner: was.winner_name },
        to: now && { row: now.row, col: now.col, winner: now.winner_name },
      });
      break;
    }
    case "cellPaid": {
      const cellId = num(body.cellId);
      if (cellId == null) return NextResponse.json({ error: "Mangler rute." }, { status: 400 });
      const was = cellById(cellId);
      if (!setCellPaid(roundId, cellId, !!body.paid)) return conflict("Ruten er ikke solgt eller reservert.");
      if (was) log(`${squareWithBuyer(was)} markert som ${body.paid ? "betalt" : "ikke betalt"}`, { cellId, paid: !!body.paid });
      break;
    }
    case "cellAssign": {
      const row = num(body.row);
      const col = num(body.col);
      if (row == null || col == null || !String(body.name ?? "").trim())
        return NextResponse.json({ error: "Mangler rute eller navn." }, { status: 400 });
      const was = getCells(roundId).find((c) => c.row === row && c.col === col);
      if (!adminAssignCell(roundId, row, col, String(body.name), !!body.paid))
        return NextResponse.json({ error: "Ruten er ikke ledig." }, { status: 409 });
      log(
        `${square({ row, col })} tildelt ${String(body.name).trim()}${body.paid ? " (betalt)" : ""}${was?.status === "held" && was.buyer_name ? `, var reservert av ${was.buyer_name}` : ""}`,
        { row, col, name: String(body.name).trim(), paid: !!body.paid, was: was?.buyer_name ?? null },
      );
      break;
    }
    case "cellRename": {
      const cellId = num(body.cellId);
      const name = String(body.name ?? "").trim();
      if (cellId == null || name.length < 2)
        return NextResponse.json({ error: "Mangler rute eller navn." }, { status: 400 });
      const was = cellById(cellId);
      const renamed = adminRenameBuyer(roundId, cellId, name, !!body.all);
      if (!renamed) return conflict("Ruten er ikke solgt eller reservert.");
      if (was)
        log(
          `Endret navn ${was.buyer_name ?? ""} → ${name} på ${renamed > 1 ? `${renamed} ruter` : square(was)}`,
          { cellId, from: was.buyer_name, to: name, squares: renamed },
        );
      break;
    }
    case "cellClear": {
      const cellId = num(body.cellId);
      if (cellId == null) return NextResponse.json({ error: "Mangler rute." }, { status: 400 });
      const was = cellById(cellId);
      adminClearCell(roundId, cellId);
      if (was && was.status !== "available") log(`Frigjorde ${squareWithBuyer(was)}`, { cellId, buyer: was.buyer_name, paid: !!was.paid });
      break;
    }
    case "prizeAdd": {
      const id = addPrize(roundId, body.prize ?? {});
      log(`La til premie ${prizeName(prizeById(id))}`, { prizeId: id });
      notifyRound(roundId);
      return NextResponse.json({ ok: true, id });
    }
    case "prizeUpdate": {
      const prizeId = num(body.prizeId);
      if (prizeId == null) return NextResponse.json({ error: "Mangler premie." }, { status: 400 });
      // Kost på polet falls back to the sum of prize prices. In a settled round it's pinned first,
      // so correcting a price never changes what was carried forward.
      if (round.status === "settled" && round.polet_cost == null)
        updateRound(roundId, { polet_cost: computeMoney(round, getCells(roundId), getPrizes(roundId)).poletCost });
      const was = prizeById(prizeId);
      updatePrize(roundId, prizeId, body.patch ?? {});
      const change = was && describePrizePatch(was, body.patch ?? {});
      if (change) log(change.summary, { prizeId, ...change.details });
      break;
    }
    case "prizeDelete": {
      const prizeId = num(body.prizeId);
      if (prizeId == null) return NextResponse.json({ error: "Mangler premie." }, { status: 400 });
      const was = prizeById(prizeId);
      deletePrize(roundId, prizeId);
      if (was) log(`Fjernet premie ${prizeName(was)}`, { prizeId, prize: was });
      break;
    }
    case "prizeMove": {
      const prizeId = num(body.prizeId);
      if (prizeId == null) return NextResponse.json({ error: "Mangler premie." }, { status: 400 });
      const was = prizeById(prizeId);
      movePrize(roundId, prizeId, body.dir === -1 ? -1 : 1);
      const moved = prizeById(prizeId);
      if (was && moved && was.rank !== moved.rank) log(`Flyttet ${prizeName(was)} fra ${was.rank}. til ${moved.rank}. premie`, { prizeId });
      break;
    }
    default:
      return NextResponse.json({ error: "Ukjent handling." }, { status: 400 });
  }

  notifyRound(roundId);
  return NextResponse.json({ ok: true });
}

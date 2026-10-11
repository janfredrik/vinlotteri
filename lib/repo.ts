import { db } from "./db";
import { normName } from "./format";
import { computeMoney } from "./money";
import { makeSeed, seededRolls } from "./draw";
import { vinmonopoletImage } from "./vinmonopolet";
import { parseWishes, prizeOfDraw, settleCheck, skippedWinners, unclaimedPrizes } from "./phases";
import { atTime, isoWeek, nextWeekday } from "./datetime";
import { buildNameUses, type NameUse } from "./names";
import type {
  Cell,
  Draw,
  DrawMode,
  LotteryStats,
  MoneySummary,
  Prize,
  PublicCell,
  PublicDraw,
  Round,
  RoundState,
  RoundStatus,
} from "./types";

export { normName };

/** node:sqlite returns rows with a null prototype; clone to plain objects so they
 *  can cross the server -> client component boundary. */
function plain<T>(row: unknown): T | undefined {
  return row ? ({ ...(row as object) } as T) : undefined;
}
function plainAll<T>(rows: unknown[]): T[] {
  return rows.map((r) => ({ ...(r as object) }) as T);
}

function nowIso(): string {
  return new Date().toISOString();
}

/* ---------------------------------------------------------------- rounds --- */

export function getRound(id: number): Round | undefined {
  return plain<Round>(db.prepare("SELECT * FROM rounds WHERE id = ?").get(id));
}

/** Rounds in the order they ran. Not by id: imported history gets ids after the live rounds.
 *  datetime() evens out the two formats in use (SQLite's "now" and the import's ISO string). */
const CHRONO = "datetime(created_at), id";
const CHRONO_DESC = "datetime(created_at) DESC, id DESC";

export function listRounds(): Round[] {
  return plainAll<Round>(db.prepare(`SELECT * FROM rounds ORDER BY ${CHRONO_DESC}`).all());
}

export interface RoundSummary {
  id: number;
  title: string;
  status: RoundStatus;
  organizer: string;
  vippsNumber: string;
  salesCloseAt: string | null;
  carriedOver: number;
  inPlay: number;
  sold: number;
  /** Sold but not ticked off as paid, plus squares still held for a buyer. */
  owing: number;
  prizes: number;
  drawn: number;
  videre: number;
  firstWinner: string | null;
  /** Winners recorded by name only, with no square (imported history). */
  unplaced: number;
  hasSuccessor: boolean;
  year: number;
}

/** The year a round ran. created_at is either SQLite's "2026-10-09 13:16:53" or the import's ISO string. */
function roundYear(r: Round): number {
  return Number(r.created_at.slice(0, 4));
}

/** Years with settled rounds, newest first. */
export function settledYears(): number[] {
  return [...new Set(listRounds().filter((r) => r.status === "settled").map(roundYear))];
}

/**
 * Rounds with the few numbers the admin overview needs, newest first.
 * `year` limits the settled rounds to that year; rounds still in progress are always included.
 * Without it, every round comes back.
 */
export function listRoundSummaries(year?: number): RoundSummary[] {
  return listRounds().flatMap((r, i) => {
    if (year != null && r.status === "settled" && roundYear(r) !== year) return [];
    const cells = getCells(r.id);
    const prizes = getPrizes(r.id);
    const draws = getDraws(r.id);
    const money = computeMoney(r, cells, prizes);
    const check = settleCheck(cells, prizes, draws);
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      organizer: r.organizer_name,
      vippsNumber: r.vipps_number,
      salesCloseAt: r.sales_close_at,
      carriedOver: r.carried_over,
      inPlay: cells.length,
      sold: money.sold,
      owing: check.unpaid + check.held,
      prizes: check.prizes,
      drawn: check.drawn,
      // Imported history can carry øre in the Polet cost; the overview shows whole kroner.
      videre: Math.round(money.videre),
      firstWinner: draws.find((d) => d.rank === 1 && d.winner_name)?.winner_name ?? null,
      unplaced: draws.filter((d) => d.winner_name && d.winner_cell_id == null).length,
      // Rounds run week after week, so any later round is the successor (see getSuccessor).
      hasSuccessor: i > 0,
      year: roundYear(r),
    };
  });
}

/** The round the public landing page should show. */
export function getActiveRound(): Round | undefined {
  return (
    plain<Round>(
      db.prepare(`SELECT * FROM rounds WHERE status = 'open' ORDER BY ${CHRONO_DESC} LIMIT 1`).get(),
    ) ??
    plain<Round>(
      db
        .prepare(
          `SELECT * FROM rounds WHERE status IN ('closed','drawn','settled') ORDER BY ${CHRONO_DESC} LIMIT 1`,
        )
        .get(),
    ) ??
    plain<Round>(
      db.prepare(`SELECT * FROM rounds WHERE status = 'draft' ORDER BY ${CHRONO_DESC} LIMIT 1`).get(),
    )
  );
}

const ROUND_FIELDS = [
  "title",
  "ticket_price",
  "max_per_person",
  "restriction_lifts_at",
  "sales_close_at",
  "draw_mode",
  "grid_size",
  "organizer_name",
  "vipps_number",
  "carried_over",
  "polet_cost",
  "notes",
  "theme",
] as const;

export function createRound(data: Partial<Round>): number {
  const gridSize = data.grid_size && data.grid_size >= 2 && data.grid_size <= 10 ? data.grid_size : 6;
  const res = db
    .prepare(
      `INSERT INTO rounds (title, ticket_price, max_per_person, restriction_lifts_at, sales_close_at,
        draw_mode, grid_size, organizer_name, vipps_number, vipps_message, carried_over, polet_cost, notes, theme)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    )
    .run(
      data.title ?? "",
      data.ticket_price ?? 15,
      data.max_per_person ?? 2,
      data.restriction_lifts_at ?? null,
      data.sales_close_at ?? null,
      data.draw_mode ?? "physical",
      gridSize,
      data.organizer_name ?? "",
      data.vipps_number ?? "",
      data.vipps_message ?? "",
      data.carried_over ?? 0,
      data.polet_cost ?? null,
      data.notes ?? "",
      data.theme ?? "auto",
    );
  const roundId = Number(res.lastInsertRowid);
  regenerateCells(roundId, gridSize);
  return roundId;
}

export function updateRound(id: number, patch: Record<string, unknown>): void {
  const keys = Object.keys(patch).filter((k) => (ROUND_FIELDS as readonly string[]).includes(k));
  if (keys.length) {
    const sql = `UPDATE rounds SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ?`;
    db.prepare(sql).run(...keys.map((k) => patch[k] as never), id);
  }
  if (patch.grid_size) {
    const round = getRound(id);
    if (round) regenerateCells(id, round.grid_size);
  }
}

export function setRoundStatus(id: number, status: RoundStatus): void {
  db.prepare("UPDATE rounds SET status = ? WHERE id = ?").run(status, id);
}

/** The round that follows this one. Rounds run strictly week after week, so any later round
 *  counts - also for the imported history, which has no explicit link between rounds. */
export function getSuccessor(id: number): Round | undefined {
  return plain<Round>(
    db
      .prepare(
        `SELECT * FROM rounds WHERE (datetime(created_at), id) >
          (SELECT datetime(created_at), id FROM rounds WHERE id = ?) ORDER BY ${CHRONO} LIMIT 1`,
      )
      .get(id),
  );
}

/** Copy a round's setup into a fresh draft, carrying the balance forward. Only once per round:
 *  a second "neste runde" would carry the same money forward twice. */
export function createNextRound(
  fromId: number,
  handover: { organizer_name?: string; vipps_number?: string } = {},
): number | undefined {
  const prev = getRound(fromId);
  if (!prev || getSuccessor(fromId)) return undefined;
  const cells = getCells(fromId);
  const prizes = getPrizes(fromId);
  const draws = getDraws(fromId);
  const money = computeMoney(prev, cells, prizes);

  // Draws happen Fridays: grense oppheves 14:30, salg stenger 15:00. "Neste runde" always
  // means the coming Friday - never today, even if this one was just settled on a Friday.
  const friday = nextWeekday(5);
  const winner = draws.find((d) => d.rank === 1 && d.winner_name)?.winner_name ?? undefined;

  const roundId = createRound({
    title: `Uke ${isoWeek(friday)} – ${friday.getFullYear()}`,
    ticket_price: prev.ticket_price,
    max_per_person: prev.max_per_person,
    restriction_lifts_at: atTime(friday, 14, 30),
    sales_close_at: atTime(friday, 15, 0),
    draw_mode: prev.draw_mode,
    grid_size: prev.grid_size,
    // The 1. premie-vinner arrangerer neste runde og bytter Vippsnummer - la arrangørfeltet
    // stå tomt så det er tydelig at det må fylles inn, i stedet for å arve forgjengerens.
    organizer_name: handover.organizer_name?.trim() || (winner ?? prev.organizer_name),
    vipps_number: handover.vipps_number?.trim() || (winner ? "" : prev.vipps_number),
    carried_over: money.videre,
    notes: "",
    // Someone who turned the themes off keeps them off; a hand-picked season doesn't outlast its week.
    theme: prev.theme === "none" ? "none" : "auto",
  });
  return roundId;
}

/* ----------------------------------------------------------------- cells --- */

export function getCells(roundId: number): Cell[] {
  return plainAll<Cell>(
    db.prepare("SELECT * FROM cells WHERE round_id = ? ORDER BY row, col").all(roundId),
  );
}

function regenerateCells(roundId: number, gridSize: number): void {
  const existing = getCells(roundId);
  const keep = new Set(
    existing
      .filter((c) => c.status === "sold" || c.status === "held")
      .map((c) => `${c.row},${c.col}`),
  );
  db.exec("BEGIN");
  try {
    // drop cells that are now out of range and untouched
    db.prepare(
      "DELETE FROM cells WHERE round_id = ? AND (row > ? OR col > ?) AND status = 'available'",
    ).run(roundId, gridSize, gridSize);
    const ins = db.prepare(
      "INSERT OR IGNORE INTO cells (round_id, row, col, status) VALUES (?,?,?, 'available')",
    );
    for (let r = 1; r <= gridSize; r++) {
      for (let c = 1; c <= gridSize; c++) {
        if (keep.has(`${r},${c}`)) continue;
        ins.run(roundId, r, c);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function countTicketsByPerson(roundId: number, nameNorm: string): number {
  const row = db
    .prepare(
      "SELECT COUNT(*) AS n FROM cells WHERE round_id = ? AND buyer_name_norm = ? AND status IN ('held','sold')",
    )
    .get(roundId, nameNorm) as { n: number };
  return row.n;
}

export interface HoldResult {
  ok: boolean;
  error?: string;
  cellId?: number;
}

const BUYER_NAME_MAX = 40;

export function holdCell(
  roundId: number,
  row: number,
  col: number,
  name: string,
  restrictionActive: boolean,
): HoldResult {
  const round = getRound(roundId);
  if (!round) return { ok: false, error: "Runden finnes ikke." };

  // The buy form caps names at a few characters; the server only guards against junk: control
  // characters, runs of spaces and very long names (sent past the form) that would break layouts.
  const trimmed = [...name.replace(/[\p{Cc}\u200B\u202A-\u202E\u2066-\u2069\uFEFF]/gu, "").trim().replace(/\s+/g, " ")]
    .slice(0, BUYER_NAME_MAX)
    .join("")
    .trim();
  if (trimmed.length < 2) return { ok: false, error: "Skriv inn navn eller initialer." };
  const nameNorm = normName(trimmed);

  const cell = db
    .prepare("SELECT * FROM cells WHERE round_id = ? AND row = ? AND col = ?")
    .get(roundId, row, col) as Cell | undefined;
  if (!cell) return { ok: false, error: "Ruten finnes ikke." };
  if (cell.status !== "available")
    return { ok: false, error: `Noen rakk å ta rute ${col}-${row} før deg. Velg en annen ledig rute.` };

  if (restrictionActive && round.max_per_person > 0) {
    const held = countTicketsByPerson(roundId, nameNorm);
    if (held >= round.max_per_person) {
      return {
        ok: false,
        error: `Maks ${round.max_per_person} lodd per person nå. Grensen oppheves nærmere trekning.`,
      };
    }
  }

  // Holds don't expire — a reserved square stays the buyer's until they pay or an
  // organiser frees it in admin. created_at is the purchase time shown in admin.
  db.prepare(
    `UPDATE cells SET status = 'held', buyer_name = ?, buyer_name_norm = ?,
      hold_expires_at = NULL, created_at = ? WHERE id = ?`,
  ).run(trimmed, nameNorm, nowIso(), cell.id);
  return { ok: true, cellId: cell.id };
}

/** The buyer pressed "jeg har betalt". We take their word for it; the organiser can undo it in admin. */
export function confirmCell(roundId: number, cellId: number): boolean {
  const res = db
    .prepare(
      `UPDATE cells SET status = 'sold', paid = 1, paid_marked_at = ?, hold_expires_at = NULL
       WHERE id = ? AND round_id = ? AND status = 'held'`,
    )
    .run(nowIso(), cellId, roundId);
  return (res.changes as number) > 0;
}

export function releaseCell(roundId: number, cellId: number): boolean {
  const res = db
    .prepare(
      `UPDATE cells SET status = 'available', buyer_name = NULL, buyer_name_norm = NULL,
        buyer_contact = NULL, hold_expires_at = NULL, wishes = NULL WHERE id = ? AND round_id = ? AND status = 'held'`,
    )
    .run(cellId, roundId);
  return (res.changes as number) > 0;
}

/** Ticking off a payment. A reserved square that gets paid is sold at the same time - the buyer
 *  paid but never pressed "jeg har betalt". */
export function setCellPaid(roundId: number, cellId: number, paid: boolean): boolean {
  const res = paid
    ? db
        .prepare(
          `UPDATE cells SET status = 'sold', paid = 1, paid_marked_at = ?, hold_expires_at = NULL
           WHERE id = ? AND round_id = ? AND status IN ('sold','held')`,
        )
        .run(nowIso(), cellId, roundId)
    : db
        .prepare(
          "UPDATE cells SET paid = 0, paid_marked_at = NULL WHERE id = ? AND round_id = ? AND status = 'sold'",
        )
        .run(cellId, roundId);
  return (res.changes as number) > 0;
}

/** Admin: assign a square directly (used when someone paid at the desk). */
export function adminAssignCell(
  roundId: number,
  row: number,
  col: number,
  name: string,
  paid: boolean,
): boolean {
  const cell = db
    .prepare("SELECT * FROM cells WHERE round_id = ? AND row = ? AND col = ?")
    .get(roundId, row, col) as Cell | undefined;
  if (!cell || (cell.status !== "available" && cell.status !== "held")) return false;
  db.prepare(
    `UPDATE cells SET status = 'sold', buyer_name = ?, buyer_name_norm = ?, paid = ?,
      paid_marked_at = ?, hold_expires_at = NULL,
      created_at = CASE WHEN status = 'held' THEN created_at ELSE ? END WHERE id = ?`,
  ).run(name.trim(), normName(name), paid ? 1 : 0, paid ? nowIso() : null, nowIso(), cell.id);
  return true;
}

/** Admin: correct a buyer's name, e.g. someone used another nickname than usual so the stats count
 *  them as two people. Renames this square - or, with `allOfThem`, every square with the same name
 *  in the round - and the draws those squares won. Money is untouched, so settled rounds allow it too.
 *  Returns how many squares were renamed. */
export function adminRenameBuyer(roundId: number, cellId: number, name: string, allOfThem: boolean): number {
  const cell = db
    .prepare("SELECT * FROM cells WHERE id = ? AND round_id = ? AND status IN ('held','sold')")
    .get(cellId, roundId) as Cell | undefined;
  if (!cell) return 0;
  const ids =
    allOfThem && cell.buyer_name_norm
      ? (
          db
            .prepare("SELECT id FROM cells WHERE round_id = ? AND buyer_name_norm = ? AND status IN ('held','sold')")
            .all(roundId, cell.buyer_name_norm) as { id: number }[]
        ).map((r) => r.id)
      : [cell.id];

  const trimmed = name.trim();
  const renameCell = db.prepare("UPDATE cells SET buyer_name = ?, buyer_name_norm = ? WHERE id = ?");
  const renameDraws = db.prepare("UPDATE draws SET winner_name = ? WHERE round_id = ? AND winner_cell_id = ?");
  db.exec("BEGIN");
  try {
    for (const id of ids) {
      renameCell.run(trimmed, normName(trimmed), id);
      renameDraws.run(trimmed, roundId, id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return ids.length;
}

/** Every buyer name used across all rounds, most-used first - suggestions when correcting a name.
 *  Spellings of the same person collapse to the one they've used most. */
export function knownBuyerNames(): string[] {
  const rows = db
    .prepare(
      `SELECT buyer_name_norm AS norm, buyer_name AS name, COUNT(*) AS n FROM cells
       WHERE buyer_name_norm IS NOT NULL AND status IN ('held','sold')
       GROUP BY buyer_name_norm, buyer_name ORDER BY n DESC`,
    )
    .all() as { norm: string; name: string; n: number }[];
  const best = new Map<string, { name: string; n: number }>();
  for (const r of rows) {
    const b = best.get(r.norm);
    if (b) b.n += r.n;
    else best.set(r.norm, { name: r.name, n: r.n });
  }
  return [...best.values()].sort((a, b) => b.n - a.n).map((b) => b.name);
}

/** Admin: every name ever used, for tidying up nicknames (/admin/navn). */
export function listNameUses(): NameUse[] {
  return buildNameUses(
    listRounds(),
    plainAll<Cell>(db.prepare("SELECT * FROM cells WHERE status IN ('held','sold')").all()),
    plainAll<Draw>(db.prepare("SELECT * FROM draws WHERE winner_name IS NOT NULL").all()),
  );
}

/** Admin: make several names one person. Every square, win and organiser field under any of
 *  `norms` gets `name`, in all rounds. Money is untouched. Returns the rounds it changed. */
export function mergeNames(norms: string[], name: string): number[] {
  const trimmed = name.trim().replace(/\s+/g, " ");
  const targets = new Set(norms.map(normName));
  const touched = new Set<number>();
  const cells = db.prepare(
    "SELECT id, round_id, buyer_name_norm FROM cells WHERE buyer_name_norm IS NOT NULL AND status IN ('held','sold')",
  ).all() as { id: number; round_id: number; buyer_name_norm: string }[];
  const draws = db.prepare("SELECT id, round_id, winner_name FROM draws WHERE winner_name IS NOT NULL").all() as {
    id: number;
    round_id: number;
    winner_name: string;
  }[];
  const rounds = db.prepare("SELECT id, organizer_name FROM rounds").all() as { id: number; organizer_name: string }[];

  const renameCell = db.prepare("UPDATE cells SET buyer_name = ?, buyer_name_norm = ? WHERE id = ?");
  const renameDraw = db.prepare("UPDATE draws SET winner_name = ? WHERE id = ?");
  const renameOrganizer = db.prepare("UPDATE rounds SET organizer_name = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    for (const c of cells)
      if (targets.has(c.buyer_name_norm)) {
        renameCell.run(trimmed, normName(trimmed), c.id);
        touched.add(c.round_id);
      }
    for (const d of draws)
      if (targets.has(normName(d.winner_name))) {
        renameDraw.run(trimmed, d.id);
        touched.add(d.round_id);
      }
    for (const r of rounds)
      if (r.organizer_name && targets.has(normName(r.organizer_name))) {
        renameOrganizer.run(trimmed, r.id);
        touched.add(r.id);
      }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return [...touched];
}

export function adminClearCell(roundId: number, cellId: number): void {
  db.prepare(
    `UPDATE cells SET status = 'available', buyer_name = NULL, buyer_name_norm = NULL,
      buyer_contact = NULL, paid = 0, paid_marked_at = NULL, hold_expires_at = NULL, wishes = NULL
     WHERE id = ? AND round_id = ?`,
  ).run(cellId, roundId);
}

/* ---------------------------------------------------------------- prizes --- */

export function getPrizes(roundId: number): Prize[] {
  return plainAll<Prize>(
    db.prepare("SELECT * FROM prizes WHERE round_id = ? ORDER BY rank").all(roundId),
  );
}

export function addPrize(roundId: number, data: Partial<Prize>): number {
  const max = db
    .prepare("SELECT COALESCE(MAX(rank), 0) AS m FROM prizes WHERE round_id = ?")
    .get(roundId) as { m: number };
  const res = db
    .prepare(
      `INSERT INTO prizes (round_id, rank, name, varenummer, category, price, volume, image_url)
       VALUES (?,?,?,?,?,?,?,?)`,
    )
    .run(
      roundId,
      max.m + 1,
      data.name ?? "",
      data.varenummer ?? null,
      data.category ?? null,
      data.price ?? null,
      data.volume ?? null,
      data.image_url ?? null,
    );
  return Number(res.lastInsertRowid);
}

const PRIZE_FIELDS = ["name", "varenummer", "category", "price", "volume", "image_url"] as const;

export function updatePrize(roundId: number, prizeId: number, patch: Record<string, unknown>): void {
  const keys = Object.keys(patch).filter((k) => (PRIZE_FIELDS as readonly string[]).includes(k));
  if (!keys.length) return;
  db.prepare(
    `UPDATE prizes SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND round_id = ?`,
  ).run(...keys.map((k) => patch[k] as never), prizeId, roundId);
}

export function deletePrize(roundId: number, prizeId: number): void {
  db.prepare("DELETE FROM prizes WHERE id = ? AND round_id = ?").run(prizeId, roundId);
  const rows = getPrizes(roundId);
  rows.forEach((p, i) => {
    if (p.rank !== i + 1) db.prepare("UPDATE prizes SET rank = ? WHERE id = ?").run(i + 1, p.id);
  });
}

export function movePrize(roundId: number, prizeId: number, dir: -1 | 1): void {
  const rows = getPrizes(roundId);
  const idx = rows.findIndex((p) => p.id === prizeId);
  const swap = idx + dir;
  if (idx < 0 || swap < 0 || swap >= rows.length) return;
  db.prepare("UPDATE prizes SET rank = ? WHERE id = ?").run(rows[swap].rank, rows[idx].id);
  db.prepare("UPDATE prizes SET rank = ? WHERE id = ?").run(rows[idx].rank, rows[swap].id);
}

/* ----------------------------------------------------------------- draws --- */

export function getDraws(roundId: number): Draw[] {
  return plainAll<Draw>(
    db.prepare("SELECT * FROM draws WHERE round_id = ? ORDER BY rank").all(roundId),
  );
}

function upsertDraw(d: {
  roundId: number;
  rank: number;
  prizeId: number | null;
  row: number | null;
  col: number | null;
  winnerCellId: number | null;
  winnerName: string | null;
  method: DrawMode;
  seed: string | null;
  rerolls: string | null;
}): void {
  db.prepare(
    `INSERT INTO draws (round_id, rank, prize_id, row, col, winner_cell_id, winner_name, method, seed, rerolls, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?, datetime('now'))
     ON CONFLICT(round_id, rank) DO UPDATE SET
       prize_id = excluded.prize_id, row = excluded.row, col = excluded.col,
       winner_cell_id = excluded.winner_cell_id, winner_name = excluded.winner_name,
       method = excluded.method, seed = excluded.seed, rerolls = excluded.rerolls,
       skipped = 0, created_at = datetime('now')`,
  ).run(
    d.roundId,
    d.rank,
    d.prizeId,
    d.row,
    d.col,
    d.winnerCellId,
    d.winnerName,
    d.method,
    d.seed,
    d.rerolls,
  );
}

export interface DrawOutcome {
  outcome: "winner" | "empty" | "taken" | "no-eligible";
  row: number | null;
  col: number | null;
  winnerName: string | null;
  rerolls: [number, number][];
  seed: string | null;
  recorded: boolean;
}

/** A winner normally picks their prize afterwards; when only one prize is left there is nothing to pick. */
function onlyPrizeLeft(roundId: number, rank: number): number | null {
  const left = unclaimedPrizes(getPrizes(roundId), getDraws(roundId), rank);
  return left.length === 1 ? left[0].id : null;
}

/** Record which prize the winner of draw `rank` chose (null = undo the choice). Returns an error, if any. */
export function choosePrize(roundId: number, rank: number, prizeId: number | null): string | null {
  const draw = getDraws(roundId).find((d) => d.rank === rank);
  if (!draw?.winner_name) return "Denne trekningen har ingen vinner.";
  if (prizeId != null && !unclaimedPrizes(getPrizes(roundId), getDraws(roundId), rank).some((p) => p.id === prizeId))
    return "Premien er allerede valgt av en annen vinner.";
  // Once they have a prize they're no longer "picking later"; a later "Bytt" asks them again.
  db.prepare("UPDATE draws SET prize_id = ?, skipped = CASE WHEN ? IS NULL THEN skipped ELSE 0 END WHERE round_id = ? AND rank = ?").run(
    prizeId,
    prizeId,
    roundId,
    rank,
  );
  return null;
}

/** The winner isn't there and left no usable wishes: they pick later, and the draw goes on. */
export function skipChoice(roundId: number, rank: number): string | null {
  const draw = getDraws(roundId).find((d) => d.rank === rank);
  if (!draw?.winner_name) return "Denne trekningen har ingen vinner.";
  if (draw.prize_id != null) return "Vinneren har allerede valgt premie.";
  db.prepare("UPDATE draws SET skipped = 1 WHERE round_id = ? AND rank = ?").run(roundId, rank);
  return null;
}

/** Once every place is drawn, a single skipped winner gets the single prize that is left —
 *  there is nothing to choose between. */
export function autoAssignLast(roundId: number): void {
  const prizes = getPrizes(roundId);
  const draws = getDraws(roundId);
  if (draws.filter((d) => d.winner_name).length < prizes.length) return;
  const waiting = skippedWinners(draws);
  const left = unclaimedPrizes(prizes, draws);
  if (waiting.length === 1 && left.length === 1) choosePrize(roundId, waiting[0].rank, left[0].id);
}

/** After a prize choice: hand out a forced last prize, then let the round status follow
 *  (every prize picked -> "drawn", otherwise back to "closed"). Returns the new status if it changed. */
export function syncAfterChoice(roundId: number): RoundStatus | null {
  autoAssignLast(roundId);
  const round = getRound(roundId)!;
  const allDrawn = settleCheck(getCells(roundId), getPrizes(roundId), getDraws(roundId)).allDrawn;
  const next = allDrawn && round.status === "closed" ? "drawn" : !allDrawn && round.status === "drawn" ? "closed" : null;
  if (next) setRoundStatus(roundId, next);
  return next;
}

/** The viewer's squares: the ones this device reserved, plus everything bought in the
 *  profile's name (so they follow you across devices). */
export function myCellIds(roundId: number, holdIds: number[], me: string | null): number[] {
  if (!me) return holdIds;
  const rows = db
    .prepare("SELECT id FROM cells WHERE round_id = ? AND buyer_name_norm = ? AND status IN ('held','sold')")
    .all(roundId, normName(me)) as { id: number }[];
  return [...new Set([...holdIds, ...rows.map((r) => r.id)])];
}

/** Squares whose prize wishes you set. Wishes belong to a person: with a profile only the
 *  squares in your name, so buying for a colleague on your phone never touches their wishes.
 *  Without one, the squares this device reserved. */
export function wishCellIds(roundId: number, holdIds: number[], me: string | null): number[] {
  return me ? myCellIds(roundId, [], me) : holdIds;
}

/** A skipped winner picks for themselves (from their phone). `mineCellIds` proves the square is theirs. */
export function ownSkippedChoice(roundId: number, mineCellIds: number[], prizeId: number): string | null {
  const draw = skippedWinners(getDraws(roundId)).find(
    (d) => d.winner_cell_id != null && mineCellIds.includes(d.winner_cell_id),
  );
  if (!draw) return "Fant ingen premie du kan velge.";
  return choosePrize(roundId, draw.rank, prizeId);
}

/** Save a buyer's prize wishes on all their squares that haven't won yet. Returns an error, if any. */
export function setWishes(roundId: number, mineCellIds: number[], prizeIds: unknown[]): string | null {
  const valid = new Set(getPrizes(roundId).map((p) => p.id));
  const wishes = [...new Set(prizeIds.filter((x): x is number => Number.isInteger(x) && valid.has(x as number)))];
  const won = new Set(getDraws(roundId).map((d) => d.winner_cell_id));
  const targets = getCells(roundId).filter(
    (c) => mineCellIds.includes(c.id) && (c.status === "sold" || c.status === "held") && !won.has(c.id),
  );
  if (!targets.length) return "Fant ingen av rutene dine som fortsatt er med i trekningen.";
  const upd = db.prepare("UPDATE cells SET wishes = ? WHERE id = ? AND round_id = ?");
  for (const c of targets) upd.run(wishes.length ? JSON.stringify(wishes) : null, c.id, roundId);
  return null;
}

function takenCellIds(roundId: number, exceptRank: number): Set<number> {
  const rows = db
    .prepare(
      "SELECT winner_cell_id AS id FROM draws WHERE round_id = ? AND rank != ? AND winner_cell_id IS NOT NULL",
    )
    .all(roundId, exceptRank) as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

/** In the draw from the moment sales close: a reserved square can no longer be given up, so it
 *  counts like a sold one - the buyer owes for it either way. */
export function inDraw(c: Cell): boolean {
  return c.status === "sold" || c.status === "held";
}

/** Physical draw: the organiser types the dice result. Empty/taken -> reroll (not recorded). */
export function physicalDraw(roundId: number, rank: number, row: number, col: number): DrawOutcome {
  const taken = takenCellIds(roundId, rank);
  const cell = db
    .prepare("SELECT * FROM cells WHERE round_id = ? AND row = ? AND col = ?")
    .get(roundId, row, col) as Cell | undefined;

  if (!cell || !inDraw(cell)) {
    return { outcome: "empty", row, col, winnerName: null, rerolls: [], seed: null, recorded: false };
  }
  if (taken.has(cell.id)) {
    return { outcome: "taken", row, col, winnerName: null, rerolls: [], seed: null, recorded: false };
  }
  upsertDraw({
    roundId,
    rank,
    prizeId: onlyPrizeLeft(roundId, rank),
    row,
    col,
    winnerCellId: cell.id,
    winnerName: cell.buyer_name,
    method: "physical",
    seed: null,
    rerolls: null,
  });
  return {
    outcome: "winner",
    row,
    col,
    winnerName: cell.buyer_name,
    rerolls: [],
    seed: null,
    recorded: true,
  };
}

/** History correction (switched on in /superadmin): set which square won draw `rank` after the fact, or clear
 *  it with null. The winner's name follows the square. Prize choice and money are untouched.
 *  Returns an error, if any. */
export function setDrawSquare(roundId: number, rank: number, cellId: number | null): string | null {
  const draw = getDraws(roundId).find((d) => d.rank === rank);
  if (!draw) return "Trekningen finnes ikke.";
  if (cellId == null) {
    db.prepare("UPDATE draws SET winner_cell_id = NULL, row = NULL, col = NULL WHERE id = ?").run(draw.id);
    return null;
  }
  const cell = plain<Cell>(db.prepare("SELECT * FROM cells WHERE id = ? AND round_id = ?").get(cellId, roundId));
  if (!cell || !inDraw(cell)) return "Ruten er ikke solgt.";
  if (takenCellIds(roundId, rank).has(cell.id)) return `Rute ${cell.col}-${cell.row} har allerede vunnet en annen premie.`;
  db.prepare("UPDATE draws SET winner_cell_id = ?, row = ?, col = ?, winner_name = ? WHERE id = ?").run(
    cell.id,
    cell.row,
    cell.col,
    cell.buyer_name,
    draw.id,
  );
  return null;
}

/** Digital draw: server rolls a verifiable seed, skipping empty/taken squares. */
export function digitalDraw(roundId: number, rank: number): DrawOutcome {
  const round = getRound(roundId)!;
  const taken = takenCellIds(roundId, rank);
  const sold = new Map<string, Cell>();
  for (const c of getCells(roundId)) {
    if (inDraw(c) && !taken.has(c.id)) sold.set(`${c.row},${c.col}`, c);
  }
  const seed = makeSeed();
  const rolls = seededRolls(seed, round.grid_size);
  const rerolls: [number, number][] = [];

  if (sold.size === 0) {
    upsertDraw({
      roundId,
      rank,
      prizeId: null,
      row: null,
      col: null,
      winnerCellId: null,
      winnerName: null,
      method: "digital",
      seed,
      rerolls: JSON.stringify([]),
    });
    return { outcome: "no-eligible", row: null, col: null, winnerName: null, rerolls: [], seed, recorded: true };
  }

  for (const [r, c] of rolls) {
    const hit = sold.get(`${r},${c}`);
    if (hit) {
      upsertDraw({
        roundId,
        rank,
        prizeId: onlyPrizeLeft(roundId, rank),
        row: r,
        col: c,
        winnerCellId: hit.id,
        winnerName: hit.buyer_name,
        method: "digital",
        seed,
        rerolls: JSON.stringify(rerolls),
      });
      return { outcome: "winner", row: r, col: c, winnerName: hit.buyer_name, rerolls, seed, recorded: true };
    }
    rerolls.push([r, c]);
  }
  // extremely unlikely - no sold square hit in 400 rolls
  return { outcome: "no-eligible", row: null, col: null, winnerName: null, rerolls, seed, recorded: false };
}

export function clearDraw(roundId: number, rank: number): void {
  db.prepare("DELETE FROM draws WHERE round_id = ? AND rank = ?").run(roundId, rank);
}

/* ------------------------------------------------------------ round state --- */

/** Only the organiser closes sales. sales_close_at is the announced deadline - stragglers can still
 *  buy after it until "Steng salget" is pressed. */
export function salesOpen(round: Round): boolean {
  return round.status === "open";
}

export function restrictionActive(round: Round, now = Date.now()): boolean {
  if (round.max_per_person <= 0) return false;
  if (!round.restriction_lifts_at) return true;
  return new Date(round.restriction_lifts_at).getTime() > now;
}

function toPublicCell(c: Cell, mineIds: Set<number>): PublicCell {
  const occupied = c.status === "sold" || c.status === "held";
  return {
    row: c.row,
    col: c.col,
    status: c.status,
    name: occupied ? c.buyer_name : null,
    paid: !!c.paid,
    mine: mineIds.has(c.id) || undefined,
    wishes: mineIds.has(c.id) ? parseWishes(c.wishes) : undefined,
  };
}

function toPublicDraw(round: Round, prizes: Prize[], draws: Draw[], rank: number): PublicDraw {
  const draw = draws.find((d) => d.rank === rank) ?? null;
  const prize = (draw && prizeOfDraw(prizes, draw)) ?? null;
  return {
    rank,
    prizeId: prize?.id ?? null,
    prizeName: prize?.name || null,
    prizeImage: prize?.image_url || vinmonopoletImage(prize?.varenummer ?? null),
    row: draw?.row ?? null,
    col: draw?.col ?? null,
    winnerName: draw?.winner_name ?? null,
    method: (draw?.method as DrawMode) ?? round.draw_mode,
    pending: !draw,
    skipped: !!draw?.skipped && !prize,
  };
}

export function buildRoundState(roundId: number, mineCellIds: number[] = []): RoundState | undefined {
  const round = getRound(roundId);
  if (!round) return undefined;

  const cells = getCells(roundId);
  const prizes = getPrizes(roundId);
  const draws = getDraws(roundId);
  const mine = new Set(mineCellIds);
  const money: MoneySummary = computeMoney(round, cells, prizes);

  return {
    round,
    prizes,
    cells: cells.map((c) => toPublicCell(c, mine)),
    // One slot per prize, in draw order; which prize each winner took is up to them.
    draws: prizes.map((_, i) => toPublicDraw(round, prizes, draws, i + 1)),
    money,
    salesOpen: salesOpen(round),
    restrictionActive: restrictionActive(round),
    now: nowIso(),
  };
}

/* ------------------------------------------------------------------ stats --- */

export interface PersonStats {
  lodd: number;
  rounds: number;
  wins: number;
  firstPrizes: number;
  /** The square you've won on most, else the one you've bought most. */
  luckySquare: { row: number; col: number; wins: number; sold: number } | null;
}

/** One person's own numbers across a set of rounds (the "Dine tall" line on /historikk). */
export function personStats(roundIds: number[], name: string): PersonStats {
  const norm = normName(name);
  const rounds = new Set<number>();
  const squares = new Map<string, { row: number; col: number; wins: number; sold: number }>();
  const square = (row: number, col: number) => {
    const key = `${row},${col}`;
    const s = squares.get(key) ?? { row, col, wins: 0, sold: 0 };
    squares.set(key, s);
    return s;
  };
  let lodd = 0;
  let wins = 0;
  let firstPrizes = 0;

  for (const roundId of roundIds) {
    for (const c of getCells(roundId)) {
      if (!inDraw(c) || c.buyer_name_norm !== norm) continue;
      lodd += 1;
      rounds.add(roundId);
      square(c.row, c.col).sold += 1;
    }
    for (const d of getDraws(roundId)) {
      if (!d.winner_name || normName(d.winner_name) !== norm) continue;
      wins += 1;
      if (d.rank === 1) firstPrizes += 1;
      if (d.row && d.col) square(d.row, d.col).wins += 1;
    }
  }

  const luckySquare =
    [...squares.values()].sort((a, b) => b.wins - a.wins || b.sold - a.sold)[0] ?? null;
  return { lodd, rounds: rounds.size, wins, firstPrizes, luckySquare };
}

// Minimum lodd before someone's win-rate counts, so one lucky ticket doesn't top the list.
const MIN_LODD_FOR_LUCK_INDEX = 5;

/** Fun facts across a set of rounds (typically the completed ones): who wins the most,
 *  who shows up most often, who has waited longest, and a per-square win heatmap. */
export function computeStats(roundIds: number[], limit = 5): LotteryStats {
  const winners = new Map<string, { name: string; wins: number }>();
  // dryLodd/dryRounds count since the last win, so rounds must be walked oldest first.
  const participants = new Map<
    string,
    { name: string; rounds: Set<number>; lodd: number; wins: number; dryLodd: number; dryRounds: number }
  >();
  const wanted = new Set(roundIds);
  const chrono = listRounds()
    .filter((r) => wanted.has(r.id))
    .map((r) => r.id)
    .reverse();
  const squares = new Map<string, { row: number; col: number; sold: number; wins: number }>();
  let gridSize = 6;
  let totalWins = 0;
  let locatedWins = 0;

  for (const roundId of chrono) {
    const round = getRound(roundId);
    if (round) gridSize = Math.max(gridSize, round.grid_size);

    for (const c of getCells(roundId)) {
      if (!inDraw(c) || !c.buyer_name_norm) continue;
      const p = participants.get(c.buyer_name_norm) ?? {
        name: c.buyer_name!,
        rounds: new Set<number>(),
        lodd: 0,
        wins: 0,
        dryLodd: 0,
        dryRounds: 0,
      };
      p.lodd += 1;
      p.dryLodd += 1;
      if (!p.rounds.has(roundId)) p.dryRounds += 1;
      p.rounds.add(roundId);
      participants.set(c.buyer_name_norm, p);

      const sKey = `${c.row},${c.col}`;
      const s = squares.get(sKey) ?? { row: c.row, col: c.col, sold: 0, wins: 0 };
      s.sold += 1;
      squares.set(sKey, s);
    }

    for (const d of getDraws(roundId)) {
      if (!d.winner_name) continue;
      totalWins += 1;
      const key = normName(d.winner_name);
      const w = winners.get(key) ?? { name: d.winner_name, wins: 0 };
      w.wins += 1;
      winners.set(key, w);
      const p = participants.get(key);
      if (p) {
        p.wins += 1;
        p.dryLodd = 0;
        p.dryRounds = 0;
      }

      if (d.row && d.col) {
        const sKey = `${d.row},${d.col}`;
        const s = squares.get(sKey) ?? { row: d.row, col: d.col, sold: 0, wins: 0 };
        s.wins += 1;
        squares.set(sKey, s);
        locatedWins += 1;
      }
    }
  }

  const luckIndex = [...participants.values()]
    .filter((p) => p.lodd >= MIN_LODD_FOR_LUCK_INDEX)
    .map((p) => ({ name: p.name, lodd: p.lodd, wins: p.wins, pct: Math.round((p.wins / p.lodd) * 100) }))
    .sort((a, b) => b.pct - a.pct || b.wins - a.wins)
    .slice(0, limit);

  const drought = [...participants.values()]
    .filter((p) => p.dryLodd > 0)
    .map((p) => ({ name: p.name, lodd: p.dryLodd, rounds: p.dryRounds, neverWon: p.wins === 0 }))
    .sort((a, b) => b.lodd - a.lodd || b.rounds - a.rounds)
    .slice(0, limit);

  return {
    topWinners: [...winners.values()].sort((a, b) => b.wins - a.wins).slice(0, limit),
    topParticipants: [...participants.values()]
      .map((p) => ({ name: p.name, rounds: p.rounds.size, lodd: p.lodd }))
      .sort((a, b) => b.rounds - a.rounds || b.lodd - a.lodd)
      .slice(0, limit),
    luckIndex,
    drought,
    gridSize,
    squares: [...squares.values()].map(({ row, col, wins, sold }) => ({ row, col, wins, sold })),
    locatedWins,
    totalWins,
  };
}

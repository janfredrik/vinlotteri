// Import historical rounds from scripts/loddark-<year>.json (made by extract-loddark.py).
//   npm run import:history            # import settled weeks, skip ones already present
//   npm run import:history -- --force # replace weeks that were imported before
//   npm run import:history -- --all   # also import weeks with no winners recorded
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA } from "../lib/schema.mjs";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const ALL = args.has("--all");

const file =
  [...args].find((a) => a.endsWith(".json")) ||
  join("scripts", readdirSync("scripts").find((f) => /^loddark-\d+\.json$/.test(f)) || "loddark-2026.json");
const data = JSON.parse(readFileSync(file, "utf8"));

const dir = process.env.DATA_DIR || join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "vinlotteri.sqlite"));
db.exec("PRAGMA foreign_keys = ON");
db.exec(SCHEMA);

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

let imported = 0;
let skipped = 0;

for (const r of data.rounds) {
  if (!ALL && r.winners.length === 0) {
    console.log(`Uke ${r.week}: hopper over (ingen vinnere registrert – trolig pågående runde)`);
    skipped++;
    continue;
  }

  const existing = db.prepare("SELECT id FROM rounds WHERE title = ?").get(r.title);
  if (existing) {
    if (!FORCE) {
      console.log(`Uke ${r.week}: finnes allerede (id ${existing.id}) – bruk --force for å erstatte`);
      skipped++;
      continue;
    }
    db.prepare("DELETE FROM rounds WHERE id = ?").run(existing.id);
  }

  db.exec("BEGIN");
  try {
    const round = db
      .prepare(
        `INSERT INTO rounds (created_at, status, title, ticket_price, max_per_person, draw_mode,
          grid_size, organizer_name, vipps_number, vipps_message, carried_over, polet_cost, notes)
         VALUES (?, 'settled', ?, ?, 2, 'physical', ?, ?, ?, 'Vinlotteri', ?, ?, ?)`,
      )
      .run(
        `${r.date}T18:00:00.000Z`,
        r.title,
        r.ticket_price,
        r.grid_size,
        r.organizer_name,
        r.vipps_number,
        Math.round(r.carried_over ?? 0),
        r.polet_cost ?? null,
        `Importert fra «${data.source}»`,
      );
    const roundId = Number(round.lastInsertRowid);

    const sold = new Map(r.cells.map((c) => [`${c.row},${c.col}`, c.name]));
    const insCell = db.prepare(
      `INSERT INTO cells (round_id, row, col, status, buyer_name, buyer_name_norm, paid, paid_marked_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (let row = 1; row <= r.grid_size; row++) {
      for (let col = 1; col <= r.grid_size; col++) {
        const name = sold.get(`${row},${col}`);
        insCell.run(
          roundId,
          row,
          col,
          name ? "sold" : "available",
          name ?? null,
          name ? norm(name) : null,
          name ? 1 : 0,
          name ? `${r.date}T18:00:00.000Z` : null,
          `${r.date}T12:00:00.000Z`,
        );
      }
    }

    const cellByNorm = new Map();
    for (const c of db.prepare("SELECT id, row, col, buyer_name_norm FROM cells WHERE round_id = ? AND status = 'sold'").all(roundId)) {
      const list = cellByNorm.get(c.buyer_name_norm) ?? [];
      list.push(c);
      cellByNorm.set(c.buyer_name_norm, list);
    }
    const usedCell = new Set();

    for (const w of r.winners) {
      const prize = db
        .prepare("INSERT INTO prizes (round_id, rank, name) VALUES (?, ?, ?)")
        .run(roundId, w.rank, w.prize || `${w.rank}. premie`);
      const match = (cellByNorm.get(norm(w.name)) ?? []).find((c) => !usedCell.has(c.id));
      if (match) usedCell.add(match.id);
      db.prepare(
        `INSERT INTO draws (round_id, prize_id, rank, row, col, winner_cell_id, winner_name, method, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'physical', ?)`,
      ).run(
        roundId,
        Number(prize.lastInsertRowid),
        w.rank,
        match?.row ?? null,
        match?.col ?? null,
        match?.id ?? null,
        w.name,
        `${r.date}T18:30:00.000Z`,
      );
    }

    db.exec("COMMIT");
    imported++;
    console.log(`Uke ${r.week}: importert (id ${roundId}) – ${r.cells.length} lodd, ${r.winners.length} vinnere`);
  } catch (e) {
    db.exec("ROLLBACK");
    console.error(`Uke ${r.week}: FEIL –`, e.message);
  }
}

console.log(`\nFerdig: ${imported} importert, ${skipped} hoppet over.`);

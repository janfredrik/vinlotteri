// Import historical rounds from scripts/loddark-<year>.json (made by extract-loddark.py).
// Reads every year in order, or only the .json files given as arguments. Hand corrections for a year
// go in loddark-<year>-rettelser.json next to it, keyed by week (gitignored, it holds names):
//   { "17": { "winners": [{ "rank": 1, "name": "..", "col": 3, "row": 2 }], "organizer_name": "..",
//             "polet_cost": 609, "note": "Shown on the round page" } }
//   npm run import:history            # import settled weeks, skip ones already present
//   npm run import:history -- --force # replace weeks that were imported before
//   npm run import:history -- --all   # also import weeks with no winners recorded
import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join } from "node:path";
import { SCHEMA } from "../lib/schema.mjs";

const args = new Set(process.argv.slice(2));
const FORCE = args.has("--force");
const ALL = args.has("--all");

const given = [...args].filter((a) => a.endsWith(".json"));
const files = given.length
  ? given
  : readdirSync("scripts")
      .filter((f) => /^loddark-\d+\.json$/.test(f))
      .sort()
      .map((f) => join("scripts", f));
if (!files.length) {
  console.error("Fant ingen scripts/loddark-<år>.json. Kjør extract-loddark.py først.");
  process.exit(1);
}
const rounds = files
  .flatMap((f) => {
    const data = JSON.parse(readFileSync(f, "utf8"));
    const fixFile = f.replace(/\.json$/, "-rettelser.json");
    const fixes = existsSync(fixFile) ? JSON.parse(readFileSync(fixFile, "utf8")) : {};
    return data.rounds.map((r) => ({ ...r, ...fixes[r.week], source: basename(data.source) }));
  })
  .sort((a, b) => a.date.localeCompare(b.date));

// The 1. premie winner organises the next round, so a sheet that only has the Vipps number
// still tells us who organised it.
rounds.forEach((r, i) => {
  if (r.organizer_name || i === 0) return;
  const winner = rounds[i - 1].winners.find((w) => w.rank === 1)?.name;
  if (winner) r.organizer_name = winner;
});

// The sheets are typed by hand. Point out what does not add up before anything is written.
let warnings = 0;
const warn = (msg) => {
  console.warn(`ADVARSEL ${msg}`);
  warnings++;
};
rounds.forEach((r, i) => {
  if (r.note) return; // a known discrepancy, explained on the round page
  const prev = rounds[i - 1];
  if (prev && Math.abs((r.carried_over ?? 0) - (prev.sheet_videre ?? 0)) > 0.5) {
    warn(`${r.title}: inn ${r.carried_over} kr, men ${prev.title} førte videre ${prev.sheet_videre} kr`);
  }
  const fromGrid = r.cells.length * r.ticket_price;
  if (r.sheet_lodd_solgt != null && Math.abs(fromGrid - r.sheet_lodd_solgt) > 0.5) {
    warn(`${r.title}: ${r.cells.length} navn i rutenettet (${fromGrid} kr), men arket sier lodd solgt ${r.sheet_lodd_solgt} kr`);
  }
});
if (warnings) console.warn(`${warnings} advarsel(er). Appen regner ut fra rutenettet, ikke tallene i arket.\n`);

const dir = process.env.DATA_DIR || join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "vinlotteri.sqlite"));
db.exec("PRAGMA foreign_keys = ON");
db.exec(SCHEMA);

const norm = (s) => String(s || "").trim().toLowerCase().replace(/\s+/g, " ");

let imported = 0;
let skipped = 0;

for (const r of rounds) {
  if (!ALL && r.winners.length === 0) {
    console.log(`${r.title}: hopper over (ingen vinnere registrert – trolig pågående runde)`);
    skipped++;
    continue;
  }

  const existing = db.prepare("SELECT id FROM rounds WHERE title = ?").get(r.title);
  if (existing) {
    if (!FORCE) {
      console.log(`${r.title}: finnes allerede (id ${existing.id}) – bruk --force for å erstatte`);
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
        [`Importert fra «${r.source}»`, r.note].filter(Boolean).join("\n\n"),
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
      // A correction can name the square ("Rute 3-2" = col 3, row 2) when the name alone is ambiguous.
      const match = (cellByNorm.get(norm(w.name)) ?? []).find(
        (c) => !usedCell.has(c.id) && (w.row == null || (c.row === w.row && c.col === w.col)),
      );
      if (!match && w.row != null) console.warn(`ADVARSEL ${r.title}: ${w.name} har ikke rute ${w.col}-${w.row}`);
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
    console.log(`${r.title}: importert (id ${roundId}) – ${r.cells.length} lodd, ${r.winners.length} vinnere`);
  } catch (e) {
    db.exec("ROLLBACK");
    console.error(`${r.title}: FEIL –`, e.message);
  }
}

console.log(`\nFerdig: ${imported} importert, ${skipped} hoppet over.`);

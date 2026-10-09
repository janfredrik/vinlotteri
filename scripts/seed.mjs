// Demo data:  npm run seed
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { SCHEMA } from "../lib/schema.mjs";

const dir = process.env.DATA_DIR || join(process.cwd(), "data");
mkdirSync(dir, { recursive: true });
const db = new DatabaseSync(join(dir, "vinlotteri.sqlite"));
db.exec("PRAGMA foreign_keys = ON");
db.exec(SCHEMA);

const close = new Date(Date.now() + 2 * 3600_000).toISOString();
const lift = new Date(Date.now() + 1.5 * 3600_000).toISOString();

const r = db
  .prepare(
    `INSERT INTO rounds (status, title, ticket_price, max_per_person, restriction_lifts_at,
      sales_close_at, draw_mode, grid_size, organizer_name, vipps_number, vipps_message, carried_over)
     VALUES ('open','Vinlotteri – demo',15,2,?,?,'physical',6,'Kari','12345678','Vinlotteri',45)`,
  )
  .run(lift, close);
const roundId = Number(r.lastInsertRowid);

for (let row = 1; row <= 6; row++)
  for (let col = 1; col <= 6; col++)
    db.prepare(
      "INSERT INTO cells (round_id,row,col,status,created_at) VALUES (?,?,?, 'available', datetime('now'))",
    ).run(roundId, row, col);

const prizes = [
  ["4962301", "Giovanni Rosso Barbera d'Alba", 200, "0,75 l"],
  ["884401", "Abbazia Prosecco Extra Dry", 140, "0,75 l"],
  ["5776402", "Bishops Finger Kentish Strong Ale", 49, "0,5 l"],
];
prizes.forEach((p, i) =>
  db
    .prepare("INSERT INTO prizes (round_id,rank,name,varenummer,price,volume) VALUES (?,?,?,?,?,?)")
    .run(roundId, i + 1, p[1], p[0], p[2], p[3]),
);

const buyers = [
  [1, 1, "Ola N"],
  [2, 3, "Kari"],
  [3, 5, "Per H"],
  [4, 2, "AB"],
  [5, 5, "CD"],
  [6, 4, "ef"],
];
buyers.forEach(([row, col, name]) =>
  db
    .prepare(
      `UPDATE cells SET status='sold', buyer_name=?, buyer_name_norm=?, paid=1, paid_marked_at=datetime('now'),
        created_at=datetime('now') WHERE round_id=? AND row=? AND col=?`,
    )
    .run(name, String(name).toLowerCase(), roundId, row, col),
);

console.log(`Seeded round ${roundId}: http://localhost:3000/runde/${roundId}`);

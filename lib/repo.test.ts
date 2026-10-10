import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const dir = mkdtempSync(join(tmpdir(), "vinlotteri-repo-"));
process.env.DB_PATH = join(dir, "test.sqlite");

const { db } = await import("./db");
const repo = await import("./repo");

/** Like scripts/import-loddark.mjs: settled, with an ISO date, inserted after the live rounds. */
function importOld(title: string, date: string): number {
  const res = db
    .prepare("INSERT INTO rounds (created_at, status, title) VALUES (?, 'settled', ?)")
    .run(`${date}T18:00:00.000Z`, title);
  return Number(res.lastInsertRowid);
}

let live: number;
let older: number;
let newer: number;

beforeAll(() => {
  // A live round first (low id, SQLite's own "now" format), then last year imported on top.
  live = repo.createRound({ title: "Uke 41 – 2026" });
  repo.setRoundStatus(live, "drawn");
  older = importOld("Uke 50 – 2025", "2025-12-11");
  newer = importOld("Uke 51 – 2025", "2025-12-18");
});

afterAll(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

describe("rounds in the order they ran, not by id", () => {
  it("lists newest first even when imported history has higher ids", () => {
    expect(repo.listRounds().map((r) => r.id)).toEqual([live, newer, older]);
  });

  it("shows the live round on the front page, not an imported one", () => {
    expect(repo.getActiveRound()?.id).toBe(live);
  });

  it("finds the successor by date", () => {
    expect(repo.getSuccessor(older)?.id).toBe(newer);
    expect(repo.getSuccessor(newer)?.id).toBe(live);
    expect(repo.getSuccessor(live)).toBeUndefined();
  });

  it("still lets the live round start the next one", () => {
    const next = repo.createNextRound(live);
    expect(next).toBeDefined();
    expect(repo.getSuccessor(live)?.id).toBe(next);
    expect(repo.createNextRound(live)).toBeUndefined();
  });
});

describe("correcting a winning square afterwards", () => {
  /** An imported round: three sold squares, two winners known by name only. */
  function importedRound() {
    const id = importOld("Uke 35 – 2025", "2025-08-28");
    const cell = (row: number, col: number, name: string) =>
      Number(
        db
          .prepare("INSERT INTO cells (round_id, row, col, status, buyer_name, buyer_name_norm, paid) VALUES (?, ?, ?, 'sold', ?, ?, 1)")
          .run(id, row, col, name, name.toLowerCase()).lastInsertRowid,
      );
    const cells = { a: cell(2, 3, "Ola"), b: cell(5, 1, "Kari"), c: cell(1, 1, "Ola") };
    for (const [rank, name] of [[1, "Ola N."], [2, "Kari"]] as const)
      db.prepare("INSERT INTO draws (round_id, rank, winner_name, method) VALUES (?, ?, ?, 'physical')").run(id, rank, name);
    return { id, cells };
  }

  it("sets the square and takes the winner's name from it", () => {
    const { id, cells } = importedRound();
    expect(repo.setDrawSquare(id, 1, cells.a)).toBeNull();
    const d = repo.getDraws(id)[0];
    expect([d.winner_cell_id, d.row, d.col, d.winner_name]).toEqual([cells.a, 2, 3, "Ola"]);
    expect(repo.listRoundSummaries().find((r) => r.id === id)?.unplaced).toBe(1);
  });

  it("refuses a square that already won another prize, or one that isn't in the round", () => {
    const { id, cells } = importedRound();
    repo.setDrawSquare(id, 1, cells.a);
    expect(repo.setDrawSquare(id, 2, cells.a)).toMatch(/allerede vunnet/);
    expect(repo.setDrawSquare(id, 2, importedRound().cells.b)).toMatch(/ikke solgt/);
    expect(repo.setDrawSquare(id, 9, cells.b)).toMatch(/finnes ikke/);
  });

  it("clears the square but keeps the name", () => {
    const { id, cells } = importedRound();
    repo.setDrawSquare(id, 2, cells.b);
    expect(repo.setDrawSquare(id, 2, null)).toBeNull();
    const d = repo.getDraws(id)[1];
    expect([d.winner_cell_id, d.row, d.col, d.winner_name]).toEqual([null, null, null, "Kari"]);
  });
});

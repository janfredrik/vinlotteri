import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { SCHEMA } from "./schema.mjs";

const DATA_DIR = process.env.DATA_DIR || join(process.cwd(), "data");
const DB_PATH = process.env.DB_PATH || join(DATA_DIR, "vinlotteri.sqlite");

function open(): DatabaseSync {
  mkdirSync(dirname(DB_PATH), { recursive: true });
  const conn = new DatabaseSync(DB_PATH);
  conn.exec("PRAGMA busy_timeout = 5000;");
  conn.exec("PRAGMA journal_mode = WAL;");
  conn.exec("PRAGMA foreign_keys = ON;");
  conn.exec(SCHEMA);
  migrate(conn);
  return conn;
}

/** Columns added after the first release; CREATE TABLE IF NOT EXISTS leaves older files without them. */
function migrate(conn: DatabaseSync): void {
  const columns = (table: string) =>
    new Set((conn.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
  if (!columns("rounds").has("theme")) conn.exec("ALTER TABLE rounds ADD COLUMN theme TEXT NOT NULL DEFAULT 'auto'");
  if (!columns("cells").has("wishes")) conn.exec("ALTER TABLE cells ADD COLUMN wishes TEXT");
  if (!columns("draws").has("skipped")) conn.exec("ALTER TABLE draws ADD COLUMN skipped INTEGER NOT NULL DEFAULT 0");
}

const globalForDb = globalThis as unknown as { __vlDb?: DatabaseSync };

/** Opened lazily on first query so importing this module during `next build` does not touch the file. */
function getDb(): DatabaseSync {
  if (!globalForDb.__vlDb) globalForDb.__vlDb = open();
  return globalForDb.__vlDb;
}

export const db = new Proxy({} as DatabaseSync, {
  get(_target, prop, receiver) {
    const real = getDb();
    const value = Reflect.get(real as object, prop, receiver);
    return typeof value === "function" ? value.bind(real) : value;
  },
});

// Switches the superadmin flips at runtime (/superadmin), stored in the settings table.
import { db } from "./db";

function get(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row ? String(row.value) : null;
}

function set(key: string, value: string | null): void {
  if (value === null) db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  else db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").run(key, value);
}

/** Correcting the winning squares of settled rounds, e.g. imported history where the sheet only
 *  had the winner's name. Off by default: everyone past the PIN can administer. */
export function historyEdit(): boolean {
  return get("history_edit") === "1";
}

export function setHistoryEdit(on: boolean): void {
  set("history_edit", on ? "1" : null);
}

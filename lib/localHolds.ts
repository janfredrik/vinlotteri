import type { PublicCell } from "./types";

/** A reservation made on this device. The cellId is what confirm/release need. */
export interface LocalHold {
  cellId: number;
  row: number;
  col: number;
  name: string;
}

const holdsKey = (roundId: number) => `vl_holds_${roundId}`;

export function readLocalHolds(roundId: number): LocalHold[] {
  try {
    const arr = JSON.parse(localStorage.getItem(holdsKey(roundId)) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function writeLocalHolds(roundId: number, holds: LocalHold[]) {
  try {
    localStorage.setItem(holdsKey(roundId), JSON.stringify(holds));
  } catch {
    /* ignore */
  }
}

/** Local holds the server still agrees with. `mine` comes from the vl_holds cookie, which can
 *  lag a refresh behind a fresh reservation, so a hold is only dropped when the server actively
 *  contradicts it — not merely when `mine` hasn't caught up yet. */
export function reconcileHolds(holds: LocalHold[], cells: PublicCell[]): LocalHold[] {
  const byKey = new Map(cells.map((c) => [`${c.row},${c.col}`, c] as [string, PublicCell]));
  const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();
  return holds.filter((h) => {
    const c = byKey.get(`${h.row},${h.col}`);
    if (!c) return true; // not in the grid (yet) — keep
    if (c.status === "available") return false; // hold expired or was released
    if (c.status === "sold") return false; // confirmed (here or on another device)
    // still 'held' — keep unless it's clearly someone else's reservation
    return c.mine || !c.name || sameName(c.name, h.name);
  });
}

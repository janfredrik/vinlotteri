import { db } from "./db";
import type { Cell, Prize, Round } from "./types";

/**
 * Endringsloggen: hvem gjorde hva med en runde, så «hvem endret dette?» har et svar når
 * regnskapet ikke går opp. Alle forbi SITE_PIN kan administrere, så `actor` er navnet
 * enheten har valgt som profil (me-cookien), eller null når ingen er valgt.
 */
export interface AuditEntry {
  id: number;
  round_id: number | null;
  at: string;
  actor: string | null;
  ip: string | null;
  action: string;
  summary: string;
}

export interface AuditInput {
  roundId: number | null;
  actor: string | null;
  /** Klientens IP (lib/request-ip.ts). Et hint: alle på kontoret kan dele samme adresse. */
  ip?: string | null;
  action: string;
  summary: string;
  details?: unknown;
}

/** Skriver én linje. En feil her skal aldri stoppe handlingen som ble logget. */
export function logAudit(e: AuditInput): void {
  try {
    db.prepare(
      "INSERT INTO audit_log (round_id, at, actor, ip, action, summary, details) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      e.roundId,
      new Date().toISOString(),
      e.actor?.trim() || null,
      e.ip && e.ip !== "ukjent" ? e.ip : null,
      e.action,
      e.summary,
      e.details === undefined ? null : JSON.stringify(e.details),
    );
  } catch (err) {
    console.error("[audit] kunne ikke logge", e.action, err);
  }
}

/** Nyeste først. Uten `roundId` gis hele loggen, også runder som er slettet. */
export function getAuditLog(roundId: number | null = null, limit = 200): AuditEntry[] {
  const rows =
    roundId == null
      ? db.prepare("SELECT id, round_id, at, actor, ip, action, summary FROM audit_log ORDER BY id DESC LIMIT ?").all(limit)
      : db
          .prepare(
            "SELECT id, round_id, at, actor, ip, action, summary FROM audit_log WHERE round_id = ? ORDER BY id DESC LIMIT ?",
          )
          .all(roundId, limit);
  return rows.map((r) => ({ ...(r as object) }) as AuditEntry);
}

/* --------------------------------------------------------- beskrivelser --- */

/** "Rute 5-3", alltid kolonne-rad. */
export function square(c: Pick<Cell, "row" | "col">): string {
  return `Rute ${c.col}-${c.row}`;
}

/** "Rute 5-3 (Kari, betalt)" – slik ruten så ut før endringen. */
export function squareWithBuyer(c: Pick<Cell, "row" | "col" | "buyer_name" | "status" | "paid">): string {
  if (c.status === "available" || !c.buyer_name) return `${square(c)} (ledig)`;
  const state = c.status === "held" ? "reservert" : c.paid ? "betalt" : "ikke betalt";
  return `${square(c)} (${c.buyer_name}, ${state})`;
}

const ROUND_LABELS: Record<string, string> = {
  title: "tittel",
  ticket_price: "loddpris",
  max_per_person: "maks per person",
  restriction_lifts_at: "maks-grensen oppheves",
  sales_close_at: "salget stenger",
  draw_mode: "trekning",
  grid_size: "rutenett",
  organizer_name: "arrangør",
  vipps_number: "Vippsnummer",
  carried_over: "inn fra forrige runde",
  polet_cost: "kost på polet",
  notes: "notater",
  theme: "tema",
};

const PRIZE_LABELS: Record<string, string> = {
  name: "navn",
  varenummer: "varenummer",
  category: "kategori",
  price: "pris",
  volume: "volum",
  image_url: "bilde",
};

const MONEY = new Set(["ticket_price", "carried_over", "polet_cost", "price"]);
const DATES = new Set(["restriction_lifts_at", "sales_close_at"]);

function show(key: string, v: unknown): string {
  if (v == null || v === "") return "tom";
  if (key === "image_url") return "nytt bilde";
  if (DATES.has(key))
    // Serveren kan gå i UTC (Docker); loggen skal vise norsk tid.
    return new Date(String(v)).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Oslo" });
  if (key === "draw_mode") return v === "digital" ? "digital" : "fysisk";
  if (key === "notes") return `«${String(v).slice(0, 40)}${String(v).length > 40 ? "…" : ""}»`;
  if (MONEY.has(key)) return `${v} kr`;
  return String(v);
}

function same(a: unknown, b: unknown): boolean {
  const norm = (v: unknown) => (v == null || v === "" ? null : String(v));
  return norm(a) === norm(b);
}

/** Feltene som faktisk endret seg, som "pris 199 kr → 229 kr". Tomt når ingenting endret seg. */
function diff(before: Record<string, unknown>, patch: Record<string, unknown>, labels: Record<string, string>) {
  const changes: string[] = [];
  const details: Record<string, [unknown, unknown]> = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in labels) || same(before[k], v)) continue;
    changes.push(k === "image_url" ? "nytt bilde" : `${labels[k]} ${show(k, before[k])} → ${show(k, v)}`);
    details[k] = [before[k] ?? null, v ?? null];
  }
  return { changes, details };
}

export function describeRoundPatch(before: Round, patch: Record<string, unknown>) {
  const { changes, details } = diff(before as unknown as Record<string, unknown>, patch, ROUND_LABELS);
  return changes.length ? { summary: `Endret ${changes.join(", ")}`, details } : null;
}

export function describePrizePatch(before: Prize, patch: Record<string, unknown>) {
  const { changes, details } = diff(before as unknown as Record<string, unknown>, patch, PRIZE_LABELS);
  return changes.length
    ? { summary: `Endret premie «${before.name || `${before.rank}. premie`}»: ${changes.join(", ")}`, details }
    : null;
}

// Teams notifications through a Workflows webhook ("Post to a channel when a webhook request is
// received"). Every message is sent at most once per round and key, recorded in `notifications`,
// so restarts, the scheduler and undo/redo in the admin never post the same thing twice.
import { db } from "./db";
import { computeMoney } from "./money";
import { prizeOfDraw } from "./phases";
import { getCells, getDraws, getPrizes, getRound, normName } from "./repo";
import { kr } from "./format";
import { weekdayTime } from "./datetime";
import type { Round, RoundStatus } from "./types";

function webhookUrls(): string[] {
  return (process.env.TEAMS_WEBHOOK_URL ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function notificationsEnabled(): boolean {
  return webhookUrls().length > 0;
}

function roundUrl(roundId: number): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}/runde/${roundId}`;
}

interface Message {
  title: string;
  lines?: string[];
  facts?: [string, string][];
  roundId: number;
  linkLabel?: string;
}

function card(m: Message) {
  return {
    type: "message",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.adaptive",
        contentUrl: null,
        content: {
          $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
          type: "AdaptiveCard",
          version: "1.4",
          body: [
            { type: "TextBlock", text: m.title, weight: "Bolder", size: "Large", wrap: true },
            ...(m.lines ?? []).map((text) => ({ type: "TextBlock", text, wrap: true, spacing: "Small" })),
            ...(m.facts?.length
              ? [{ type: "FactSet", facts: m.facts.map(([title, value]) => ({ title, value })) }]
              : []),
          ],
          actions: [{ type: "Action.OpenUrl", title: m.linkLabel ?? "Åpne runden", url: roundUrl(m.roundId) }],
        },
      },
    ],
  };
}

/** Posts to every webhook; resolves to one error message per webhook that failed. */
function post(payload: unknown): Promise<string[]> {
  const body = JSON.stringify(payload);
  return Promise.all(
    webhookUrls().map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: AbortSignal.timeout(10_000),
      })
        .then(async (res) => {
          if (res.ok) return null;
          const detail = (await res.text().catch(() => "")).slice(0, 300);
          return `webhook svarte ${res.status}${detail ? `: ${detail}` : ""}`;
        })
        .catch((e) => `webhook feilet: ${(e as Error).message}`),
    ),
  ).then((results) => {
    const errors = results.filter((e): e is string => e !== null);
    for (const e of errors) console.error(`[notify] ${e}`);
    return errors;
  });
}

/** Send once per (round, key). `build` returning null skips without recording, so it can be retried. */
export function notifyOnce(roundId: number, key: string, build: () => Message | null): void {
  if (!notificationsEnabled()) return;
  try {
    const msg = build();
    if (!msg) return;
    const res = db
      .prepare("INSERT OR IGNORE INTO notifications (round_id, key) VALUES (?, ?)")
      .run(roundId, key);
    if (Number(res.changes) !== 1) return;
    void post(card(msg));
  } catch (e) {
    console.error(`[notify] ${key} for runde ${roundId}:`, (e as Error).message);
  }
}

/* --------------------------------------------------------------- messages --- */

const name = (r: Round) => r.title || `Runde ${r.id}`;

function salesFacts(roundId: number): { round: Round; facts: [string, string][]; free: number } | null {
  const round = getRound(roundId);
  if (!round) return null;
  const cells = getCells(roundId);
  const money = computeMoney(round, cells, getPrizes(roundId));
  const free = cells.filter((c) => c.status === "available").length;
  return {
    round,
    free,
    facts: [
      ["Solgt", `${money.sold} av ${cells.length} lodd`],
      ["Ledige ruter", String(free)],
    ],
  };
}

function opened(roundId: number): Message | null {
  const round = getRound(roundId);
  if (!round) return null;
  const prizes = getPrizes(roundId);
  const facts: [string, string][] = [];
  if (round.organizer_name) facts.push(["Arrangør", round.organizer_name]);
  if (prizes.length) facts.push(["Premier", prizes.map((p) => p.name || "ukjent premie").join(", ")]);
  return { roundId, title: `🍷 Loddsalget er åpent – ${name(round)}`, facts, linkLabel: "Kjøp lodd" };
}

function closingSoon(roundId: number): Message | null {
  const s = salesFacts(roundId);
  if (!s) return null;
  return {
    roundId,
    title: `⏰ Loddsalget stenger ${weekdayTime(s.round.sales_close_at)}`,
    lines: [s.free ? `Fortsatt ${s.free} ledige ruter – sikre deg et lodd!` : "Alle ruter er solgt."],
    facts: s.facts,
    linkLabel: "Kjøp lodd",
  };
}

function drawn(roundId: number): Message | null {
  const round = getRound(roundId);
  if (!round) return null;
  const prizes = getPrizes(roundId);
  const winners = getDraws(roundId).filter((d) => d.winner_name);
  if (!winners.length) return null;
  const lines = winners.map((d) => {
    const prize = prizeOfDraw(prizes, d);
    const square = d.row != null && d.col != null ? ` (rute ${d.col}-${d.row})` : "";
    return `${d.rank}. **${d.winner_name}**${square}${prize?.name ? ` – ${prize.name}` : ""}`;
  });
  // Whoever is drawn first arranges next week.
  const first = winners.find((d) => d.rank === 1);
  if (first) {
    lines.push(`👑 **${first.winner_name}** arrangerer neste runde.`);
    // The pot moves on with the job (same as the Handover step in the admin).
    const videre = computeMoney(round, getCells(roundId), prizes).videre;
    const from = round.organizer_name.trim();
    if (videre > 0 && normName(from) !== normName(first.winner_name ?? ""))
      lines.push(`💸 ${from || "Arrangøren"} vippser ${kr(videre)} til ${first.winner_name}.`);
  }
  lines.push("📋 Husk å avslutte runden i admin, så neste runde kan starte.");
  return { roundId, title: `🏆 Vinnerne er trukket – ${name(round)}`, lines, linkLabel: "Se vinnerne" };
}

/* ---------------------------------------------------------------- triggers --- */

/** Call after the round's status has been changed. */
export function onStatusChange(roundId: number, status: RoundStatus): void {
  if (status === "open") notifyOnce(roundId, "opened", () => opened(roundId));
  else if (status === "drawn") notifyOnce(roundId, "drawn", () => drawn(roundId));
}

const HOUR = 3_600_000;
const TOO_LATE = 5 * 60_000;

/** The "stenger om 1 time" reminder for open rounds; run by lib/scheduler.ts every minute. */
export function checkDeadlines(now = Date.now()): void {
  if (!notificationsEnabled()) return;
  const rounds = db
    .prepare("SELECT id, sales_close_at FROM rounds WHERE status = 'open' AND sales_close_at IS NOT NULL")
    .all() as { id: number; sales_close_at: string }[];
  for (const r of rounds) {
    const left = Date.parse(r.sales_close_at) - now;
    if (Number.isNaN(left)) continue;
    // Keyed on the deadline itself, so moving it gives a fresh reminder.
    if (left > TOO_LATE && left <= HOUR) notifyOnce(r.id, `closing:${r.sales_close_at}`, () => closingSoon(r.id));
  }
}

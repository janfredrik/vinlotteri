// Teams notifications through a Workflows webhook ("Post to a channel when a webhook request is
// received"). Every message is sent at most once per round and key, recorded in `notifications`,
// so restarts, the scheduler and undo/redo in the admin never post the same thing twice.
import { db } from "./db";
import { computeMoney } from "./money";
import { prizeOfDraw } from "./phases";
import { getCells, getDraws, getPrizes, getRound, normName } from "./repo";
import { kr } from "./format";
import { weekdayTime } from "./datetime";
import { roundSeason, seasonInfo } from "./season";
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

function appUrl(path: string): string {
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
  return `${base}${path}`;
}

interface Message {
  title: string;
  lines?: string[];
  facts?: [string, string][];
  roundId: number;
  linkLabel?: string;
  /** Path to link to instead of the round. */
  path?: string;
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
          actions: [{ type: "Action.OpenUrl", title: m.linkLabel ?? "Åpne runden", url: appUrl(m.path ?? `/runde/${m.roundId}`) }],
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
  const greeting = seasonGreeting(round.theme);
  return {
    roundId,
    title: `🍷 Loddsalget er åpent – ${name(round)}`,
    lines: greeting ? [greeting] : undefined,
    facts,
    linkLabel: "Kjøp lodd",
  };
}

/** The round's seasonal greeting as the buyer page shows it ("🎃 Knask eller knep!"), if it has a theme. */
export function seasonGreeting(theme: string | null | undefined): string | null {
  const season = roundSeason(theme);
  if (!season) return null;
  const { emoji, greeting } = seasonInfo(season);
  return `${emoji} ${greeting}`;
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

function nudge(roundId: number): Message | null {
  const s = salesFacts(roundId);
  if (!s) return null;
  return {
    roundId,
    title: `🍷 Fortsatt ${s.free} ledige ruter – ${name(s.round)}`,
    lines: [`Mindre enn halvparten av loddene er solgt, og salget stenger ${weekdayTime(s.round.sales_close_at)}.`],
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

function wrapped(roundId: number, year: number): Message {
  return {
    roundId,
    title: `🍷 Årgang ${year} er tappet`,
    lines: ["Året i Vinlotteri er oppsummert: vinnerne, rutene, pengene og din egen årgang."],
    linkLabel: "Smak på året",
    path: `/wrapped/${year}`,
  };
}

/* ---------------------------------------------------------------- triggers --- */

/** Call when the year's Wrapped is released from /superadmin; keyed on the year, so only once. */
export function onWrappedReleased(roundId: number, year: number): void {
  notifyOnce(roundId, `wrapped:${year}`, () => wrapped(roundId, year));
}

/** Call after the round's status has been changed. */
export function onStatusChange(roundId: number, status: RoundStatus): void {
  if (status === "open") notifyOnce(roundId, "opened", () => opened(roundId));
  else if (status === "drawn") notifyOnce(roundId, "drawn", () => drawn(roundId));
}

const HOUR = 3_600_000;
const TOO_LATE = 5 * 60_000;

/** Local time of the closing-day "under halvparten solgt" nudge, with some slack for restarts. */
const NUDGE_HOUR = 11;
const NUDGE_WINDOW_MIN = 30;

/**
 * Whether an open round gets the 11:00 nudge: on the day sales close, within the window, less than
 * half sold, and not so close to the deadline that the "stenger om 1 time" message covers it.
 */
export function shouldNudge(
  r: { sales_close_at: string | null; sold: number; total: number },
  now: Date,
): boolean {
  if (!r.sales_close_at) return false;
  const close = new Date(r.sales_close_at);
  if (Number.isNaN(close.getTime()) || localDate(close) !== localDate(now)) return false;
  if (now.getHours() !== NUDGE_HOUR || now.getMinutes() >= NUDGE_WINDOW_MIN) return false;
  if (r.total === 0 || r.sold * 2 >= r.total) return false;
  return close.getTime() - now.getTime() > HOUR;
}

/** Local calendar date. */
function localDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Time-based messages for open rounds; run by lib/scheduler.ts every minute. */
export function checkDeadlines(now = Date.now()): void {
  if (!notificationsEnabled()) return;
  checkNudges(new Date(now));
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

/** The 11:00 nudge on closing day when less than half the tickets are sold; once per round and deadline. */
function checkNudges(now: Date): void {
  const rounds = db
    .prepare(
      `SELECT r.id, r.sales_close_at,
              SUM(c.status = 'sold') AS sold, COUNT(c.round_id) AS total
         FROM rounds r LEFT JOIN cells c ON c.round_id = r.id
        WHERE r.status = 'open' AND r.sales_close_at IS NOT NULL
        GROUP BY r.id`,
    )
    .all() as { id: number; sales_close_at: string; sold: number | null; total: number }[];
  for (const r of rounds) {
    if (shouldNudge({ ...r, sold: r.sold ?? 0 }, now))
      notifyOnce(r.id, `nudge:${r.sales_close_at}`, () => nudge(r.id));
  }
}

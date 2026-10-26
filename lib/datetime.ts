/** ISO string -> value for <input type="datetime-local"> in the viewer's local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

/** datetime-local value -> ISO string (or null when empty). */
export function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" });
}

/** "fredag kl. 14:30" — adds a short date when the time is more than a week out. */
export function weekdayTime(iso: string | null, now: Date = new Date()): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const withinWeek = d.getTime() - now.getTime() < 7 * 86_400_000;
  return d.toLocaleString("nb-NO", {
    weekday: "long",
    ...(withinWeek ? {} : { day: "numeric", month: "short" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** The next date after `from` that falls on `weekday` (0=Sun..6=Sat) — never today, local time. */
export function nextWeekday(weekday: number, from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() !== weekday);
  return d;
}

/** A local date combined with a time of day, as an ISO string. */
export function atTime(date: Date, hours: number, minutes: number): string {
  const d = new Date(date);
  d.setHours(hours, minutes, 0, 0);
  return d.toISOString();
}

/** ISO-8601 week and the year it belongs to: Friday 1 Jan 2027 is week 53 of 2026. */
export function isoWeekYear(date: Date): { week: number; year: number } {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return { week: Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7), year: d.getUTCFullYear() };
}

/** ISO-8601 week number for a date. */
export function isoWeek(date: Date): number {
  return isoWeekYear(date).week;
}

/** The year a round belongs to in history, stats and Årgang: the year its sales close (the draw
 *  Friday, local time), so a round set up in December for a January Friday counts for January.
 *  Imported history and rounds without a closing time fall back to created_at, which is either
 *  SQLite's "2026-10-09 13:16:53" or the import's ISO string. */
export function roundYear(r: { created_at: string; sales_close_at: string | null }): number {
  const closes = r.sales_close_at ? new Date(r.sales_close_at) : null;
  if (closes && !Number.isNaN(closes.getTime())) return closes.getFullYear();
  return Number(r.created_at.slice(0, 4));
}

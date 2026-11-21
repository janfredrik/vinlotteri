import Link from "next/link";
import type { AuditEntry } from "@/lib/audit";

function when(iso: string): string {
  return new Date(iso).toLocaleString("nb-NO", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    // Siden /admin/logg rendres på serveren, som kan gå i UTC.
    timeZone: "Europe/Oslo",
  });
}

/** Endringsloggen som liste, nyeste først. `showRound` lenker hver linje til runden sin. */
export function AuditList({ entries, showRound = false }: { entries: AuditEntry[]; showRound?: boolean }) {
  if (!entries.length) return <p className="text-sm text-plum/70">Ingen endringer er logget ennå.</p>;
  return (
    <ol className="divide-y divide-plum/10 text-sm">
      {entries.map((e) => (
        <li key={e.id} className="flex flex-col gap-0.5 py-2 sm:flex-row sm:gap-4">
          <span className="shrink-0 tabular-nums text-plum/70 sm:w-36">{when(e.at)}</span>
          <span className="min-w-0 flex-1 text-plum">
            {e.summary}
            {showRound && e.round_id != null && (
              <>
                {" · "}
                <Link href={`/admin/runde/${e.round_id}`} className="text-wine underline">
                  runde #{e.round_id}
                </Link>
              </>
            )}
          </span>
          <span className="shrink-0 text-plum/70 sm:w-40 sm:text-right">
            {e.actor ?? "ukjent enhet"}
            {e.ip && <span className="block text-xs tabular-nums text-plum/60">{e.ip}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

/** Sammenfoldet nederst på rundesiden. */
export default function AuditLog({ entries }: { entries: AuditEntry[] }) {
  return (
    <details className="border-t border-plum/10 pt-4 text-sm">
      <summary className="cursor-pointer text-plum/70 hover:text-wine">
        Endringslogg{entries.length ? ` (${entries.length}${entries.length >= 100 ? "+" : ""})` : ""}
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-plum/70">
          Hvem som gjorde hva med runden. Navnet er profilen enheten har valgt øverst på siden.{" "}
          <Link href="/admin/logg" className="text-wine underline">
            Hele loggen
          </Link>
        </p>
        <AuditList entries={entries} />
      </div>
    </details>
  );
}

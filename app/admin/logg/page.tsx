import Link from "next/link";
import { getAuditLog } from "@/lib/audit";
import { AuditList } from "@/components/admin/AuditLog";

export const dynamic = "force-dynamic";

/** Hele endringsloggen på tvers av runder, også runder som er slettet. Bak SITE_PIN via proxy. */
export default function AuditPage() {
  const entries = getAuditLog(null, 500);
  return (
    <div className="space-y-4">
      <Link href="/admin" className="text-sm text-plum/70 hover:text-wine">
        ← Alle runder
      </Link>
      <h1 className="font-display text-3xl font-semibold text-wine">Endringslogg</h1>
      <p className="text-sm text-plum/70">De siste {entries.length} endringene, nyeste først.</p>
      <AuditList entries={entries} showRound />
    </div>
  );
}

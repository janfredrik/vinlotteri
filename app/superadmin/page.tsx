import SuperadminHome from "@/components/superadmin/SuperadminHome";
import UnlockView from "@/components/UnlockView";
import { GATE_ON, SUPER_ON } from "@/lib/access";
import { isSuper } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Not linked from anywhere: whoever runs the lottery opens /superadmin by hand. */
export default async function SuperadminPage() {
  if (await isSuper()) return <SuperadminHome />;
  if (!SUPER_ON && GATE_ON) {
    return (
      <div className="mx-auto max-w-prose pt-10 text-center sm:pt-20">
        <h1 className="font-display text-3xl font-semibold text-wine">Superadmin</h1>
        <p className="mt-2 text-pretty text-plum/70">
          Ikke satt opp. Legg inn <code className="font-mono text-sm">SUPERADMIN_PIN</code> i <code className="font-mono text-sm">.env</code> og start
          appen på nytt.
        </p>
      </div>
    );
  }
  return <UnlockView endpoint="/api/superadmin/access" title="Superadmin" lead="Skriv inn superadmin-PIN-en." to="/superadmin" />;
}

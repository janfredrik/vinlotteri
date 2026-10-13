import { redirect } from "next/navigation";
import { getActiveRound } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function Unc() {
  const round = getActiveRound();
  if (round) redirect(`/runde/${round.id}/unc`);
  redirect("/historikk");
}

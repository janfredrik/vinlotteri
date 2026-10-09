import { redirect } from "next/navigation";
import { getActiveRound } from "@/lib/repo";

export const dynamic = "force-dynamic";

export default function Home() {
  const round = getActiveRound();
  if (round) redirect(`/runde/${round.id}`);
  redirect("/historikk");
}

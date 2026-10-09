import { notFound } from "next/navigation";
import { buildRoundState } from "@/lib/repo";
import { readHoldIds } from "@/lib/holds-cookie";
import { vippsPresentation } from "@/lib/present";
import RoundView from "@/components/RoundView";

export const dynamic = "force-dynamic";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  // Your own squares (and wishes) are known from the first paint, not only after the first live update.
  const state = buildRoundState(id, await readHoldIds());
  if (!state) notFound();
  const vipps = await vippsPresentation(state.round);
  return <RoundView roundId={id} initial={{ ...state, vipps }} />;
}

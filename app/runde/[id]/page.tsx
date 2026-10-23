import { notFound } from "next/navigation";
import { buildRoundState, getRoundNeighbours, myCellIds } from "@/lib/repo";
import { readHoldIds } from "@/lib/holds-cookie";
import { readMe } from "@/lib/me-cookie";
import { cookies } from "next/headers";
import { SEASON_OFF_COOKIE, cleanSeasonOff } from "@/lib/season";
import { vippsPresentation } from "@/lib/present";
import RoundView from "@/components/RoundView";

export const dynamic = "force-dynamic";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  // Your own squares (and wishes) are known from the first paint, not only after the first live update.
  const me = await readMe();
  const state = buildRoundState(id, myCellIds(id, await readHoldIds(), me));
  if (!state) notFound();
  const vipps = await vippsPresentation(state.round);
  return <RoundView roundId={id} initial={{ ...state, vipps }} initialMe={me} initialSeasonOff={cleanSeasonOff((await cookies()).get(SEASON_OFF_COOKIE)?.value)} neighbours={getRoundNeighbours(id)} />;
}

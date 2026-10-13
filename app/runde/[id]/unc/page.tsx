import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildRoundState, listRounds, myCellIds } from "@/lib/repo";
import { readHoldIds } from "@/lib/holds-cookie";
import { readMe } from "@/lib/me-cookie";
import { vippsPresentation } from "@/lib/present";
import UncView from "@/components/UncView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vinlotteri.xlsx" };

/** Unc mode: the round as the old spreadsheet. Not linked from anywhere. */
export default async function UncPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  const me = await readMe();
  const state = buildRoundState(id, myCellIds(id, await readHoldIds(), me));
  if (!state) notFound();
  const vipps = await vippsPresentation(state.round);
  // One sheet tab per round, oldest first, like the old workbook.
  const sheets = listRounds()
    .filter((r) => r.status !== "draft" || r.id === id)
    .reverse()
    .map((r) => ({ id: r.id, title: r.title }));
  return <UncView roundId={id} initial={{ ...state, vipps }} initialMe={me} sheets={sheets} />;
}

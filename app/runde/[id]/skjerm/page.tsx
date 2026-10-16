import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { buildRoundState, hostFacts } from "@/lib/repo";
import { qrDataUri } from "@/lib/vipps";
import BigScreen from "@/components/BigScreen";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Storskjerm · Vinlotteri" };

/** The draw on a TV or projector in the room. Linked next to «Regler» on the round page around the draw. */
export default async function ScreenPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isFinite(id)) notFound();
  // No "mine": the screen belongs to the room, not to whoever's browser it runs in.
  const state = buildRoundState(id);
  if (!state) notFound();

  // While sales are open the screen shows a QR to the round (made for a draft too, in case it opens
  // while the screen is up). The address is the one the screen itself was opened on; behind SWAG
  // the forwarded headers carry the public one.
  let buy: { url: string; qr: string | null } | undefined;
  if (state.round.status === "draft" || state.round.status === "open") {
    const h = await headers();
    const host = h.get("x-forwarded-host") ?? h.get("host");
    const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
    if (host) {
      const url = `${proto}://${host}/runde/${id}`;
      buy = { url, qr: await qrDataUri(url) };
    }
  }

  return <BigScreen roundId={id} initial={state} hosts={hostFacts(id)} buy={buy} />;
}

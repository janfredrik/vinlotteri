import { qrDataUri, vippsMeLink } from "./vipps";
import type { Round, VippsPresentation } from "./types";

export type { VippsPresentation };

export async function vippsPresentation(round: Round): Promise<VippsPresentation> {
  const link = vippsMeLink(round.vipps_number);
  return {
    number: round.vipps_number,
    link,
    qr: await qrDataUri(link),
  };
}

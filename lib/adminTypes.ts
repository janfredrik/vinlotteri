import type { Cell, Draw, MoneySummary, Prize, Round, VippsPresentation } from "./types";

export interface AdminRoundState {
  round: Round;
  cells: Cell[];
  prizes: Prize[];
  draws: Draw[];
  money: MoneySummary;
  salesOpen: boolean;
  restrictionActive: boolean;
  vipps: VippsPresentation;
  /** The round after this one; id 0 = none yet. */
  successor: { id: number; title: string };
  /** Buyer names from every round, most-used first. */
  knownNames: string[];
  /** History editing is on (/superadmin): winning squares of settled rounds can be corrected. */
  historyEdit: boolean;
  now: string;
}

import type { Cell, MoneySummary, Prize, Round } from "./types";

export function computeMoney(round: Round, cells: Cell[], prizes: Prize[]): MoneySummary {
  const soldCells = cells.filter((c) => c.status === "sold");
  const sold = soldCells.length;
  const paidCount = soldCells.filter((c) => c.paid).length;

  const prizeSum = prizes.reduce((s, p) => s + (p.price ?? 0), 0);
  const poletCostAuto = round.polet_cost == null;
  // Prices can carry øre (169,90); the ledger is whole kroner, so round once on the sum.
  const poletCost = poletCostAuto ? Math.round(prizeSum) : round.polet_cost!;

  const loddSolgt = sold * round.ticket_price;
  const videre = round.carried_over + loddSolgt - poletCost;

  return {
    ticketPrice: round.ticket_price,
    sold,
    paidCount,
    unpaidCount: sold - paidCount,
    carriedOver: round.carried_over,
    loddSolgt,
    poletCost,
    poletCostAuto,
    videre,
  };
}

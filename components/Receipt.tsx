import type { MoneySummary } from "@/lib/types";

/** Whole kroner stay whole; legacy rows with øre get exactly two decimals. */
export const KR_INT = new Intl.NumberFormat("nb-NO", { maximumFractionDigits: 0 });
export const KR_DEC = new Intl.NumberFormat("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function kr(n: number): string {
  const r = Math.round(n * 100) / 100;
  return (Number.isInteger(r) ? KR_INT : KR_DEC).format(r);
}

export function signed(n: number): string {
  const r = Math.round(n * 100) / 100;
  return r > 0 ? `+${kr(r)}` : kr(r);
}

const LOOK = {
  /** A row in the history ledger. */
  inline: {
    box: "rounded-lg bg-parchment/40 px-3 py-2",
    total: "font-semibold",
    amount: "font-semibold",
  },
  /** A card of its own on the round page, matching the winners list beside it. */
  card: {
    box: "rounded-xl border border-plum/10 bg-white px-4 py-3 shadow-sm",
    total: "font-semibold text-plum",
    amount: "font-semibold text-wine",
  },
};

/** A round's money as a receipt: in from last time, tickets sold, Polet cost, carried forward. */
export default function Receipt({
  money,
  look = "inline",
  className = "",
}: {
  money: MoneySummary;
  look?: keyof typeof LOOK;
  className?: string;
}) {
  const delta = money.videre - money.carriedOver;
  const l = LOOK[look];
  return (
    <dl className={`grid grid-cols-[1fr_auto] items-baseline gap-y-0.5 text-sm tabular-nums ${l.box} ${className}`}>
      <dt className="text-plum/60">Inn fra sist</dt>
      <dd className="text-right">{kr(money.carriedOver)}</dd>
      <dt className="text-plum/60">{money.sold} lodd solgt</dt>
      <dd className="text-right">+{kr(money.loddSolgt)}</dd>
      <dt className="text-plum/60">Kost på polet</dt>
      <dd className="text-right">−{kr(money.poletCost)}</dd>
      <dt className={`mt-1 border-t border-plum/10 pt-1 ${l.total}`}>Videreført</dt>
      <dd className="mt-1 border-t border-plum/10 pt-1 pl-3 text-right">
        <span className={l.amount}>{kr(money.videre)} kr</span>
        <span className={`ml-2 text-xs ${delta < 0 ? "text-wine" : "text-sage"}`}>{signed(delta)}</span>
      </dd>
    </dl>
  );
}

import { chanceOfAnyPrize, chanceOfFirst, percent } from "@/lib/chances";

/** Your odds under the grid, once you have squares in the draw. While sales are open the number
 *  is "akkurat nå": every square sold after yours makes it a little smaller. */
export default function Chances({
  mine,
  inDraw,
  total,
  prizes,
  salesOpen,
}: {
  mine: number;
  inDraw: number;
  total: number;
  prizes: number;
  salesOpen: boolean;
}) {
  const any = chanceOfAnyPrize(mine, inDraw, prizes);
  const first = chanceOfFirst(mine, inDraw);
  const growing = salesOpen && inDraw < total;
  const full = chanceOfAnyPrize(mine, total, prizes);

  return (
    <section className="rounded-xl border border-plum/10 bg-white px-4 py-3 shadow-sm">
      <h2 className="font-display text-lg font-semibold text-plum">Dine sjanser</h2>
      <div className="mt-1 flex items-baseline gap-3">
        <p className="font-display text-2xl font-semibold tabular-nums text-wine">{percent(any)}</p>
        <p className="text-sm text-plum/80">
          for minst én premie{growing ? " akkurat nå" : ""}
          <span className="block text-plum/70">
            {mine} av {inDraw} rute{inDraw === 1 ? "" : "r"} i trekningen er {mine === 1 ? "din" : "dine"}{" "}
            <span className="whitespace-nowrap">· {prizes} premie{prizes === 1 ? "" : "r"}</span>
          </span>
        </p>
      </div>
      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-parchment" aria-hidden="true">
        <div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(2, any * 100)}%` }} />
      </div>
      {(prizes > 1 || growing) && (
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-plum/70">
          {prizes > 1 && <span>1. premie: {percent(first)}</span>}
          {growing && <span>Blir alle {total} solgt: {percent(full)}</span>}
        </p>
      )}
    </section>
  );
}

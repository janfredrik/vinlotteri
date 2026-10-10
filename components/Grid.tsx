"use client";

import { useState } from "react";
import type { CellStatus } from "@/lib/types";
import { STATUS_STYLES } from "@/lib/cellStyles";

export interface GridCell {
  row: number;
  col: number;
  status: CellStatus;
  label: string | null;
  mine?: boolean;
}

interface GridProps {
  size: number;
  cells: GridCell[];
  onCellClick?: (cell: GridCell) => void;
  /** Called when a free square is tapped while it can't be picked (e.g. sales not open yet).
   *  The square shakes its head so the tap never feels ignored. */
  onLockedClick?: (cell: GridCell) => void;
  highlight?: { row: number; col: number } | null;
  /** Winning squares: "row,col" -> placement (1 = first prize, marked specially). */
  wins?: Map<string, number>;
  sweeping?: { row: number; col: number } | null;
  compact?: boolean;
}


const STATUS_TEXT: Record<CellStatus, string> = {
  available: "ledig",
  held: "reservert",
  sold: "solgt",
};

export function Crown({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 14" aria-hidden="true" className={className}>
      <path
        d="M2 12.5h16M2.6 10.5 1.2 3.4l5 3.6L10 1.2 13.8 7l5-3.6-1.4 7.1z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Grid({
  size,
  cells,
  onCellClick,
  onLockedClick,
  highlight,
  wins,
  sweeping,
  compact,
}: GridProps) {
  const map = new Map(cells.map((c) => [`${c.row},${c.col}`, c]));
  const clickable = !!onCellClick;
  // key + counter so tapping the same square again restarts the shake
  const [nudge, setNudge] = useState<{ key: string; n: number } | null>(null);

  return (
    <div className="overflow-x-auto rounded-xl bg-parchment/70 p-2 sm:p-3">
      <div
        className="grid gap-1 sm:gap-1.5"
        style={{
          gridTemplateColumns: `1.25rem repeat(${size}, minmax(${compact ? "2.25rem" : "2.5rem"}, 1fr))`,
        }}
      >
        <div />
        {Array.from({ length: size }, (_, i) => (
          <div
            key={`h${i}`}
            className="pb-0.5 text-center font-display text-xs font-semibold lining-nums tabular-nums text-wine/80"
          >
            {i + 1}
          </div>
        ))}

        {Array.from({ length: size }, (_, r) => {
          const row = r + 1;
          return (
            <div key={`row${row}`} className="contents">
              <div className="flex items-center justify-center font-display text-xs font-semibold lining-nums tabular-nums text-wine/80">
                {row}
              </div>
              {Array.from({ length: size }, (_, c) => {
                const col = c + 1;
                const cell = map.get(`${row},${col}`) ?? {
                  row,
                  col,
                  status: "available" as CellStatus,
                  label: null,
                };
                const key = `${row},${col}`;
                const rank = wins?.get(key);
                const isFirst = rank === 1;
                const isWon = rank != null;
                const isHi = highlight && highlight.row === row && highlight.col === col;
                const isSweep = sweeping && sweeping.row === row && sweeping.col === col;
                const isOpen = cell.status === "available";
                const canPick = clickable && isOpen;
                const isLocked = !clickable && isOpen && !isWon && !!onLockedClick;
                const isNudged = nudge?.key === key;
                // Winning cells get their own bg/text/border set rather than layering on top of
                // STATUS_STYLES: Tailwind resolves conflicting utilities (e.g. two "bg-*" classes)
                // by stylesheet order, not by position in the class string, so mixing them here
                // produced unreadable combinations (dark text on a dark background).
                const colorClasses = isSweep
                  ? "border-gold bg-gold text-plum animate-sweep"
                  : isFirst
                    ? "border-gold bg-gradient-to-br from-gold-soft to-gold text-plum shadow-[0_2px_6px_rgba(194,147,58,0.45)] animate-winner-glow"
                    : isWon
                      ? "border-gold bg-gold-soft text-plum shadow-[0_2px_4px_rgba(194,147,58,0.35)]"
                      : STATUS_STYLES[cell.status];
                const coord = `${col}-${row}`;
                return (
                  <button
                    key={isNudged ? `${key}:${nudge.n}` : key}
                    type="button"
                    data-cell={coord}
                    disabled={!clickable && !isLocked}
                    aria-disabled={isLocked || undefined}
                    onClick={() => {
                      if (isLocked) {
                        setNudge((p) => ({ key, n: (p?.n ?? 0) + 1 }));
                        onLockedClick?.(cell);
                        return;
                      }
                      onCellClick?.(cell);
                    }}
                    aria-label={
                      isWon
                        ? `Rute ${coord}, ${rank}. premie: ${cell.label ?? ""}`
                        : `Rute ${coord}, ${STATUS_TEXT[cell.status]}${cell.label ? `: ${cell.label}` : ""}`
                    }
                    title={
                      isWon
                        ? `${rank}. premie: ${cell.label ?? ""}`
                        : (cell.label ?? `Rute ${coord}`)
                    }
                    className={[
                      "group relative flex min-w-0 items-center justify-center rounded-md border px-0.5 text-center transition duration-150 ease-out",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine",
                      compact ? "h-9 text-[10px]" : "h-12 text-[11px] sm:h-16 sm:text-xs",
                      isWon || isSweep ? "border-2" : "",
                      colorClasses,
                      isWon || isSweep ? "z-10" : "",
                      cell.mine && !isWon ? "ring-2 ring-gold ring-offset-2 ring-offset-parchment" : "",
                      isHi && !isSweep ? "z-10 outline outline-2 outline-offset-1 outline-wine" : "",
                      canPick
                        ? "cursor-pointer hover:-translate-y-px hover:border-wine/60 hover:text-wine hover:shadow-[0_3px_8px_rgba(123,30,59,0.15)] active:translate-y-0"
                        : isLocked
                          ? "cursor-not-allowed"
                          : "cursor-default",
                      isNudged ? "animate-nope" : "",
                    ].join(" ")}
                  >
                    {cell.label ? (
                      <span className="line-clamp-2 font-semibold leading-tight [overflow-wrap:anywhere]">
                        {cell.label}
                      </span>
                    ) : isOpen ? (
                      <span className="font-display text-[10px] lining-nums tabular-nums sm:text-[11px]">
                        <span className={canPick ? "group-hover:hidden" : ""}>{coord}</span>
                        {canPick && (
                          <span aria-hidden="true" className="hidden text-base leading-none group-hover:inline">
                            +
                          </span>
                        )}
                      </span>
                    ) : null}
                    {isFirst && (
                      <Crown
                        className={`absolute left-1/2 top-0.5 -translate-x-1/2 text-wine ${compact ? "h-2 w-3" : "h-2.5 w-3.5 sm:h-3 sm:w-4"}`}
                      />
                    )}
                    {isWon && !isFirst && (
                      <span
                        className={`absolute right-0.5 top-0.5 flex items-center justify-center rounded-full bg-wine font-display font-bold lining-nums tabular-nums leading-none text-cream ${
                          compact ? "h-3 w-3 text-[8px]" : "h-3.5 w-3.5 text-[9px] sm:h-4 sm:w-4 sm:text-[10px]"
                        }`}
                      >
                        {rank}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

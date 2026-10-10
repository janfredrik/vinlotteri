import type { CellStatus } from "./types";

/** One complete colour set per square state. Shared by the grid and the profile square,
 *  so "you" look exactly like your squares. Never layer other bg/text utilities on top. */
export const STATUS_STYLES: Record<CellStatus, string> = {
  available: "bg-white border-plum/10 text-plum/60 shadow-[0_1px_0_rgba(44,10,20,0.06)]",
  held: "cell-held border-gold/70 text-plum",
  sold: "bg-wine border-wine-dark text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_1px_2px_rgba(44,10,20,0.25)]",
};

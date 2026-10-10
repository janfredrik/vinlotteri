import { STATUS_STYLES } from "@/lib/cellStyles";
import { initials } from "@/lib/format";

/** The profile drawn as a grid square: a sold square with your initials, or an empty
 *  dashed one with "?" when nobody is chosen. "You are your square." */
export function MeSquare({
  name,
  size = "md",
  ring = false,
  fill = false,
}: {
  name: string | null;
  size?: "sm" | "md";
  /** The gold "this is mine" ring from the grid. */
  ring?: boolean;
  /** Play the fill-in once (the first time a profile is set). */
  fill?: boolean;
}) {
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : "h-9 w-9 text-xs";
  if (!name) {
    return (
      <span
        aria-hidden="true"
        className={`${dims} inline-flex shrink-0 items-center justify-center rounded-md border border-dashed border-plum/30 bg-white/70 font-display text-sm font-semibold text-plum/60`}
      >
        ?
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      className={[
        dims,
        "inline-flex shrink-0 items-center justify-center rounded-md border font-semibold leading-none tracking-wide",
        STATUS_STYLES.sold,
        ring ? "ring-2 ring-gold ring-offset-2 ring-offset-cream" : "",
        fill ? "animate-me-fill" : "",
      ].join(" ")}
    >
      {initials(name)}
    </span>
  );
}

/** Marks your own wins in a winner list: easy to spot, not shouting. */
export function YouChip() {
  return (
    <span className="rounded-full bg-gold px-1.5 py-px align-[1px] text-[10px] font-semibold uppercase tracking-wide text-plum">
      Deg!
    </span>
  );
}

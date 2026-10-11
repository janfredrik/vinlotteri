/**
 * Shown only under `next dev`: a gold frame around the viewport and a small wine label
 * in the lower-right corner (the left one belongs to the Next.js dev button). Both are fixed
 * and ignore the pointer, so they stay visible while scrolling without blocking any clicks.
 */
export function DevMark() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[110] print:hidden">
      <div className="absolute inset-0 border-[3px] border-gold/70" />
      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] bottom-[max(1rem,env(safe-area-inset-bottom))] rotate-3 rounded-sm bg-cream px-3 py-1.5 text-center shadow-[0_6px_16px_-8px_rgba(60,20,40,0.55)] outline-1 outline-offset-2 outline-gold border border-gold">
        <div className="font-display text-sm italic leading-tight text-wine-dark">Prøveflaske</div>
        <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-plum/70">
          Utviklingsmiljø
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { largeImage, vinmonopoletUrl } from "@/lib/vinmonopolet";

export interface PrizeView {
  img: string;
  name: string;
  category: string | null;
  meta: string;
  varenummer: string | null;
}

export function ExternalIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.5 3.5h5v5M16.5 3.5 9 11M14.5 11.5v4a1 1 0 0 1-1 1h-9a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1h4" />
    </svg>
  );
}

/**
 * Bottle thumbnail that opens the big view on tap. On a mouse, hovering lifts a larger preview
 * over the row first, so a quick look needs no click.
 */
export function PrizeThumb({
  view,
  onOpen,
  className,
}: {
  view: PrizeView;
  onOpen: (v: PrizeView) => void;
  className: string;
}) {
  // Vinmonopolet has no picture for some items: show a bottle instead of a broken image.
  const [broken, setBroken] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // An image that already failed before hydration never fires onError for React.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth === 0) setBroken(true);
  }, []);
  if (broken) {
    return (
      <div className={`flex shrink-0 items-center justify-center ${className}`} aria-hidden="true">
        <span className="text-3xl">🍾</span>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      aria-label={`Vis større bilde av ${view.name}`}
      className={`group relative flex shrink-0 cursor-zoom-in items-center justify-center rounded-md outline-offset-2 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img ref={imgRef} src={view.img} alt="" onError={() => setBroken(true)} className="h-full w-auto object-contain transition-transform duration-200 ease-out group-hover:scale-105" />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-1/2 z-20 hidden w-44 -translate-y-1/2 origin-left scale-95 rounded-xl border border-plum/10 bg-white p-3 opacity-0 shadow-[0_18px_40px_-14px_rgba(44,10,20,0.4)] transition duration-200 ease-out [@media(hover:hover)_and_(pointer:fine)]:block group-hover:scale-100 group-hover:opacity-100 group-hover:delay-150"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={largeImage(view.img)} alt="" loading="lazy" className="mx-auto h-56 w-auto object-contain" />
      </span>
    </button>
  );
}

/** Small out-link to the product page, for rows that have a varenummer. */
export function PoletLink({ varenummer, name }: { varenummer: string | null; name: string }) {
  const href = vinmonopoletUrl(varenummer);
  if (!href) return null;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${name} på Vinmonopolet (åpnes i ny fane)`}
      title="Se på Vinmonopolet"
      className="-mr-1.5 ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-plum/40 transition-colors hover:bg-wine/5 hover:text-wine focus-visible:text-wine"
    >
      <ExternalIcon />
    </a>
  );
}

/** Big bottle on a native <dialog>. Esc, backdrop tap and the close button all dismiss it. */
export function PrizeDialog({ view, onClose }: { view: PrizeView | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (view && !d.open) d.showModal();
    else if (!view && d.open) d.close();
  }, [view]);

  const href = view ? vinmonopoletUrl(view.varenummer) : null;

  return (
    <dialog
      ref={ref}
      aria-labelledby="premie-tittel"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="mx-auto mb-4 mt-auto w-[calc(100%-2rem)] max-w-sm animate-pop overflow-hidden rounded-2xl bg-cream p-0 text-plum shadow-[0_20px_50px_-12px_rgba(44,10,20,0.45)] sm:my-auto"
    >
      {view && (
        <>
          <div className="relative bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={largeImage(view.img)}
              alt={view.name}
              className="mx-auto h-[min(52vh,26rem)] w-auto object-contain px-6 py-6"
            />
            <button
              type="button"
              onClick={onClose}
              aria-label="Lukk"
              className="absolute right-2 top-2 inline-flex h-11 w-11 items-center justify-center rounded-full text-plum/60 transition-colors hover:bg-plum/5 hover:text-plum"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="m5.5 5.5 9 9m0-9-9 9" />
              </svg>
            </button>
          </div>
          <div className="border-t border-plum/10 p-5">
            {view.category && (
              <p className="text-[11px] font-semibold uppercase tracking-wide text-wine">{view.category}</p>
            )}
            <h3 id="premie-tittel" className="text-balance font-display text-xl font-semibold leading-tight text-plum">
              {view.name}
            </h3>
            {view.meta && <p className="mt-1 text-sm lining-nums text-plum/60">{view.meta}</p>}
            {href && (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-wine px-4 text-sm font-semibold text-cream transition-colors hover:bg-wine/90"
              >
                Se på Vinmonopolet
                <ExternalIcon />
              </a>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}

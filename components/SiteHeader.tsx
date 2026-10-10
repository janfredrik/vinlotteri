"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MeButton } from "./MeButton";

/** Site header. Hidden on the PIN gate, where its links only lead back to the gate. */
export function SiteHeader() {
  if (usePathname() === "/apne") return null;
  return (
    <header className="border-b border-plum/10 bg-cream/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <Link href="/" aria-label="Vinlotteri" className="font-display text-xl font-semibold text-wine">
          <span aria-hidden="true">
            🍷 Vin<span className="hidden sm:inline">lotteri</span>
          </span>
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <Link href="/historikk" className="text-plum/70 hover:text-wine">
            Historikk
          </Link>
          <Link
            href="/admin"
            className="rounded-full border border-plum/15 px-3 py-1 text-plum/70 hover:border-wine hover:text-wine"
          >
            Arrangør
          </Link>
          <MeButton />
        </nav>
      </div>
    </header>
  );
}

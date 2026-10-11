"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { PersonWrap, YearWrap } from "@/lib/wrapped-shared";
import {
  CellarCard,
  ChooseCard,
  CloseCard,
  CrownCard,
  DryCard,
  LabelCard,
  MoneyCard,
  PeopleCard,
  RelayCard,
  SkippedCard,
  TerroirCard,
  TitleCard,
  YouCard,
  YourSquaresCard,
  type Tone,
} from "./cards";

interface Card {
  id: string;
  tone: Tone;
  render: (active: boolean) => React.ReactNode;
}

/** Taps, swipes and keys only steer the story when they don't land on a control of their own. */
const CONTROLS = "a, button, input, dialog, label, [data-no-nav]";

/**
 * The year as a deck of full-screen cards: the common vintage, then your own (when the profile is
 * set and this isn't the big screen), then a toast. Tap the right side or swipe left for the next
 * card; arrow keys, space and Escape work too. Nothing moves on its own, so there's time for a screenshot.
 */
export default function WrappedStory({
  wrap: w,
  person,
  me,
  big,
}: {
  wrap: YearWrap;
  person: PersonWrap | null;
  me: string | null;
  big: boolean;
}) {
  const router = useRouter();
  const cards = useMemo<Card[]>(() => {
    const list: Card[] = [{ id: "etikett", tone: "plum", render: () => <LabelCard w={w} /> }];
    if (w.people) list.push({ id: "folk", tone: "wine", render: (a) => <PeopleCard w={w} active={a} /> });
    if (w.crown) list.push({ id: "kronen", tone: "red", render: () => <CrownCard w={w} /> });
    if (w.hottest) list.push({ id: "jordsmonn", tone: "plum", render: () => <TerroirCard w={w} /> });
    if (w.topOrganizer && w.relay.length > 1) list.push({ id: "stafett", tone: "wine", render: () => <RelayCard w={w} /> });
    if (w.cellar) list.push({ id: "kjeller", tone: "plum", render: (a) => <CellarCard w={w} active={a} /> });
    list.push({ id: "regnskap", tone: "red", render: () => <MoneyCard w={w} /> });
    if (w.optimist || w.drought) list.push({ id: "torr", tone: "plum", render: () => <DryCard w={w} /> });
    if (!big) {
      if (person) {
        list.push({ id: "deg", tone: "red", render: () => <YouCard p={person} w={w} /> });
        list.push({ id: "ruta", tone: "wine", render: () => <YourSquaresCard p={person} w={w} /> });
        list.push({ id: "tittel", tone: "plum", render: () => <TitleCard p={person} /> });
      } else if (me) {
        list.push({ id: "deg", tone: "red", render: () => <SkippedCard name={me} year={w.year} /> });
      } else {
        list.push({ id: "deg", tone: "red", render: () => <ChooseCard year={w.year} /> });
      }
    }
    list.push({ id: "skal", tone: "plum", render: () => <CloseCard w={w} big={big} onRestart={() => setAt(0)} /> });
    return list;
  }, [w, person, me, big]);

  const [at, setAt] = useState(0);
  const index = Math.min(at, cards.length - 1);
  const card = cards[index];
  const go = useCallback((d: number) => setAt((i) => Math.max(0, Math.min(cards.length - 1, i + d))), [cards.length]);
  // The card sits in the hash (#kort-3), so a reload on the big screen keeps its place.
  useEffect(() => {
    const read = () => {
      const m = location.hash.match(/^#kort-(\d+)$/);
      if (m) setAt(Math.max(0, Number(m[1]) - 1));
    };
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    const hash = index ? `#kort-${index + 1}` : "";
    if (location.hash !== hash) history.replaceState(null, "", `${location.pathname}${location.search}${hash}`);
  }, [index]);

  const exit = useCallback(() => router.push(`/historikk?ar=${w.year}`), [router, w.year]);

  // The page behind the story shouldn't scroll on a phone.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = "hidden";
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
      if ((e.target as Element | null)?.closest?.("input, dialog")) return;
      if (["ArrowRight", "PageDown", " "].includes(e.key)) {
        if (e.key === " " && (e.target as Element | null)?.closest?.("a, button")) return;
        e.preventDefault();
        go(1);
      } else if (["ArrowLeft", "PageUp"].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "Home") setAt(0);
      else if (e.key === "End") setAt(cards.length - 1);
      else if (e.key === "Escape" && !document.fullscreenElement) exit();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, exit, cards.length]);

  const start = useRef<{ x: number; y: number } | null>(null);
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest(CONTROLS)) return;
    start.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = start.current;
    start.current = null;
    if (!s || (e.target as Element).closest(CONTROLS)) return;
    const dx = e.clientX - s.x;
    const dy = e.clientY - s.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) return go(dx < 0 ? 1 : -1);
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) return;
    const box = e.currentTarget.getBoundingClientRect();
    go(e.clientX - box.left < box.width * 0.3 ? -1 : 1);
  };

  const [full, setFull] = useState(false);
  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const last = index === cards.length - 1;

  return (
    <div className="wr-stage fixed inset-0 z-[100] flex items-center justify-center gap-6 overflow-hidden">
      {!big && (
        <SideArrow dir={-1} disabled={index === 0} onClick={() => go(-1)} />
      )}
      <section
        aria-roledescription="karusell"
        aria-label={`Årgang ${w.year}`}
        className={
          big
            ? "relative h-full w-full max-w-[min(100vw,calc(100dvh*1.25))]"
            : "relative h-full w-full sm:aspect-[9/16] sm:h-[min(calc(100dvh-3rem),58rem)] sm:w-auto sm:overflow-hidden sm:rounded-[1.25rem] sm:shadow-[0_30px_80px_-24px_rgba(0,0,0,0.75)]"
        }
      >
        <div
          key={card.id}
          role="group"
          aria-roledescription="kort"
          aria-label={`${index + 1} av ${cards.length}`}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          className={`wr-card wr-on wr-tone-${card.tone} absolute inset-0 cursor-pointer select-none overflow-hidden`}
        >
          <div aria-live="polite" className="h-full">
            {card.render(true)}
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 px-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className={`wr-progress flex gap-1 text-cream`} aria-hidden="true">
            {cards.map((c, i) => (
              <span key={c.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-current/25">
                <span className="block h-full bg-current" style={{ transform: `scaleX(${i <= index ? 1 : 0})` }} />
              </span>
            ))}
          </div>
          <div className={`mt-2 flex items-center justify-end gap-1 text-cream`}>
            {big && (
              <button
                type="button"
                onClick={toggleFull}
                aria-label={full ? "Avslutt fullskjerm" : "Fullskjerm"}
                className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {full ? <path d="M8 3v5H3m14 0h-5V3m0 14v-5h5M3 12h5v5" /> : <path d="M3 8V3h5m4 0h5v5m0 4v5h-5m-4 0H3v-5" />}
                </svg>
              </button>
            )}
            <Link
              href={`/historikk?ar=${w.year}`}
              aria-label="Lukk og gå til historikken"
              className="pointer-events-auto inline-flex h-11 w-11 items-center justify-center rounded-full opacity-80 transition-opacity hover:opacity-100 focus-visible:outline-2 focus-visible:outline-current"
            >
              <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                <path d="m5.5 5.5 9 9m0-9-9 9" />
              </svg>
            </Link>
          </div>
        </div>

        {index === 0 && (
          <p className="wr-hint pointer-events-none absolute inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-10 text-center text-sm text-gold-soft">
            {big ? "Bla med piltastene" : "Trykk for å smake"}
          </p>
        )}
        {!last && <span className="sr-only">Bruk piltastene for å bla.</span>}
      </section>
      {!big && <SideArrow dir={1} disabled={last} onClick={() => go(1)} />}
    </div>
  );
}

function SideArrow({ dir, disabled, onClick }: { dir: -1 | 1; disabled: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={dir < 0 ? "Forrige kort" : "Neste kort"}
      className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold-soft transition-colors hover:border-gold hover:bg-gold/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-soft disabled:invisible sm:inline-flex"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d={dir < 0 ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"} />
      </svg>
    </button>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from "react";
import { useRoundState } from "@/lib/useRoundState";
import { STATUS_STYLES } from "@/lib/cellStyles";
import { gridLabel, normName } from "@/lib/format";
import { kr } from "./Receipt";
import { weekdayTime } from "@/lib/datetime";
import { largeImage, vinmonopoletImage } from "@/lib/vinmonopolet";
import * as sound from "@/lib/drawSounds";
import { Crown } from "./Grid";
import { celebrateFrom, crownFrom } from "./Cheers";
import type { HostFacts } from "@/lib/repo";
import type { LiveOutcome, LiveRoll, Prize, PublicDraw, RoundState } from "@/lib/types";

/* --------------------------------------------------------------------------------------------
 * The draw on a TV in the room. The organiser's dice taps arrive live (lib/liveRoll.ts) and play
 * as scenes, one at a time, each held long enough to be seen from across the room even when
 * the organiser taps faster than that: column → row and crosshair → the square pulses → name.
 * ------------------------------------------------------------------------------------------ */

type Miss = Exclude<LiveOutcome, "winner">;

type Scene =
  | { id: number; kind: "idle" }
  | { id: number; kind: "aim"; rank: number; col: number | null; row: number | null; short?: boolean }
  | { id: number; kind: "reveal"; rank: number; col: number | null; row: number | null; short?: boolean }
  /** `last`: the winner got the last prize without choosing. */
  | { id: number; kind: "winner"; rank: number; last?: boolean }
  | { id: number; kind: "miss"; rank: number; col: number | null; row: number | null; outcome: Miss }
  /** `auto`: the last prize, which the winner gets without choosing. */
  | { id: number; kind: "choice"; rank: number; prizeId: number; auto?: boolean }
  | { id: number; kind: "later"; rank: number };

type DistOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type SceneInit = DistOmit<Scene, "id">;

/** How long each scene holds before the next one may take over. */
function holdFor(s: Scene, next?: Scene): number {
  switch (s.kind) {
    case "aim":
      if (s.row == null || s.col == null) return s.short ? 500 : 900;
      // The roll is registered: go on as soon as the crosshair has landed.
      if (next?.kind === "reveal" && next.rank === s.rank) return 800;
      return s.short ? 800 : 1700;
    case "reveal":
      return s.short ? 800 : 1000;
    case "winner":
      return 6000;
    case "miss":
      return 2600;
    case "choice":
      return 5500;
    case "later":
      return 3500;
    default:
      return 0;
  }
}

// A TV is big: Vinmonopolet's 300px images go blurry there.
const prizeImage = (p: Prize | undefined) => {
  const src = p ? p.image_url || vinmonopoletImage(p.varenummer) : null;
  return src ? largeImage(src) : null;
};
const prizeLabel = (p: Prize | undefined) => (p ? p.name || `Varenr. ${p.varenummer ?? "?"}` : "");
const SOUND_KEY = "vl_skjerm_lyd";

type Buy = { url: string; qr: string | null };

export default function BigScreen({
  roundId,
  initial,
  hosts = {},
  buy,
}: {
  roundId: number;
  initial: RoundState;
  hosts?: Record<string, HostFacts>;
  /** The round's own page and a QR to it, shown while sales are open. */
  buy?: Buy;
}) {
  const { state, connected } = useRoundState(roundId, initial);
  const { round, prizes, cells, draws } = state;
  const size = round.grid_size;
  const drawOf = useCallback((rank: number) => draws.find((d) => d.rank === rank), [draws]);

  /* ---------------------------------------------------------------- the scene player --- */

  const nextId = useRef(1);
  const make = (s: SceneInit): Scene => ({ ...s, id: nextId.current++ }) as Scene;

  // What has already happened when the page opens is shown, never replayed.
  const seen = useRef<{ announced: Set<number>; chosen: Set<number>; later: Set<number>; live: LiveRoll | null } | null>(null);
  if (!seen.current) {
    const won = initial.draws.filter((d) => d.winnerName);
    seen.current = {
      announced: new Set(won.map((d) => d.rank)),
      chosen: new Set(won.filter((d) => d.prizeId != null).map((d) => d.rank)),
      later: new Set(won.filter((d) => d.skipped).map((d) => d.rank)),
      live: initial.live,
    };
  }
  const [revealed, setRevealed] = useState(() => new Set(seen.current!.announced));
  const [shownChoices, setShownChoices] = useState(() => new Set(seen.current!.chosen));

  const [current, setCurrent] = useState<Scene>(() => openingScene(initial, make));
  // The opening scene is a still: no sound, no crown.
  const still = useRef(current.id);
  const queue = useRef<Scene[]>([]);
  const startedAt = useRef(0);
  const [queued, kick] = useReducer((n: number) => n + 1, 0);

  const enqueue = useCallback((...scenes: Scene[]) => {
    for (const s of scenes) {
      // A die changed before its scene got a turn: show the newer one instead of both.
      const last = queue.current[queue.current.length - 1];
      if (s.kind === "aim" && last?.kind === "aim" && last.rank === s.rank && !last.short) queue.current.pop();
      queue.current.push(s);
    }
    kick();
  }, []);

  useEffect(() => {
    if (!queue.current.length) return;
    const wait = Math.max(0, startedAt.current + holdFor(current, queue.current[0]) - performance.now());
    const t = setTimeout(() => {
      const n = queue.current.shift();
      if (!n) return;
      startedAt.current = performance.now();
      if (n.kind === "winner") setRevealed((p) => new Set(p).add(n.rank));
      if (n.kind === "choice") setShownChoices((p) => new Set(p).add(n.rank));
      setCurrent(n);
    }, wait);
    return () => clearTimeout(t);
  }, [current, queued]);

  // Turn each live update into scenes.
  useEffect(() => {
    const s = seen.current!;
    const L = state.live;
    const prev = s.live;
    // Winners announced in this very update: a prize they already have is the last one, not a choice.
    const fresh = new Set<number>();
    const shortRun = (rank: number, col: number | null, row: number | null): Scene[] =>
      col != null && row != null
        ? [make({ kind: "aim", rank, col, row: null, short: true }), make({ kind: "aim", rank, col, row, short: true })]
        : [];

    if (L && (!prev || L.seq > prev.seq || (L.seq === prev.seq && moved(prev, L)))) {
      const sameRoll = prev?.seq === L.seq;
      const sawDice = sameRoll && (prev.col != null || prev.row != null);
      if (L.outcome == null) {
        enqueue(make({ kind: "aim", rank: L.rank, col: L.col, row: L.row }));
      } else if (L.outcome !== "winner" || !s.announced.has(L.rank)) {
        const lead = !sawDice
          ? shortRun(L.rank, L.col, L.row)
          : prev.col !== L.col || prev.row !== L.row
            ? [make({ kind: "aim", rank: L.rank, col: L.col, row: L.row })]
            : [];
        const short = !sawDice;
        const reveal = make({ kind: "reveal", rank: L.rank, col: L.col, row: L.row, short });
        if (L.outcome === "winner") {
          s.announced.add(L.rank);
          fresh.add(L.rank);
          enqueue(...lead, reveal, make({ kind: "winner", rank: L.rank }));
        } else {
          enqueue(...lead, reveal, make({ kind: "miss", rank: L.rank, col: L.col, row: L.row, outcome: L.outcome }));
        }
      }
      s.live = L;
    }

    for (const d of state.draws) {
      // A winner the dice never showed (the connection dropped, or the server restarted): the short version.
      if (d.winnerName && !s.announced.has(d.rank)) {
        s.announced.add(d.rank);
        fresh.add(d.rank);
        enqueue(
          ...shortRun(d.rank, d.col, d.row),
          ...(d.col != null && d.row != null ? [make({ kind: "reveal", rank: d.rank, col: d.col, row: d.row, short: true })] : []),
          make({ kind: "winner", rank: d.rank }),
        );
      }
      // Undone in the admin: forget it, so a new draw for the place plays again.
      if (!d.winnerName && s.announced.has(d.rank)) {
        s.announced.delete(d.rank);
        s.chosen.delete(d.rank);
        s.later.delete(d.rank);
        setRevealed((p) => without(p, d.rank));
        setShownChoices((p) => without(p, d.rank));
      }
      if (d.winnerName && d.prizeId != null && !s.chosen.has(d.rank)) {
        s.chosen.add(d.rank);
        // Won and given the last prize in one go: say so while the name is up. A prize chosen
        // later, while the name is still showing, belongs to the choice scene that follows.
        if (fresh.has(d.rank))
          queue.current = queue.current.map((q) => (q.kind === "winner" && q.rank === d.rank ? { ...q, last: true } : q));
        enqueue(make({ kind: "choice", rank: d.rank, prizeId: d.prizeId, auto: fresh.has(d.rank) }), make({ kind: "idle" }));
      }
      if (d.winnerName && d.prizeId == null && !d.skipped) s.chosen.delete(d.rank);
      if (d.skipped && !s.later.has(d.rank)) {
        s.later.add(d.rank);
        enqueue(make({ kind: "later", rank: d.rank }), make({ kind: "idle" }));
      }
      if (!d.skipped) s.later.delete(d.rank);
    }
  }, [state, enqueue]);

  /* ------------------------------------------------------------------ sound and cheer --- */

  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (current.id === still.current) return;
    const k = current.kind;
    if (k === "aim") {
      sound.tick();
      if (current.col != null && current.row != null) sound.startDrumroll();
    } else if (k === "reveal") {
      if (current.col != null && current.row != null) sound.startDrumroll();
    } else if (k === "winner") {
      sound.stopDrumroll(true);
      const d = drawOf(current.rank);
      const timer = setTimeout(() => {
        const el = d?.col && d.row ? rootRef.current?.querySelector<HTMLElement>(`[data-cell="${d.col}-${d.row}"]`) : null;
        const scale = el ? Math.min(3, Math.max(1, el.getBoundingClientRect().width / 60)) : 1;
        if (current.rank === 1) {
          if (el) crownFrom(el, { scale });
          setTimeout(sound.fanfare, 650);
        } else {
          if (el) celebrateFrom(el, { scale });
          sound.corkPop();
        }
      }, 120);
      return () => clearTimeout(timer);
    } else if (k === "miss") {
      sound.stopDrumroll(false);
      sound.womp();
    } else if (k === "choice") {
      sound.chime();
    } else {
      sound.stopDrumroll(false);
    }
    // Only when a scene starts; the draws it reads are already there by then.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.id]);

  /* ---------------------------------------------------------------- what is on screen --- */

  const visible = (d: PublicDraw) => !!d.winnerName && revealed.has(d.rank);
  const wins = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of draws) if (visible(d) && d.row && d.col) m.set(`${d.row},${d.col}`, d.rank);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draws, revealed]);

  const takenPrizeIds = new Set(
    draws.filter((d) => d.prizeId != null && revealed.has(d.rank) && shownChoices.has(d.rank)).map((d) => d.prizeId),
  );
  const flying = current.kind === "choice" ? current.prizeId : null;
  const prizesLeft = prizes.filter((p) => !takenPrizeIds.has(p.id) || p.id === flying);
  const nextRank = prizes.map((_, i) => i + 1).find((r) => !revealed.has(r)) ?? null;

  // A scene whose draw was undone meanwhile falls back to waiting.
  let scene: Scene = current;
  if ((scene.kind === "winner" || scene.kind === "choice" || scene.kind === "later") && !drawOf(scene.rank)?.winnerName)
    scene = { id: scene.id, kind: "idle" };

  // The same condition as the "God helg!" scene.
  const finished =
    scene.kind === "idle" &&
    round.status !== "draft" &&
    round.status !== "open" &&
    !nextRank &&
    !draws.some((d) => d.winnerName && d.prizeId == null);

  const aim =
    scene.kind === "aim" || scene.kind === "reveal" || scene.kind === "miss"
      ? { col: scene.col, row: scene.row, phase: scene.kind, id: scene.id }
      : null;

  const headline =
    scene.kind === "winner" || scene.kind === "choice" || scene.kind === "later"
      ? `${scene.rank}. vinner`
      : scene.kind === "aim" || scene.kind === "reveal" || scene.kind === "miss"
        ? `${scene.rank}. vinner trekkes nå`
        : round.status === "draft" || round.status === "open"
          ? "Snart trekning"
          : nextRank
            ? `${nextRank}. vinner trekkes nå`
            : "Trekningen er ferdig";

  return (
    <Stage rootRef={rootRef} connected={connected} title={round.title} roundId={roundId}>
      <div className="grid h-full grid-cols-[auto_minmax(0,1fr)] gap-[5cqh]">
        <StageGrid size={size} cells={cells} wins={wins} aim={aim} />

        <aside className="flex min-h-0 flex-col gap-[2.6cqh]">
          <h1 key={headline} className="animate-reveal font-display text-[5.4cqh] font-semibold leading-none text-wine">
            {headline}
          </h1>

          <section aria-live="polite" className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden rounded-[2.2cqh] border border-plum/10 bg-white px-[4cqh] py-[3.4cqh] shadow-[0_1px_0_rgba(44,10,20,0.06),0_18px_40px_-28px_rgba(44,10,20,0.45)]">
            <SceneView
              key={scene.id}
              scene={scene}
              round={state}
              draw={"rank" in scene ? drawOf(scene.rank) : undefined}
              nextRank={nextRank}
              hosts={hosts}
              buy={buy}
              prizesLeft={prizesLeft.filter((p) => p.id !== flying)}
            />
          </section>

          <Shelf
            prizesLeft={prizesLeft}
            flying={flying}
            prizes={prizes}
            draws={draws.filter(visible)}
            choices={shownChoices}
            allDrawn={!nextRank}
          />
          {finished && <Ledger money={state.money} />}
        </aside>
      </div>
    </Stage>
  );
}

function moved(a: LiveRoll, b: LiveRoll) {
  // An out-of-order response must not take a die or an outcome back.
  if (a.outcome != null && b.outcome == null) return false;
  if ((a.col != null && b.col == null) || (a.row != null && b.row == null)) return false;
  return a.col !== b.col || a.row !== b.row || a.outcome !== b.outcome;
}

function without(s: Set<number>, n: number) {
  if (!s.has(n)) return s;
  const c = new Set(s);
  c.delete(n);
  return c;
}

function openingScene(st: RoundState, make: (s: SceneInit) => Scene): Scene {
  const L = st.live;
  if (L && L.outcome == null) return make({ kind: "aim", rank: L.rank, col: L.col, row: L.row });
  if (L && L.outcome && L.outcome !== "winner") return make({ kind: "miss", rank: L.rank, col: L.col, row: L.row, outcome: L.outcome });
  const waiting = st.draws.find((d) => d.winnerName && d.prizeId == null && !d.skipped);
  if (waiting) return make({ kind: "winner", rank: waiting.rank });
  return make({ kind: "idle" });
}

/* ------------------------------------------------------------------------------- stage --- */

function Stage({
  rootRef,
  connected,
  title,
  roundId,
  children,
}: {
  rootRef: React.RefObject<HTMLDivElement | null>;
  connected: boolean;
  title: string;
  roundId: number;
  children: React.ReactNode;
}) {
  const [awake, setAwake] = useState(true);
  const [full, setFull] = useState(false);
  const [pref, setPref] = useState<"on" | "off" | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [everConnected, setEverConnected] = useState(false);
  if (connected && !everConnected) setEverConnected(true);

  useEffect(() => {
    try {
      const v = localStorage.getItem(SOUND_KEY);
      if (v === "on" || v === "off") setPref(v);
    } catch {
      /* private window */
    }
  }, []);

  const muted = pref !== "on" || !unlocked;
  useEffect(() => sound.setMuted(muted), [muted]);

  const savePref = (v: "on" | "off") => {
    setPref(v);
    try {
      localStorage.setItem(SOUND_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const turnOn = async () => {
    savePref("on");
    setUnlocked(await sound.unlock());
  };

  // Sound was left on last time: the first click anywhere brings it back.
  useEffect(() => {
    if (pref !== "on" || unlocked) return;
    const onDown = () => void sound.unlock().then(setUnlocked);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onDown);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onDown);
    };
  }, [pref, unlocked]);

  // Controls and cursor step back when nobody touches the mouse.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const wake = () => {
      setAwake(true);
      clearTimeout(t);
      t = setTimeout(() => setAwake(false), 3500);
    };
    wake();
    window.addEventListener("pointermove", wake);
    window.addEventListener("keydown", wake);
    return () => {
      clearTimeout(t);
      window.removeEventListener("pointermove", wake);
      window.removeEventListener("keydown", wake);
    };
  }, []);

  // Keep the TV from sleeping mid-draw. The lock drops when the tab is hidden, so take it again.
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let gone = false;
    const take = async () => {
      if (document.visibilityState !== "visible" || !("wakeLock" in navigator)) return;
      try {
        lock = await navigator.wakeLock.request("screen");
        if (gone) void lock.release();
      } catch {
        /* not allowed here (e.g. battery saver) */
      }
    };
    void take();
    document.addEventListener("visibilitychange", take);
    return () => {
      gone = true;
      document.removeEventListener("visibilitychange", take);
      void lock?.release();
    };
  }, []);

  useEffect(() => {
    const sync = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", sync);
    return () => document.removeEventListener("fullscreenchange", sync);
  }, []);
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const needsClick = pref !== "off" && !unlocked;
  const ctrl =
    "flex h-11 items-center justify-center rounded-full border border-plum/15 bg-white/80 text-plum/80 transition-colors hover:border-wine hover:text-wine";

  return (
    <div
      ref={rootRef}
      className={`fixed inset-0 z-[35] flex items-center justify-center overflow-hidden bg-cream ${awake ? "" : "cursor-none"}`}
    >
      <div className="skjerm relative aspect-video w-[min(100vw,calc(100dvh*16/9))] [container-type:size]">
        <div className="absolute inset-0 flex flex-col px-[5cqh] pb-[4.5cqh] pt-[3.2cqh]">
          <header className="flex h-[5cqh] shrink-0 items-center justify-between gap-[2cqh]">
            <p className="flex min-w-0 items-baseline gap-[1.6cqh]">
              <span className="font-display text-[3cqh] font-semibold text-wine">Vinlotteri</span>
              <span className="truncate text-[2.1cqh] text-plum/70">{title}</span>
              {everConnected && !connected && (
                <span className="text-[1.8cqh] font-semibold text-wine">Mistet forbindelsen, kobler til igjen …</span>
              )}
            </p>
            <div className={`flex shrink-0 items-center gap-2 transition-opacity duration-500 ${awake || needsClick ? "" : "pointer-events-none opacity-0"}`}>
              {needsClick ? (
                <button type="button" onClick={turnOn} className={`${ctrl} gap-2 px-4 text-sm font-semibold text-wine`}>
                  <SpeakerIcon on /> Slå på lyd
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => (pref === "on" ? savePref("off") : turnOn())}
                  aria-label={muted ? "Slå på lyd" : "Slå av lyd"}
                  aria-pressed={!muted}
                  className={`${ctrl} w-11`}
                >
                  <SpeakerIcon on={!muted} />
                </button>
              )}
              <button type="button" onClick={toggleFull} aria-label={full ? "Avslutt fullskjerm" : "Fullskjerm"} className={`${ctrl} w-11`}>
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  {full ? <path d="M8 3v5H3m14 0h-5V3m0 14v-5h5M3 12h5v5" /> : <path d="M3 8V3h5m4 0h5v5m0 4v5h-5m-4 0H3v-5" />}
                </svg>
              </button>
              {/* Back to the round page, out of fullscreen first. */}
              <a
                href={`/runde/${roundId}`}
                onClick={() => {
                  if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
                }}
                aria-label="Avslutt storskjerm"
                title="Avslutt storskjerm"
                className={`${ctrl} w-11`}
              >
                <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
                  <path d="m5 5 10 10M15 5 5 15" />
                </svg>
              </a>
            </div>
          </header>
          <div className="mt-[3cqh] min-h-0 flex-1">{children}</div>
        </div>
      </div>
    </div>
  );
}

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 7.5h3l4-3.5v12l-4-3.5h-3z" />
      {on ? <path d="M13.5 7.2a4 4 0 0 1 0 5.6M15.7 5a7 7 0 0 1 0 10" /> : <path d="m13.5 7.5 5 5m0-5-5 5" />}
    </svg>
  );
}

/* -------------------------------------------------------------------------------- grid --- */

function StageGrid({
  size,
  cells,
  wins,
  aim,
}: {
  size: number;
  cells: RoundState["cells"];
  wins: Map<string, number>;
  aim: { col: number | null; row: number | null; phase: "aim" | "reveal" | "miss"; id: number } | null;
}) {
  const map = new Map(cells.map((c) => [`${c.row},${c.col}`, c]));
  const nums = Array.from({ length: size }, (_, i) => i + 1);
  const target = aim?.col != null && aim.row != null ? { col: aim.col, row: aim.row } : null;
  const live = aim && aim.phase !== "miss";

  return (
    <div className="h-full w-[84.3cqh] rounded-[2.2cqh] bg-parchment/70 p-[1.8cqh]">
      <div
        className="relative grid h-full w-full gap-[0.9cqh]"
        style={{ gridTemplateColumns: `4cqh repeat(${size}, minmax(0, 1fr))`, gridTemplateRows: `4cqh repeat(${size}, minmax(0, 1fr))` }}
      >
        {/* Everything is placed explicitly, so the dice overlays below can lie on top of the squares. */}
        {nums.map((c) => (
          <AxisNumber key={`c${c}`} n={c} lit={live && aim?.col === c} label="Kolonne" at={{ gridColumn: c + 1, gridRow: 1 }} />
        ))}
        {nums.map((r) => (
          <div key={`r${r}`} className="contents">
            <AxisNumber n={r} lit={live && aim?.row === r} label="Rad" at={{ gridColumn: 1, gridRow: r + 1 }} />
            {nums.map((c) => {
              const key = `${r},${c}`;
              const cell = map.get(key);
              const status = cell?.status ?? "available";
              const rank = wins.get(key);
              const isTarget = target?.col === c && target.row === r;
              const isMiss = aim?.phase === "miss" && isTarget;
              const isPulse = aim?.phase === "reveal" && isTarget;
              const colors =
                rank === 1
                  ? "border-gold bg-gradient-to-br from-gold-soft to-gold text-plum shadow-[0_2px_6px_rgba(194,147,58,0.45)] animate-winner-glow"
                  : rank != null
                    ? "border-gold bg-gold-soft text-plum shadow-[0_2px_4px_rgba(194,147,58,0.35)]"
                    : STATUS_STYLES[status];
              const label = gridLabel(cell?.name);
              return (
                <div
                  key={isMiss ? `${key}:${aim!.id}` : key}
                  data-cell={`${c}-${r}`}
                  style={{ gridColumn: c + 1, gridRow: r + 1 }}
                  className={`relative flex min-w-0 items-center justify-center rounded-[0.9cqh] px-[0.4cqh] text-center ${
                    rank != null ? "z-10 border-[0.3cqh]" : "border"
                  } ${colors} ${isMiss ? "animate-skjerm-nope" : isPulse ? "animate-skjerm-pulse z-20" : ""}`}
                >
                  {label ? (
                    <span className="line-clamp-2 text-[2.3cqh] font-semibold leading-tight [overflow-wrap:anywhere]">{label}</span>
                  ) : (
                    <span className="font-display text-[1.9cqh] lining-nums tabular-nums">
                      {c}-{r}
                    </span>
                  )}
                  {rank === 1 && <Crown className="absolute left-1/2 top-[0.5cqh] h-[1.9cqh] w-[2.7cqh] -translate-x-1/2 text-wine" />}
                  {rank != null && rank !== 1 && (
                    <span className="absolute right-[0.5cqh] top-[0.5cqh] flex h-[2.4cqh] w-[2.4cqh] items-center justify-center rounded-full bg-wine font-display text-[1.5cqh] font-bold lining-nums tabular-nums leading-none text-cream">
                      {rank}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {/* The dice, drawn over the board: a lit column, a lit row, and the crosshair where they meet. */}
        {live && aim.col != null && (
          <div
            key={`bc${aim.col}`}
            aria-hidden="true"
            className="skjerm-beam skjerm-beam-col"
            style={{ gridColumn: aim.col + 1, gridRow: `1 / span ${size + 1}` }}
          />
        )}
        {live && aim.row != null && (
          <div
            key={`br${aim.row}`}
            aria-hidden="true"
            className="skjerm-beam skjerm-beam-row"
            style={{ gridColumn: `1 / span ${size + 1}`, gridRow: aim.row + 1 }}
          />
        )}
        {live && target && (
          <div
            key={`x${target.col}-${target.row}`}
            aria-hidden="true"
            className={`skjerm-reticle ${aim.phase === "reveal" ? "is-reveal" : ""}`}
            style={{ gridColumn: target.col + 1, gridRow: target.row + 1 }}
          >
            <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
              <circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" strokeWidth="3.2" />
              <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="4 6" />
              <path d="M50 -8v22M50 86v22M-8 50h22M86 50h22" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function AxisNumber({ n, lit, label, at }: { n: number; lit: boolean | null; label: string; at: React.CSSProperties }) {
  return (
    <div
      style={at}
      aria-label={`${label} ${n}`}
      className={`flex items-center justify-center rounded-full font-display text-[2.4cqh] font-semibold lining-nums tabular-nums transition-colors duration-300 ${
        lit ? "z-30 bg-gold text-plum" : "text-wine/80"
      }`}
    >
      {n}
    </div>
  );
}

/* ------------------------------------------------------------------------------ scenes --- */

function SceneView({
  scene,
  round: st,
  draw,
  nextRank,
  hosts,
  buy,
  prizesLeft,
}: {
  scene: Scene;
  round: RoundState;
  draw: PublicDraw | undefined;
  nextRank: number | null;
  hosts: Record<string, HostFacts>;
  buy?: Buy;
  prizesLeft: Prize[];
}) {
  const title = "font-display font-semibold leading-[1.02] text-balance text-plum";
  const sub = "mt-[2cqh] text-[2.6cqh] leading-snug text-plum/75";

  switch (scene.kind) {
    case "aim":
    case "reveal": {
      const both = scene.col != null && scene.row != null;
      return (
        <div className="animate-reveal">
          <div className="flex items-end gap-[3cqh]">
            <Die label="Kolonne" n={scene.col} />
            <Die label="Rad" n={scene.row} />
          </div>
          <p className={`${title} mt-[3.4cqh] text-[6.4cqh]`}>
            {both ? (
              <>
                Rute {scene.col}-{scene.row}
                {scene.kind === "reveal" && <span className="dots" />}
              </>
            ) : scene.col != null ? (
              `Kolonne ${scene.col} …`
            ) : (
              `Rad ${scene.row} …`
            )}
          </p>
        </div>
      );
    }
    case "winner": {
      const prize = draw?.prizeId != null ? st.prizes.find((p) => p.id === draw.prizeId) : undefined;
      return (
        <div className="animate-skjerm-name">
          <p className="text-[2.6cqh] font-semibold text-wine">
            {draw?.col && draw.row ? `Rute ${draw.col}-${draw.row}` : "Vinneren er"}
          </p>
          <p className={`${title} mt-[1.2cqh] flex items-center gap-[2.4cqh] text-[13cqh]`}>
            {scene.rank === 1 && <Crown className="h-[7cqh] w-[10cqh] shrink-0 text-gold" />}
            <span className="min-w-0 [overflow-wrap:anywhere]">{draw?.winnerName}</span>
          </p>
          <p className={sub}>{prize && scene.last ? `Får den siste premien: ${prizeLabel(prize)}` : "Velger premie …"}</p>
        </div>
      );
    }
    case "miss":
      return (
        <div className="animate-reveal">
          <p className={`${title} text-[7.2cqh]`}>
            {scene.outcome === "no-eligible"
              ? "Ingen ruter igjen å trekke blant"
              : scene.outcome === "taken"
                ? "Har vunnet før – kast på nytt!"
                : "Tom rute – kast på nytt!"}
          </p>
          {scene.col != null && scene.row != null && (
            <p className={sub}>
              {scene.outcome === "taken"
                ? `Rute ${scene.col}-${scene.row} har allerede vunnet i dag.`
                : `Ingen kjøpte rute ${scene.col}-${scene.row}.`}
            </p>
          )}
        </div>
      );
    case "choice": {
      const prize = st.prizes.find((p) => p.id === scene.prizeId);
      return <ChoiceScene name={draw?.winnerName ?? ""} prize={prize} auto={scene.auto} />;
    }
    case "later":
      return (
        <div className="animate-reveal">
          <p className={`${title} text-[7.2cqh]`}>{draw?.winnerName} velger senere</p>
          <p className={sub}>Premien venter. Vi trekker videre.</p>
        </div>
      );
    default: {
      const status = st.round.status;
      if (status === "open" && buy?.qr) return <BuyScene st={st} buy={buy} />;
      if (status === "draft" || status === "open")
        return (
          <div className="animate-reveal">
            <p className={`${title} text-[8.6cqh]`}>Trekningen starter snart</p>
            <p className={sub}>
              {st.money.sold} av {st.round.grid_size * st.round.grid_size} lodd er solgt.
            </p>
          </div>
        );
      if (!nextRank) {
        const waiting = st.draws.filter((d) => d.winnerName && d.prizeId == null);
        if (!waiting.length) return <FinishScene st={st} hosts={hosts} />;
        return (
          <div className="animate-reveal">
            <p className={`${title} text-[8.6cqh]`}>Alle vinnerne er trukket</p>
            <p className={sub}>Venter på at {waiting.map((d) => d.winnerName).join(" og ")} velger premie.</p>
          </div>
        );
      }
      const only = prizesLeft.length === 1 ? prizesLeft[0] : undefined;
      return (
        <div className="animate-reveal flex items-center gap-[4cqh]">
          <div className="min-w-0 flex-1">
            <p className={`${title} text-[9.6cqh]`}>Kast terningene!</p>
            <p className={sub}>
              {only
                ? `Det spilles om den siste premien: ${prizeLabel(only)}.`
                : `Vinneren velger blant ${prizesLeft.length} premier.`}
            </p>
          </div>
          {only && <Bottle prize={only} className="h-[26cqh] w-[12cqh]" />}
        </div>
      );
    }
  }
}

/** Sales are still open: a QR to the round, big enough to scan from a chair. */
function BuyScene({ st, buy }: { st: RoundState; buy: Buy }) {
  const total = st.round.grid_size * st.round.grid_size;
  const free = total - st.money.sold;
  const close = st.round.sales_close_at;
  return (
    <div className="animate-reveal flex items-center gap-[4cqh]">
      <div className="min-w-0 flex-1">
        <p className="font-display text-[6.6cqh] font-semibold leading-[1.02] text-balance text-plum">
          {free > 0 ? "Skann og kjøp lodd" : "Alle rutene er solgt"}
        </p>
        <p className="mt-[2cqh] text-[2.6cqh] leading-snug text-plum/75">
          {free > 0 ? (
            <>
              {free === 1 ? "Én rute er ledig" : `${free} av ${total} ruter er ledige`}
              {close && (
                <>
                  , og salget stenger <span suppressHydrationWarning>{weekdayTime(close)}</span>
                </>
              )}
              .
            </>
          ) : (
            "Trekningen starter når salget stenger."
          )}
        </p>
        <p className="mt-[2.4cqh] truncate font-display text-[2.4cqh] font-semibold text-wine">{buy.url.replace(/^https?:\/\//, "")}</p>
      </div>
      {free > 0 && (
        <div className="shrink-0 rounded-[1.6cqh] border-[0.4cqh] border-gold bg-white p-[1.4cqh] shadow-[0_1.2cqh_3cqh_-1.6cqh_rgba(44,10,20,0.45)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={buy.qr!} alt={`QR-kode til ${buy.url}`} className="block h-[30cqh] w-[30cqh] [image-rendering:pixelated]" />
        </div>
      )}
    </div>
  );
}

/** The draw is over: who hosts next week, and the sum that goes with them. */
function FinishScene({ st, hosts }: { st: RoundState; hosts: Record<string, HostFacts> }) {
  const host = st.draws.find((d) => d.rank === 1)?.winnerName;
  const f = host ? hosts[normName(host)] : undefined;
  const facts = f
    ? [
        f.hosted ? `${f.hosted + 1}. gang som arrangør` : "Første gang som arrangør",
        !f.wins
          ? f.lodd
            ? `første seier etter ${f.lodd} lodd`
            : "første lodd, og rett til topps"
          : f.firstPrizes
            ? `${f.firstPrizes + 1}. gang med 1. premie`
            : `${f.wins + 1}. premie totalt`,
      ]
    : [];
  return (
    <div className="animate-reveal">
      <p className="font-display text-[8.6cqh] font-semibold leading-[1.02] text-plum">God helg!</p>
      {host && (
        <div className="mt-[2.4cqh]">
          <p className="text-[2.6cqh] leading-snug text-plum/75">Neste runde arrangeres av</p>
          <p className="mt-[0.4cqh] flex items-center gap-[1.4cqh] font-display text-[5.2cqh] font-semibold leading-tight text-plum">
            <Crown className="h-[3cqh] w-[4.2cqh] shrink-0 text-gold" />
            <span className="min-w-0 [overflow-wrap:anywhere]">{host}</span>
          </p>
          {facts.length > 0 && <p className="mt-[0.6cqh] text-[2.2cqh] text-plum/70">{facts.join(" · ")}</p>}
        </div>
      )}
    </div>
  );
}

/** The sum that goes on to next week, once the draw is over. */
function Ledger({ money: m }: { money: RoundState["money"] }) {
  const row = "flex items-baseline justify-between gap-[2cqh] py-[0.25cqh]";
  return (
    <dl aria-label="Regnskapet" className="text-[1.7cqh] lining-nums tabular-nums text-plum/70">
      <div className={row}>
        <dt>Inn fra forrige runde</dt>
        <dd>{kr(m.carriedOver)} kr</dd>
      </div>
      <div className={row}>
        <dt>
          Lodd solgt ({m.sold} × {m.ticketPrice} kr)
        </dt>
        <dd>+ {kr(m.loddSolgt)} kr</dd>
      </div>
      <div className={row}>
        <dt>Kost på polet</dt>
        <dd>− {kr(m.poletCost)} kr</dd>
      </div>
      <div className={`${row} mt-[0.3cqh] border-t border-plum/20 pt-[0.6cqh] font-display text-[2.2cqh] font-semibold text-plum`}>
        <dt>Går videre</dt>
        <dd className={m.videre < 0 ? "text-wine" : ""}>{m.videre < 0 ? "− " : ""}{kr(Math.abs(m.videre))} kr</dd>
      </div>
    </dl>
  );
}

/** One die as a square: dashed and empty until it's read off, then a sold square with the number. */
function Die({ label, n }: { label: string; n: number | null }) {
  return (
    <div className="flex flex-col items-center gap-[1cqh]">
      <span className="text-[1.9cqh] font-semibold tracking-wide text-plum/70">{label}</span>
      {n != null ? (
        <span
          key={n}
          className="animate-skjerm-die flex h-[13cqh] w-[13cqh] items-center justify-center rounded-[1.6cqh] border border-wine-dark bg-wine font-display text-[8cqh] font-semibold lining-nums tabular-nums text-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.14),0_6px_14px_-6px_rgba(44,10,20,0.45)]"
        >
          {n}
        </span>
      ) : (
        <span className="flex h-[13cqh] w-[13cqh] items-center justify-center rounded-[1.6cqh] border-[0.3cqh] border-dashed border-plum/25 font-display text-[6cqh] text-plum/35">
          ?
        </span>
      )}
    </div>
  );
}

/** The chosen bottle flies out of the prize strip into the scene. */
function ChoiceScene({ name, prize, auto }: { name: string; prize: Prize | undefined; auto?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const from = prize && document.querySelector<HTMLElement>(`[data-prize-thumb="${prize.id}"]`);
    if (!el || !from || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const a = from.getBoundingClientRect();
    const b = el.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const dx = a.left + a.width / 2 - (b.left + b.width / 2);
    const dy = a.top + a.height / 2 - (b.top + b.height / 2);
    const s = Math.max(0.1, a.height / b.height);
    el.animate(
      [
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35 - b.height * 0.18}px) scale(${(s + 1) / 2}) rotate(-6deg)`, offset: 0.5 },
        { transform: "none" },
      ],
      { duration: 1000, easing: "cubic-bezier(0.16, 1, 0.3, 1)", fill: "backwards" },
    );
  }, [prize]);

  return (
    <div className="flex items-center gap-[4cqh]">
      <div ref={ref} className="shrink-0">
        <Bottle prize={prize} className="h-[32cqh] w-[14cqh]" />
      </div>
      <div className="animate-skjerm-name min-w-0 [animation-delay:350ms]">
        <p className="text-[2.6cqh] font-semibold text-wine">
          {name} {auto ? "får" : "valgte"}
        </p>
        <p className="mt-[1.2cqh] font-display text-[6cqh] font-semibold leading-[1.05] text-balance text-plum [overflow-wrap:anywhere]">
          {prizeLabel(prize)}
        </p>
      </div>
    </div>
  );
}

function Bottle({ prize, className, standing }: { prize: Prize | undefined; className: string; standing?: boolean }) {
  const src = prizeImage(prize);
  return (
    <div className={`flex justify-center ${standing ? "items-end" : "items-center"} ${className}`}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        // Vinmonopolet's photos sit on white; multiply lets the bottle stand on the page's own ground.
        <img src={src} alt="" className={`h-full w-full object-contain mix-blend-multiply ${standing ? "object-bottom" : ""}`} />
      ) : (
        <svg viewBox="0 0 40 100" aria-hidden="true" className="h-full w-auto text-wine">
          <path d="M16 4h8v22c0 4 9 8 9 20v46a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V46c0-12 9-16 9-20z" fill="currentColor" />
          <rect x="11" y="52" width="18" height="20" rx="1.5" fill="var(--color-cream)" opacity="0.9" />
        </svg>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------------- sidebar --- */

/**
 * One shelf under the scene: the bottles still to be won on the left, the winners and the bottle
 * each of them took on the right. A chosen bottle leaves the left side and lands on the right.
 */
function Shelf({
  prizesLeft,
  flying,
  prizes,
  draws,
  choices,
  allDrawn,
}: {
  prizesLeft: Prize[];
  flying: number | null;
  prizes: Prize[];
  draws: PublicDraw[];
  choices: Set<number>;
  /** Every place has a winner: the shelf is the round's result, not the story so far. */
  allDrawn: boolean;
}) {
  if (!prizesLeft.length && !draws.length) return null;
  const left = prizesLeft.filter((p) => p.id !== flying).length;
  return (
    <div className="flex items-stretch gap-[3cqh]">
      {prizesLeft.length > 0 && (
        <ShelfGroup
          label={left === 1 ? "Siste premie" : left ? `${left} premier igjen` : "Alle premiene er delt ut"}
          count={prizesLeft.length}
          board="bg-plum/12"
        >
          {prizesLeft.map((p) => (
            <li
              key={p.id}
              className={`flex min-w-0 flex-col items-center transition-opacity duration-500 ${p.id === flying ? "opacity-25" : ""}`}
            >
              <div data-prize-thumb={p.id} className="flex h-[15cqh] w-full items-end justify-center">
                <Bottle prize={p} standing className="h-full w-[8cqh]" />
              </div>
              <span className="mt-[1.4cqh] line-clamp-2 w-full text-center text-[1.6cqh] leading-tight text-plum/75">
                {prizeLabel(p)}
              </span>
            </li>
          ))}
        </ShelfGroup>
      )}

      {prizesLeft.length > 0 && draws.length > 0 && <div aria-hidden="true" className="w-px shrink-0 bg-plum/10" />}

      {draws.length > 0 && (
        <ShelfGroup label={allDrawn ? "Rundens vinnere" : "Vinnerne så langt"} count={draws.length} board="bg-gold shadow-[0_0.5cqh_1.2cqh_-0.4cqh_rgba(194,147,58,0.55)]">
          {draws.map((d) => {
            const prize = d.prizeId != null && choices.has(d.rank) ? prizes.find((p) => p.id === d.prizeId) : undefined;
            return (
              <li key={d.rank} className="flex min-w-0 flex-col items-center">
                <div className="flex h-[15cqh] w-full items-end justify-center">
                  {prize ? (
                    <Bottle
                      key={prize.id}
                      prize={prize}
                      standing
                      className={`h-full w-[8cqh] ${prize.id === flying ? "animate-skjerm-shelve" : ""}`}
                    />
                  ) : (
                    <EmptyBottle later={!!d.skipped} />
                  )}
                </div>
                <span className="mt-[1.2cqh] flex max-w-full items-center gap-[0.8cqh]">
                  <RankSquare rank={d.rank} />
                  <span className="min-w-0 truncate font-display text-[2.2cqh] font-semibold leading-tight text-plum">
                    {d.winnerName}
                  </span>
                </span>
                <span className="mt-[0.4cqh] w-full truncate text-center text-[1.5cqh] leading-tight text-plum/65">
                  {prize ? prizeLabel(prize) : d.skipped ? "velger senere" : "velger premie …"}
                </span>
              </li>
            );
          })}
        </ShelfGroup>
      )}
    </div>
  );
}

function ShelfGroup({ label, count, board, children }: { label: string; count: number; board: string; children: React.ReactNode }) {
  return (
    <section aria-label={label} className="min-w-0" style={{ flex: `${count} 1 0%` }}>
      <h2 className="font-display text-[2.6cqh] font-semibold text-plum">{label}</h2>
      <div className="relative mt-[1.4cqh]">
        {/* The shelf board the bottles stand on, right under the row of bottles (15cqh tall). */}
        <div aria-hidden="true" className={`absolute inset-x-0 top-[15cqh] h-[0.6cqh] rounded-full ${board}`} />
        <ul className="relative grid gap-[1.2cqh]" style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}>
          {children}
        </ul>
      </div>
    </section>
  );
}

/** A won square in miniature: the crown on gold for 1st prize, the rank on pale gold for the rest. */
function RankSquare({ rank }: { rank: number }) {
  return rank === 1 ? (
    <span
      aria-label="1."
      className="flex h-[2.8cqh] w-[2.8cqh] shrink-0 items-center justify-center rounded-[0.6cqh] border-[0.2cqh] border-gold bg-gradient-to-br from-gold-soft to-gold"
    >
      <Crown className="h-[1.3cqh] w-[1.8cqh] text-wine" />
    </span>
  ) : (
    <span className="flex h-[2.8cqh] w-[2.8cqh] shrink-0 items-center justify-center rounded-[0.6cqh] border-[0.2cqh] border-gold bg-gold-soft font-display text-[1.6cqh] font-bold lining-nums tabular-nums leading-none text-plum">
      {rank}
    </span>
  );
}

/** A winner who hasn't chosen yet: the bottle's outline, dashed like every not-yet-chosen square. */
function EmptyBottle({ later }: { later: boolean }) {
  return (
    <svg viewBox="0 0 40 100" aria-hidden="true" className={`h-[13.5cqh] w-auto ${later ? "text-plum/25" : "text-gold"}`}>
      <path
        d="M16 4h8v22c0 4 9 8 9 20v46a4 4 0 0 1-4 4H11a4 4 0 0 1-4-4V46c0-12 9-16 9-20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray="4 3.5"
      />
      <text x="20" y="68" textAnchor="middle" className="fill-plum/45 font-display" fontSize="18" fontWeight="600">
        ?
      </text>
    </svg>
  );
}

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { roundAction } from "@/lib/adminApi";
import Grid, { Crown, type GridCell } from "@/components/Grid";
import { gridLabel } from "@/lib/format";
import { vinmonopoletImage } from "@/lib/vinmonopolet";
import type { AdminRoundState } from "@/lib/adminTypes";
import { awaitingChoice, parseWishes, prizeOfDraw, skippedWinners, unclaimedPrizes, wishedPrize, type Phase } from "@/lib/phases";
import type { Draw, DrawMode, Prize } from "@/lib/types";
import { ConfirmButton, ErrorNote, IconArrowRight, btn, useAction } from "./ui";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type Result =
  | { kind: "winner"; rank: number; name: string; col: number; row: number }
  | { kind: "miss"; text: string };

export default function DrawPanel({
  state,
  reload,
  locked,
  goTo,
}: {
  state: AdminRoundState;
  reload: () => void;
  locked: boolean;
  goTo: (p: Phase) => void;
}) {
  const { round, prizes, cells } = state;
  const roundId = round.id;
  const size = round.grid_size;
  const [mode, setMode] = useState<DrawMode>(round.draw_mode);
  const [sweep, setSweep] = useState<{ row: number; col: number } | null>(null);
  const [col, setCol] = useState<number | null>(null);
  const [row, setRow] = useState<number | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const { run, busy, error } = useAction();
  // The rank being drawn digitally. The live update lands before the sweep finishes, so hide
  // that draw until the result card reveals it.
  const [revealing, setRevealing] = useState<number | null>(null);
  const draws = useMemo(() => state.draws.filter((d) => d.rank !== revealing), [state.draws, revealing]);
  // History editing (/superadmin): the draw whose winning square is being corrected by tapping the grid.
  const canFix = locked && state.historyEdit;
  const [fixRank, setFixRank] = useState<number | null>(null);

  const gridCells: GridCell[] = cells.map((c) => ({
    row: c.row,
    col: c.col,
    status: c.status,
    label: gridLabel(c.buyer_name),
  }));

  const wins = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of draws) {
      if (!d.row || !d.col || !d.winner_name) continue;
      const key = `${d.row},${d.col}`;
      const existing = m.get(key);
      if (existing === undefined || d.rank < existing) m.set(key, d.rank);
    }
    return m;
  }, [draws]);

  // Draws are numbered by draw order; each winner then picks one of the prizes still left.
  const winnerOf = (rank: number) => draws.find((d) => d.rank === rank && d.winner_name);
  const places = prizes.map((_, i) => i + 1);
  const next = places.find((r) => !winnerOf(r));
  // A skipped winner who turned up after all ("Velg nå") picks before the draw carries on.
  const [pickFor, setPickFor] = useState<number | null>(null);
  const choosing =
    draws.find((d) => d.rank === pickFor && d.winner_name && d.prize_id == null) ?? awaitingChoice(draws);
  const waiting = skippedWinners(draws);
  const left = unclaimedPrizes(prizes, draws);
  const cellOf = (d: Draw) => cells.find((c) => c.id === d.winner_cell_id);
  const salesStillOpen = round.status === "draft" || round.status === "open";
  const soldCount = cells.filter((c) => c.status === "sold" || c.status === "held").length;
  const lastRoll = result?.kind === "winner" ? { row: result.row, col: result.col } : null;

  function announce(rank: number, r: { outcome: string; winnerName: string | null; row: number | null; col: number | null }, c: number, rw: number) {
    if (r.outcome === "winner") {
      setResult({ kind: "winner", rank, name: r.winnerName ?? "", col: r.col ?? c, row: r.row ?? rw });
      setCol(null);
      setRow(null);
    } else
      setResult({
        kind: "miss",
        text:
          r.outcome === "empty"
            ? `Rute ${c}-${rw} er tom. Kast på nytt.`
            : r.outcome === "taken"
              ? `Rute ${c}-${rw} har allerede vunnet. Kast på nytt.`
              : "Ingen ruter igjen å trekke blant.",
      });
  }

  async function physical(e: React.FormEvent) {
    e.preventDefault();
    if (!next || !col || !row) return;
    const rank = next;
    const c = col;
    const rw = row;
    await run(async () => {
      const { result: r } = await roundAction(roundId, { type: "draw", rank, method: "physical", row: rw, col: c });
      announce(rank, r, c, rw);
      reload();
    });
  }

  async function digital() {
    if (!next) return;
    const rank = next;
    setResult(null);
    setRevealing(rank);
    await run(async () => {
      try {
        const { result: r } = await roundAction(roundId, { type: "draw", rank, method: "digital" });
        const steps: [number, number][] = [
          ...(r.rerolls ?? []).slice(-10),
          ...(r.row ? ([[r.row, r.col]] as [number, number][]) : []),
        ];
        for (const [rr, cc] of steps) {
          setSweep({ row: rr, col: cc });
          await sleep(130);
        }
        setSweep(null);
        announce(rank, r, r.col ?? 0, r.row ?? 0);
        reload();
      } finally {
        setRevealing(null);
      }
    });
  }

  const choose = (rank: number, prizeId: number | null) =>
    run(async () => {
      await roundAction(roundId, { type: "choosePrize", rank, prizeId });
      setPickFor(null);
      reload();
    });

  const skip = (rank: number) =>
    run(async () => {
      await roundAction(roundId, { type: "skipChoice", rank });
      setPickFor(null);
      setResult(null);
      reload();
    });

  const setSquare = (rank: number, cellId: number | null) =>
    run(async () => {
      await roundAction(roundId, { type: "drawSquare", rank, cellId });
      setFixRank(null);
      reload();
    });

  const fixing = fixRank != null ? winnerOf(fixRank) : undefined;
  const pickSquare = (g: GridCell) => {
    const cell = cells.find((c) => c.row === g.row && c.col === g.col);
    if (fixing && cell && (cell.status === "sold" || cell.status === "held")) setSquare(fixing.rank, cell.id);
  };

  const undo = (rank: number) =>
    run(async () => {
      await roundAction(roundId, { type: "clearDraw", rank });
      setResult(null);
      reload();
    });

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:items-start">
        <div className="space-y-4">
          {result && <ResultCard result={result} onUndo={locked ? undefined : undo} busy={busy} />}

          {choosing && !locked && (
            <ChoosePrize
              rank={choosing.rank}
              name={choosing.winner_name ?? ""}
              prizes={unclaimedPrizes(prizes, draws, choosing.rank)}
              wished={wishedPrize(cellOf(choosing), prizes, draws, choosing.rank)}
              wishes={parseWishes(cellOf(choosing)?.wishes)
                .map((id) => prizes.find((p) => p.id === id))
                .filter((p): p is Prize => !!p)}
              busy={busy}
              onChoose={(id) => choose(choosing.rank, id)}
              onSkip={choosing.skipped ? () => setPickFor(null) : () => skip(choosing.rank)}
              skipLabel={choosing.skipped ? "Avbryt" : undefined}
              error={error}
            />
          )}

          {canFix && (
            <div className="rounded-xl border border-gold/60 bg-white p-5">
              {fixing ? (
                <>
                  <h3 className="font-display text-xl font-semibold text-wine">
                    Hvilken rute vant {fixing.winner_name}?
                  </h3>
                  <p className="mt-1 text-sm text-plum/80">
                    Trykk på ruten i rutenettet. Vinnernavnet blir navnet på ruten
                    {fixing.col && fixing.row ? `, i dag ${fixing.col}-${fixing.row}` : ""}.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => setFixRank(null)} className={btn.secondary}>
                      Avbryt
                    </button>
                    {fixing.winner_cell_id != null && (
                      <button type="button" disabled={busy} onClick={() => setSquare(fixing.rank, null)} className={btn.quiet}>
                        Fjern ruten
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-sm text-plum/80">
                  Retting av historikk er slått på. Trykk «Rett rute» på en vinner for å velge hvilken rute som vant.
                </p>
              )}
              <ErrorNote>{error}</ErrorNote>
            </div>
          )}

          {!prizes.length ? (
            <div className="rounded-xl bg-parchment/70 p-4 text-sm text-plum">
              Ingen premier lagt inn.{" "}
              <button type="button" onClick={() => goTo("forbered")} className="font-semibold text-wine underline underline-offset-4">
                Legg inn premier
              </button>
            </div>
          ) : salesStillOpen ? (
            <div className="rounded-xl border border-plum/10 bg-white p-5">
              <h3 className="font-display text-xl font-semibold text-plum">Salget må stenges først</h3>
              <p className="mt-1 text-sm text-plum/80">
                {soldCount} lodd er solgt. Når salget er stengt, kan ingen kjøpe flere mens dere trekker.
              </p>
              <button
                type="button"
                disabled={busy || round.status === "draft"}
                onClick={() => run(() => roundAction(roundId, { type: "status", status: "closed" }).then(reload))}
                className={`${btn.primary} mt-4`}
              >
                Steng salget og start trekningen
              </button>
            </div>
          ) : choosing ? null : next && !locked ? (
            <div className="rounded-xl border border-gold/60 bg-white p-5 shadow-[0_8px_24px_-14px_rgba(123,30,59,0.35)]">
              <div className="flex items-center gap-4">
                {left.length === 1 && <PrizeThumb varenummer={left[0].varenummer} image={left[0].image_url} />}
                <div className="min-w-0">
                  <h3 className="font-display text-2xl font-semibold text-wine">{next}. vinner</h3>
                  <p className="truncate text-sm text-plum/80">
                    {left.length === 1
                      ? `Får den siste premien: ${prizeLabel(left[0])}`
                      : `Velger blant ${left.length} premier`}
                  </p>
                </div>
              </div>

              {mode === "physical" ? (
                <form onSubmit={physical} className="mt-5 space-y-4">
                  <DiePicker legend="Kolonne" size={size} value={col} onChange={setCol} />
                  <DiePicker legend="Rad" size={size} value={row} onChange={setRow} />
                  <button type="submit" disabled={busy || !col || !row} className={`${btn.primary} w-full text-lg`}>
                    {col && row ? (
                      <>
                        Registrer rute {col}-{row} <IconArrowRight />
                      </>
                    ) : (
                      "Velg kolonne og rad"
                    )}
                  </button>
                </form>
              ) : (
                <button type="button" onClick={digital} disabled={busy} className={`${btn.primary} mt-5 w-full text-lg`}>
                  {busy ? "Trekker…" : "Trekk vinner"}
                </button>
              )}
              <p className="mt-3 text-center text-sm">
                <button type="button" onClick={() => setMode(mode === "physical" ? "digital" : "physical")} className={btn.quiet}>
                  {mode === "physical" ? "Trekk digitalt i stedet" : "Bruk terninger i stedet"}
                </button>
              </p>
              <ErrorNote>{error}</ErrorNote>
            </div>
          ) : !next && waiting.length ? (
            <div className="rounded-xl bg-parchment/70 p-5 text-plum">
              <p className="font-display text-xl font-semibold">Alle vinnerne er trukket.</p>
              <p className="mt-1 text-sm text-plum/80">
                Venter på at {waiting.map((d) => d.winner_name).join(" og ")} velger premie. De kan velge selv fra
                mobilen, eller du trykker «Velg nå» når de dukker opp.
              </p>
            </div>
          ) : !next ? (
            <div className="rounded-xl bg-sage/10 p-5 text-plum">
              <p className="font-display text-xl font-semibold">Alle premiene er trukket.</p>
              {round.status !== "settled" && (
                <button type="button" onClick={() => goTo("oppgjor")} className={`${btn.primary} mt-3`}>
                  Gå til oppgjøret <IconArrowRight />
                </button>
              )}
            </div>
          ) : null}

          {prizes.length > 0 && (
            <div>
              <h3 className="font-display text-lg font-semibold text-plum">Vinnerne</h3>
              <ol className="mt-2 divide-y divide-plum/10 rounded-xl border border-plum/10 bg-white">
                {places.map((rank) => {
                  const d = winnerOf(rank);
                  const prize = d && prizeOfDraw(prizes, d);
                  return (
                    <li key={rank} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5">
                      <span className="w-6 font-display text-lg font-semibold tabular-nums text-wine">{rank}.</span>
                      {d ? (
                        <>
                          <span className="flex min-w-0 flex-1 items-center gap-2">
                            {rank === 1 && <Crown className="h-3.5 w-4 shrink-0 text-gold" />}
                            <span className="font-semibold text-plum">{d.winner_name}</span>
                            <span className="text-xs tabular-nums text-plum/70">
                              {d.col && d.row ? `${d.col}-${d.row}` : "ukjent rute"} ·{" "}
                              {d.method === "digital" ? "digital" : "terning"}
                            </span>
                          </span>
                          {canFix && fixRank !== rank && (
                            <button type="button" disabled={busy} onClick={() => setFixRank(rank)} className={`${btn.quiet} text-xs`}>
                              Rett rute
                            </button>
                          )}
                          {!locked && (
                            <ConfirmButton
                              className={`${btn.quiet} text-xs`}
                              question="Nullstille?"
                              confirmLabel="Nullstill"
                              onConfirm={() => undo(rank)}
                            >
                              Nullstill
                            </ConfirmButton>
                          )}
                          <span className="flex min-w-0 basis-full items-center gap-2 pl-9 text-sm text-plum/80">
                            {prize ? (
                              <>
                                <span className="min-w-0 truncate">Valgte {prizeLabel(prize)}</span>
                                {!locked && !choosing && (
                                  <button type="button" disabled={busy} onClick={() => choose(rank, null)} className={`${btn.quiet} text-xs`}>
                                    Bytt
                                  </button>
                                )}
                              </>
                            ) : d.skipped ? (
                              <>
                                <span className="text-plum/70">Ikke til stede – velger senere</span>
                                {!locked && !choosing && (
                                  <button type="button" disabled={busy} onClick={() => setPickFor(rank)} className={`${btn.quiet} text-xs`}>
                                    Velg nå
                                  </button>
                                )}
                              </>
                            ) : (
                              <span className="text-plum/70">Velger premie …</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="text-sm text-plum/70">{rank === next && !choosing ? "Trekkes nå" : "Ikke trukket"}</span>
                      )}
                      {d?.seed && (
                        <span className="basis-full pl-9 text-xs text-plum/70">
                          Kontrollkode <code className="tabular-nums">{d.seed}</code>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ol>
              {left.length > 0 && left.length < prizes.length && (
                <p className="mt-2 text-sm text-plum/70">
                  Igjen: {left.map(prizeLabel).join(", ")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* On phones the grid steps out of the timeline indent so the squares get room for names. */}
        <div className="relative -ml-11 sm:ml-0">
          <Grid
            size={size}
            cells={gridCells}
            wins={wins}
            sweeping={sweep}
            highlight={sweep ?? (fixing?.row && fixing.col ? { row: fixing.row, col: fixing.col } : lastRoll)}
            onCellClick={fixing ? pickSquare : undefined}
          />
        </div>
      </div>
    </div>
  );
}

/** One die: a row of big numbered buttons that behave as a radio group. */
function DiePicker({
  legend,
  size,
  value,
  onChange,
}: {
  legend: string;
  size: number;
  value: number | null;
  onChange: (n: number) => void;
}) {
  const name = `die-${legend}`;
  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-semibold text-plum">{legend}</legend>
      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(size, 10)}, minmax(0, 1fr))` }}>
        {Array.from({ length: size }, (_, i) => i + 1).map((n) => (
          <label key={n} className="relative">
            <input
              type="radio"
              name={name}
              value={n}
              checked={value === n}
              onChange={() => onChange(n)}
              className="peer sr-only"
            />
            <span className="flex h-12 cursor-pointer items-center justify-center rounded-lg border border-plum/20 bg-cream text-xl font-bold tabular-nums text-plum transition-colors hover:border-wine peer-checked:border-wine peer-checked:bg-wine peer-checked:text-cream peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-wine">
              {n}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ResultCard({
  result,
  onUndo,
  busy,
}: {
  result: Result;
  onUndo?: (rank: number) => void;
  busy: boolean;
}) {
  // On a phone the organiser is looking at the dice pad; bring the outcome into view.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [result]);

  if (result.kind === "miss")
    return (
      <div ref={ref} role="status" key={result.text} className="animate-reveal rounded-xl bg-parchment/80 px-5 py-4 text-plum">
        <p className="font-display text-lg font-semibold">{result.text}</p>
      </div>
    );
  return (
    <div
      ref={ref}
      role="status"
      key={`${result.rank}-${result.col}-${result.row}`}
      className="animate-reveal rounded-xl bg-gradient-to-br from-gold-soft/70 to-cream px-5 py-5 text-plum shadow-[0_10px_30px_-16px_rgba(194,147,58,0.9)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-wine">
            {result.rank}. vinner · rute {result.col}-{result.row}
          </p>
          <p className="mt-1 flex items-center gap-3 font-display text-4xl font-semibold text-balance text-plum">
            {result.rank === 1 && <Crown className="animate-crown h-6 w-8 text-gold" />}
            {result.name}
          </p>
        </div>
        {onUndo && (
          <button type="button" disabled={busy} onClick={() => onUndo(result.rank)} className={`${btn.quiet} text-xs`}>
            Angre
          </button>
        )}
      </div>
    </div>
  );
}

const prizeLabel = (p: Prize) => p.name || `varenr. ${p.varenummer ?? "?"}`;

/** The winner just drawn says which of the remaining prizes they want. */
function ChoosePrize({
  rank,
  name,
  prizes,
  wished,
  wishes,
  busy,
  onChoose,
  onSkip,
  skipLabel,
  error,
}: {
  rank: number;
  name: string;
  prizes: Prize[];
  /** The winner's most wanted prize that is still left. */
  wished?: { prize: Prize; place: number };
  /** Their whole wish list, most wanted first. */
  wishes: Prize[];
  busy: boolean;
  onChoose: (prizeId: number) => void;
  onSkip: () => void;
  /** Replaces the "not here" button, e.g. "Avbryt" when picking for someone skipped earlier. */
  skipLabel?: string;
  error: string | null;
}) {
  return (
    <div className="rounded-xl border border-gold/60 bg-white p-5 shadow-[0_8px_24px_-14px_rgba(123,30,59,0.35)]">
      <h3 className="font-display text-2xl font-semibold text-wine">Hvilken premie vil {name} ha?</h3>
      <p className="mt-1 text-sm text-plum/80">
        {rank}. vinner velger blant {prizes.length === 1 ? "den siste premien" : `de ${prizes.length} premiene som er igjen`}.
      </p>
      {wished && (
        <div className="mt-4 rounded-lg bg-gold-soft/40 p-3">
          <p className="text-sm text-plum/80">
            Ønskeliste:{" "}
            {wishes.map((p, i) => (
              <span key={p.id} className={prizes.some((x) => x.id === p.id) ? "" : "line-through opacity-60"}>
                {i > 0 && ", "}
                {i + 1}. {prizeLabel(p)}
              </span>
            ))}
          </p>
          <button type="button" disabled={busy} onClick={() => onChoose(wished.prize.id)} className={`${btn.primary} mt-3 w-full`}>
            Gi {name}: {prizeLabel(wished.prize)} (ønske {wished.place}) <IconArrowRight />
          </button>
          <p className="mt-2 text-center text-xs text-plum/70">Er {name} her og vil ha noe annet? Velg under.</p>
        </div>
      )}
      <ul className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {prizes.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={busy}
              onClick={() => onChoose(p.id)}
              className="flex h-full w-full flex-col items-center gap-2 rounded-lg border border-plum/20 bg-cream p-3 text-center text-sm text-plum transition-colors hover:border-wine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine disabled:opacity-60"
            >
              <PrizeThumb varenummer={p.varenummer} image={p.image_url} />
              <span className="font-medium leading-tight">{prizeLabel(p)}</span>
            </button>
          </li>
        ))}
      </ul>
      {(!wished || skipLabel) && (
        <p className="mt-4 text-center text-sm">
          <button type="button" disabled={busy} onClick={onSkip} className={btn.quiet}>
            {skipLabel ?? `${name} er ikke til stede – velger senere`}
          </button>
        </p>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function PrizeThumb({ varenummer, image }: { varenummer: string | null; image: string | null }) {
  const src = image || vinmonopoletImage(varenummer);
  return (
    <div className="flex h-16 w-12 shrink-0 items-center justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-auto object-contain" />
      ) : (
        <span aria-hidden="true" className="text-2xl">🍾</span>
      )}
    </div>
  );
}

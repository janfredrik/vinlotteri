"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Prize, PublicCell, RoundState } from "@/lib/types";
import { useRoundState } from "@/lib/useRoundState";
import { formatPrice } from "@/lib/format";
import { vinmonopoletImage } from "@/lib/vinmonopolet";
import { PoletLink, PrizeDialog, PrizeThumb, type PrizeView } from "./PrizeViewer";
import { NAME_DISPLAY_MAX, gridLabel } from "@/lib/format";
import { weekdayTime } from "@/lib/datetime";
import Grid, { Crown, type GridCell } from "./Grid";
import VippsCard from "./VippsCard";
import { PickYourPrize, WishList } from "./WishList";
import RulesButton from "./RulesButton";
import Countdown, { formatLeft, useNow } from "@/components/Countdown";
import { SeasonDrift, SeasonGreeting } from "./SeasonDecor";
import { resolveSeason } from "@/lib/season";

interface LocalHold {
  cellId: number;
  row: number;
  col: number;
  name: string;
}

const holdsKey = (roundId: number) => `vl_holds_${roundId}`;

function readLocalHolds(roundId: number): LocalHold[] {
  try {
    const arr = JSON.parse(localStorage.getItem(holdsKey(roundId)) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeLocalHolds(roundId: number, holds: LocalHold[]) {
  try {
    localStorage.setItem(holdsKey(roundId), JSON.stringify(holds));
  } catch {
    /* ignore */
  }
}

type Step = "form" | "reserved" | "pay";

export default function RoundView({ roundId, initial }: { roundId: number; initial: RoundState }) {
  const { state, refresh, connected } = useRoundState(roundId, initial);
  const now = useNow();
  const { round, prizes, cells, draws, money, salesOpen, restrictionActive, vipps } = state;

  const [holds, setHolds] = useState<LocalHold[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prizeView, setPrizeView] = useState<PrizeView | null>(null);
  const [step, setStep] = useState<Step>("form");
  const [picked, setPicked] = useState<{ row: number; col: number } | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "ok" | "info" } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    setHolds(readLocalHolds(roundId));
    try {
      setName(localStorage.getItem("vl_name") || "");
    } catch {
      /* ignore */
    }
  }, [roundId]);

  // Reconcile local holds against server truth. `mine` comes from the vl_holds cookie,
  // which can lag a refresh behind a fresh reservation (an SSE "update" can reach us
  // before the hold POST's Set-Cookie is stored), so only drop a hold when the server
  // actively contradicts it — not merely when `mine` hasn't caught up yet.
  useEffect(() => {
    const byKey = new Map(cells.map((c) => [`${c.row},${c.col}`, c] as [string, PublicCell]));
    const sameName = (a: string, b: string) =>
      a.trim().toLowerCase() === b.trim().toLowerCase();
    setHolds((prev) => {
      const next = prev.filter((h) => {
        const c = byKey.get(`${h.row},${h.col}`);
        if (!c) return true; // not in the grid (yet) — keep
        if (c.status === "available") return false; // hold expired or was released
        if (c.status === "sold") return false; // confirmed (here or on another device)
        // still 'held' — keep unless it's clearly someone else's reservation
        return c.mine || !c.name || sameName(c.name, h.name);
      });
      if (next.length !== prev.length) writeLocalHolds(roundId, next);
      return next;
    });
  }, [cells, roundId]);

  // Keep the native dialog in step with state. The name field is focused explicitly: React
  // never writes the autofocus attribute, so showModal() would land on the close button.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (dialogOpen && !d.open) {
      d.showModal();
      d.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    } else if (!dialogOpen && d.open) d.close();
  }, [dialogOpen]);

  const flash = useCallback((msg: string, tone: "ok" | "info" = "ok") => {
    setToast({ msg, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  const wins = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of draws) {
      if (!d.row || !d.col || !d.winnerName) continue;
      const key = `${d.row},${d.col}`;
      const existing = m.get(key);
      if (existing === undefined || d.rank < existing) m.set(key, d.rank);
    }
    return m;
  }, [draws]);

  const gridCells: GridCell[] = useMemo(
    () =>
      cells.map((c: PublicCell) => ({
        row: c.row,
        col: c.col,
        status: c.status,
        label: gridLabel(c.name),
        mine: c.mine,
      })),
    [cells],
  );

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/rounds/${roundId}/cells`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || "Noe gikk galt.");
      return data;
    },
    [roundId],
  );

  const maxPer = round.max_per_person;
  const hasName = name.trim().length >= 2;
  const canAddMore =
    salesOpen && (maxPer <= 0 || !restrictionActive || holds.length < maxPer);

  function rememberName() {
    try {
      localStorage.setItem("vl_name", name.trim());
    } catch {
      /* ignore */
    }
  }

  async function doHold(row: number, col: number): Promise<LocalHold> {
    const data = await post({ action: "hold", row, col, name });
    const hold: LocalHold = { cellId: data.cellId, row, col, name: name.trim() };
    setHolds((prev) => {
      const next = [...prev, hold];
      writeLocalHolds(roundId, next);
      return next;
    });
    rememberName();
    return hold;
  }

  async function openBuy(cell: GridCell) {
    if (!salesOpen || cell.status !== "available") return;
    setError(null);
    // Second and later squares: name is known -> reserve straight away.
    if (holds.length > 0 && hasName) {
      setBusy(true);
      try {
        await doHold(cell.row, cell.col);
        setStep("reserved");
        setDialogOpen(true);
        refresh();
      } catch (e) {
        flash((e as Error).message);
      } finally {
        setBusy(false);
      }
      return;
    }
    setPicked({ row: cell.row, col: cell.col });
    setStep("form");
    setDialogOpen(true);
  }

  async function submitForm() {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await doHold(picked.row, picked.col);
      setPicked(null);
      setStep("reserved");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function addAnother() {
    setDialogOpen(false);
    setPicked(null);
    setStep("form");
    flash("Velg en ledig rute til i rutenettet");
  }

  async function confirmAll() {
    if (!holds.length) return;
    setBusy(true);
    setError(null);
    try {
      for (const h of holds) {
        await post({ action: "confirm", cellId: h.cellId });
      }
      setHolds([]);
      writeLocalHolds(roundId, []);
      setDialogOpen(false);
      flash(
        holds.length > 1
          ? `${holds.length} lodd registrert! Lykke til 🍀`
          : "Registrert! Lykke til 🍀",
      );
      refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function release(hold: LocalHold) {
    setBusy(true);
    try {
      await post({ action: "release", cellId: hold.cellId });
      setHolds((prev) => {
        const next = prev.filter((h) => h.cellId !== hold.cellId);
        writeLocalHolds(roundId, next);
        if (!next.length) setDialogOpen(false);
        return next;
      });
      refresh();
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  }

  const soldCount = money.sold;
  const totalCells = round.grid_size * round.grid_size;
  const closeAt = round.sales_close_at;
  const overtime = !!closeAt && new Date(closeAt).getTime() <= now;
  const liftAt = round.restriction_lifts_at;
  const anyWinner = draws.some((d) => d.winnerName);
  const finished = round.status === "drawn" || round.status === "settled";
  const remainingPrizes = prizes.filter((p) => !draws.some((d) => d.prizeId === p.id));
  // Your squares still in the draw; their wishes are saved together, so the first one speaks for all.
  const myOpen = cells.filter(
    (c) =>
      c.mine &&
      (c.status === "sold" || c.status === "held") &&
      !draws.some((d) => d.winnerName && d.row === c.row && d.col === c.col),
  );
  const showWishes = myOpen.length > 0 && prizes.length > 1 && !finished;
  // You won while away and the organiser skipped you: you pick yourself.
  const mySkipped = draws.find(
    (d) => d.skipped && cells.some((c) => c.mine && c.row === d.row && c.col === d.col),
  );
  // Only the viewer's own squares count here; others just get a quiet reminder line.
  const myUnpaid = cells.filter((c) => c.mine && c.status === "sold" && !c.paid).length;

  // Why a free square can't be picked right now; null once the draw is done (nothing to wait for).
  const lockedMessage = salesOpen
    ? null
    : round.status === "draft"
      ? "Runden er ikke åpnet ennå – du kan velge rute når salget starter."
      : round.status === "closed"
        ? "Loddsalget er stengt – trekningen kommer snart."
        : null;

  const season = resolveSeason(round.theme, round.sales_close_at, new Date(state.now));

  return (
    <div className="space-y-6" data-season={season ?? undefined}>
      {season && <SeasonDrift season={season} />}
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-wine">
            {round.title || "Vinlotteri"}
            {season && <SeasonGreeting season={season} />}
          </h1>
          <p className="text-sm text-plum/60">
            {salesOpen ? (
              <>
                {soldCount} av {totalCells} lodd solgt
                {closeAt &&
                  (overtime ? (
                    <Overtime since={closeAt} now={now} />
                  ) : (
                    <ClosesIn target={closeAt} now={now} />
                  ))}
              </>
            ) : round.status === "drawn" || round.status === "settled" ? (
              "Trekningen er gjennomført"
            ) : round.status === "closed" ? (
              "Loddsalget er stengt"
            ) : (
              "Runden er ikke åpnet ennå"
            )}
          </p>
        </div>
        <RulesButton connected={connected}>
          <ul className="mt-3 space-y-2 text-sm leading-snug text-plum/75 [&>li]:relative [&>li]:pl-4 [&>li]:before:absolute [&>li]:before:left-0 [&>li]:before:top-[0.5em] [&>li]:before:h-1.5 [&>li]:before:w-1.5 [&>li]:before:rounded-full [&>li]:before:bg-wine/40">
            <li>Kr {round.ticket_price},- per lodd.</li>
            {round.max_per_person > 0 && (
              <li>
                Maks {round.max_per_person} lodd per person
                {liftAt ? (
                  <>
                    {" "}
                    {restrictionActive
                      ? `(oppheves ${weekdayTime(liftAt)})`
                      : "(grensen er opphevet)"}
                  </>
                ) : (
                  ""
                )}
                .
              </li>
            )}
            {closeAt && (
              <li>
                Salg stenger{" "}
                {new Date(closeAt).toLocaleString("nb-NO", { dateStyle: "short", timeStyle: "short" })}.
              </li>
            )}
            <li>Velg en ledig rute, skriv navnet ditt, og betal med Vipps.</li>
            <li>
              Trekning: {round.draw_mode === "digital" ? "digitalt i appen" : "fysisk terningkast"} (tom
              rute = kast på nytt).
            </li>
            <li>
              Vinnerne velger premie i trekkerekkefølge. Kan du ikke være der, legg inn en ønskeliste – ellers velger du
              blant det som er igjen når du kommer tilbake.
            </li>
          </ul>
        </RulesButton>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {mySkipped && round.status === "closed" && (
            <PickYourPrize
              rank={mySkipped.rank}
              prizes={remainingPrizes}
              onChoose={async (prizeId) => {
                await post({ action: "choose", prizeId });
                refresh();
              }}
            />
          )}

          {/* Grid */}
          <section>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-plum/60">
              {salesOpen ? "Velg en ledig rute" : "Rutenett"}
            </h2>
            <Grid
              size={round.grid_size}
              cells={gridCells}
              onCellClick={salesOpen ? openBuy : undefined}
              onLockedClick={lockedMessage ? () => flash(lockedMessage, "info") : undefined}
              wins={wins}
            />
            <p className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-plum/60">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] border border-plum/20 bg-white" /> ledig</span>
              <span className="inline-flex items-center gap-1.5"><span className="cell-held h-3 w-3 rounded-[3px] border border-gold/70" /> reservert</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-wine" /> solgt</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] border-2 border-gold bg-gold-soft" /> vinner</span>
              <span className="inline-flex items-center gap-1.5"><Crown className="h-2.5 w-3.5 text-wine" /> 1. premie</span>
            </p>
          </section>

          {/* Pending holds */}
          {holds.length > 0 && (
            <section className="rounded-xl border border-gold bg-gold-soft/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-display text-lg font-semibold text-plum">
                    {holds.length} rute{holds.length > 1 ? "r" : ""} reservert for deg
                  </h2>
                  <p className="text-sm text-plum/60">
                    {holds.map((h) => `${h.col}-${h.row}`).join(", ")} · {holds[0].name}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setStep("pay");
                    setDialogOpen(true);
                  }}
                  className="rounded-full bg-wine px-4 py-2 text-sm font-semibold text-cream"
                >
                  Betal Kr {round.ticket_price * holds.length},-
                </button>
              </div>
              <ul className="mt-3 space-y-1 text-sm">
                {holds.map((h) => (
                  <li key={h.cellId} className="flex items-center justify-between gap-2">
                    <span>Rute {h.col}-{h.row}</span>
                    {salesOpen && (
                      <button
                        onClick={() => release(h)}
                        disabled={busy}
                        className="rounded-full border border-plum/20 px-3 py-0.5 text-xs text-plum/60"
                      >
                        Angre
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {canAddMore && (
                <button onClick={addAnother} className="mt-2 text-sm font-medium text-wine underline">
                  + Legg til en rute til
                </button>
              )}
            </section>
          )}

          {showWishes && (
            <WishList
              prizes={prizes}
              saved={myOpen[0].wishes ?? []}
              onSave={async (prizeIds) => {
                await post({ action: "wishes", prizeIds });
              }}
            />
          )}
        </div>

        {/* Prizes (winners once drawn) + payment */}
        <aside className="grid content-start gap-6 md:grid-cols-2 lg:grid-cols-1">
          <div>
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-plum/60">
              {anyWinner ? "Vinnere" : "Premier"}
            </h2>
            <ul className="divide-y divide-plum/10 rounded-xl border border-plum/10 bg-white shadow-sm">
              {anyWinner &&
                draws.map((d) => {
                  const prize = d.prizeId ? prizes.find((p) => p.id === d.prizeId) : undefined;
                  const img = d.prizeImage || (prize && (prize.image_url || vinmonopoletImage(prize.varenummer)));
                  const prizeName = d.prizeName || prize?.name || "Premie";
                  const varenummer = prize?.varenummer ?? null;
                  return (
                    <li key={`d${d.rank}`} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-5 shrink-0 text-center font-display text-xl font-semibold lining-nums text-wine">
                        {d.rank}
                      </span>
                      {img ? (
                        <PrizeThumb
                          className="h-14 w-10"
                          onOpen={setPrizeView}
                          view={{
                            img,
                            name: prizeName,
                            category: prize?.category ?? null,
                            meta: prizeMeta(prize),
                            varenummer,
                          }}
                        />
                      ) : (
                        <div className="h-14 w-10 shrink-0" />
                      )}
                      <div className="min-w-0">
                        {d.winnerName ? (
                          <p className="leading-tight">
                            <span className="font-semibold text-plum">{d.winnerName}</span>{" "}
                            <span className="text-xs lining-nums tabular-nums text-plum/60">
                              rute {d.col}-{d.row}
                            </span>
                          </p>
                        ) : d.pending ? (
                          <p className="text-plum/60 motion-safe:animate-pulse">venter…</p>
                        ) : (
                          <p className="text-plum/60">ingen vinner</p>
                        )}
                        {d.winnerName && (
                          <p className="text-sm leading-tight text-plum/60">
                            {d.prizeId ? d.prizeName || prize?.name || "premie" : d.skipped ? "ikke til stede – velger senere" : "velger premie …"}
                          </p>
                        )}
                        {prize && (prize.volume || prize.price != null) && (
                          <p className="text-xs text-plum/60">
                            {[prize.volume, prize.price != null ? `Kr ${formatPrice(prize.price)}` : null]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </div>
                      {d.prizeId && <PoletLink varenummer={varenummer} name={prizeName} />}
                    </li>
                  );
                })}
              {anyWinner && remainingPrizes.length > 0 && (
                <li className="bg-cream/60 px-3 py-1.5 text-xs font-medium text-plum/60">Igjen å velge</li>
              )}
              {(anyWinner ? remainingPrizes : prizes).map((p) => {
                const img = p.image_url || vinmonopoletImage(p.varenummer);
                const prizeName = p.name || `Varenr. ${p.varenummer ?? "?"}`;
                return (
                  <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                    {img ? (
                      <PrizeThumb
                        className="h-16 w-12"
                        onOpen={setPrizeView}
                        view={{ img, name: prizeName, category: p.category, meta: prizeMeta(p), varenummer: p.varenummer }}
                      />
                    ) : (
                      <div className="flex h-16 w-12 shrink-0 items-center justify-center">
                        <span className="text-3xl">🍾</span>
                      </div>
                    )}
                    <div className="min-w-0">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-wine">
                        {p.category || "Premie"}
                      </span>
                      <p className="text-sm font-medium leading-tight text-plum">{prizeName}</p>
                      <p className="text-xs text-plum/60">{prizeMeta(p)}</p>
                    </div>
                    <PoletLink varenummer={p.varenummer} name={prizeName} />
                  </li>
                );
              })}
              {!prizes.length && !anyWinner && (
                <li className="px-3 py-4 text-sm text-plum/60">Premiene legges ut snart.</li>
              )}
            </ul>
          </div>

          <div className="space-y-2">
            {!finished ? (
              <>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-plum/60">Betaling</h2>
                {vipps && (
                  <VippsCard vipps={vipps} organizer={round.organizer_name} ticketPrice={round.ticket_price} />
                )}
              </>
            ) : round.status === "drawn" && myUnpaid > 0 && vipps ? (
              <>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-plum/60">Betaling</h2>
                <p className="text-sm text-plum/70">
                  Du har {myUnpaid} ubetalt{myUnpaid > 1 ? "e" : ""} lodd ·{" "}
                  <strong className="font-semibold text-plum">Kr {myUnpaid * round.ticket_price},-</strong>
                </p>
                <VippsCard vipps={vipps} organizer={round.organizer_name} ticketPrice={round.ticket_price} compact />
              </>
            ) : round.status === "drawn" && money.unpaidCount > 0 && vipps?.number ? (
              <p className="text-sm text-plum/60">
                Ikke betalt ennå? Vipps Kr {round.ticket_price},- per lodd til {round.organizer_name || "arrangør"},{" "}
                <span className="whitespace-nowrap lining-nums tabular-nums text-plum/70">
                  {vipps.number.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3")}
                </span>
                .
              </p>
            ) : null}
            {round.notes && (
              <p className="whitespace-pre-wrap rounded-lg bg-gold-soft/30 px-3 py-2 text-sm text-plum/70">
                {round.notes}
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Buy dialog */}
      <PrizeDialog view={prizeView} onClose={() => setPrizeView(null)} />

      {/* Native <dialog>: focus trap, Esc and an inert page come for free. Bottom sheet on phones. */}
      <dialog
        ref={dialogRef}
        aria-labelledby="kjop-tittel"
        onCancel={(e) => busy && e.preventDefault()}
        onClose={() => setDialogOpen(false)}
        onClick={(e) => e.target === dialogRef.current && !busy && setDialogOpen(false)}
        className="mx-auto mb-4 mt-auto w-[calc(100%-2rem)] max-w-md animate-pop rounded-2xl bg-cream p-0 text-plum shadow-[0_20px_50px_-12px_rgba(44,10,20,0.45)] sm:my-auto"
      >
        {dialogOpen && (
          <div className="p-5">
            {step === "form" && picked && (
              <>
                <div className="flex items-center justify-between">
                  <h3 id="kjop-tittel" className="font-display text-xl font-semibold text-wine">
                    Rute {picked.col}-{picked.row}
                  </h3>
                  <CloseButton onClick={() => setDialogOpen(false)} />
                </div>
                <div className="mt-4 space-y-3">
                  <label className="block text-sm">
                    <span className="flex items-baseline justify-between text-plum/70">
                      <span>Navn eller initialer</span>
                      <span className={name.length >= NAME_DISPLAY_MAX ? "text-wine" : "text-plum/60"}>
                        {name.length}/{NAME_DISPLAY_MAX}
                      </span>
                    </span>
                    <input
                      data-autofocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      maxLength={NAME_DISPLAY_MAX}
                      className="mt-1 w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base"
                      placeholder="F.eks. Ola N"
                    />
                    <span className="text-xs text-plum/60">
                      Kort navn eller initialer.
                    </span>
                  </label>
                  {error && <p className="text-sm text-wine">{error}</p>}
                  <button
                    onClick={submitForm}
                    disabled={busy || !hasName}
                    className="w-full rounded-lg bg-wine py-2.5 font-semibold text-cream disabled:opacity-50"
                  >
                    {busy ? "Reserverer…" : "Reserver ruten"}
                  </button>
                  <p className="text-center text-xs text-plum/60">Ruten er reservert for deg til du betaler.</p>
                </div>
              </>
            )}

            {step === "reserved" && (
              <>
                <h3 id="kjop-tittel" className="font-display text-xl font-semibold text-wine">Rute reservert ✓</h3>
                <p className="mt-1 text-sm text-plum/70">
                  Dine ruter: <strong>{holds.map((h) => `${h.col}-${h.row}`).join(", ")}</strong>
                </p>
                <p className="text-sm text-plum/60">
                  {holds.length} lodd · Kr {round.ticket_price * holds.length},- til slutt
                </p>

                <div className="mt-4 space-y-2">
                  {canAddMore && (
                    <button
                      onClick={addAnother}
                      className="w-full rounded-lg border-2 border-wine bg-white py-2.5 font-semibold text-wine"
                    >
                      + Legg til en rute til
                    </button>
                  )}
                  <button
                    onClick={() => setStep("pay")}
                    className="w-full rounded-lg bg-wine py-2.5 font-semibold text-cream"
                  >
                    Gå til betaling{holds.length > 1 ? ` (Kr ${round.ticket_price * holds.length},-)` : ""}
                  </button>
                  {!canAddMore && maxPer > 0 && restrictionActive && (
                    <p className="text-center text-xs text-plum/60">
                      Maks {maxPer} lodd per person nå.
                    </p>
                  )}
                </div>
              </>
            )}

            {step === "pay" && (
              <>
                <div className="flex items-center justify-between">
                  <h3 id="kjop-tittel" className="font-display text-xl font-semibold text-wine">Betal</h3>
                  <CloseButton onClick={() => setDialogOpen(false)} />
                </div>
                <p className="mt-2 text-sm text-plum/70">
                  {holds.length} lodd ({holds.map((h) => `${h.col}-${h.row}`).join(", ")}) ·{" "}
                  <strong>Kr {round.ticket_price * holds.length},-</strong> med Vipps, så trykker du «Jeg
                  har betalt».
                </p>
                {vipps && (
                  <div className="mt-3">
                    <VippsCard
                      vipps={vipps}
                      organizer={round.organizer_name}
                      ticketPrice={round.ticket_price}
                      compact
                    />
                  </div>
                )}
                {error && <p className="mt-2 text-sm text-wine">{error}</p>}
                <button
                  onClick={confirmAll}
                  disabled={busy || !holds.length}
                  className="mt-3 w-full rounded-lg bg-wine py-2.5 font-semibold text-cream disabled:opacity-50"
                >
                  {busy ? "Sender…" : `Jeg har betalt Kr ${round.ticket_price * holds.length},-`}
                </button>
                {canAddMore && (
                  <button onClick={addAnother} className="mt-2 w-full py-1 text-sm text-wine underline">
                    + Legg til en rute til
                  </button>
                )}
                <button
                  onClick={() => setDialogOpen(false)}
                  className="mt-1 w-full rounded-lg border border-plum/20 py-2 text-sm text-plum/60"
                >
                  Lukk (rutene beholdes)
                </button>
              </>
            )}
          </div>
        )}
      </dialog>

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-1/2 z-50 w-max max-w-[calc(100vw-2rem)] -translate-x-1/2 animate-pop rounded-2xl px-5 py-2 text-center text-sm font-medium shadow-lg ${
            toast.tone === "info" ? "bg-plum text-cream" : "bg-sage text-white"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function prizeMeta(p: Prize | undefined): string {
  if (!p) return "";
  return [p.volume, p.price != null ? `Kr ${formatPrice(p.price)}` : null].filter(Boolean).join(" · ");
}

/**
 * "stenger om …" in the header line. Plain text until the last hour; then it becomes a wine
 * chip with a clock and ticking m:ss, filled solid for the last ten minutes.
 */
function ClosesIn({ target, now }: { target: string; now: number }) {
  const left = new Date(target).getTime() - now;
  if (left > 3_600_000) {
    return (
      <>
        {" · stenger om "}
        <Countdown target={target} now={now} />
      </>
    );
  }
  const urgent = left <= 600_000;
  return (
    <>
      <span className="max-sm:hidden"> · </span>
      <span
        className={`inline-flex items-center max-sm:mt-1.5 max-sm:flex max-sm:w-fit gap-1 whitespace-nowrap rounded-full px-2 py-0.5 align-[-0.1em] font-semibold lining-nums tabular-nums transition-colors duration-500 motion-safe:animate-pop ${
          urgent ? "bg-wine text-cream" : "bg-wine/10 text-wine"
        }`}
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="10" cy="10.5" r="6.5" />
          <path d="M10 7.5v3l2 1.5M7.5 2.5h5" />
        </svg>
        stenger om <Countdown target={target} now={now} />
      </span>
    </>
  );
}

// Past closing time but the organiser hasn't closed yet: stoppage time, counting up.
function Overtime({ since, now }: { since: string; now: number }) {
  const over = now - new Date(since).getTime();
  return (
    <>
      <span className="max-sm:hidden"> · </span>
      <span className="overtime-pill inline-flex items-center max-sm:mt-1.5 max-sm:flex max-sm:w-fit gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 align-[-0.1em] font-semibold text-wine-dark motion-safe:animate-pop">
        <svg viewBox="0 0 20 20" aria-hidden="true" className="overtime-glass h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M5.5 2.5h9M5.5 17.5h9M6.5 2.5c0 4 3.5 5 3.5 7.5S6.5 13.5 6.5 17.5M13.5 2.5c0 4-3.5 5-3.5 7.5s3.5 3.5 3.5 7.5" />
          <path d="M8 16.5c.5-1.6 1.2-2.4 2-2.4s1.5.8 2 2.4z" fill="currentColor" stroke="none" />
        </svg>
        Overtid
        <span className="lining-nums tabular-nums text-wine">+{formatLeft(over)}</span>
      </span>
      <span className="max-sm:mt-1 max-sm:block"> <span className="max-sm:hidden">– </span>fort deg før salget stenger</span>
    </>
  );
}

function CloseButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Lukk"
      className="-my-2 -mr-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-plum/60 transition-colors hover:bg-plum/5 hover:text-plum"
    >
      <svg viewBox="0 0 20 20" aria-hidden="true" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        <path d="m5.5 5.5 9 9m0-9-9 9" />
      </svg>
    </button>
  );
}

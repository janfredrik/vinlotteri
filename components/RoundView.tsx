"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Prize, PublicCell, RoundState } from "@/lib/types";
import type { RoundLink } from "@/lib/repo";
import { useRoundState } from "@/lib/useRoundState";
import { formatPrice } from "@/lib/format";
import { vinmonopoletImage } from "@/lib/vinmonopolet";
import { PoletLink, PrizeDialog, PrizeThumb, type PrizeView } from "./PrizeViewer";
import { NAME_DISPLAY_MAX, gridLabel, normName } from "@/lib/format";
import { ME_EVENT, chooseMe, useMe } from "@/lib/me";
import { weekdayTime } from "@/lib/datetime";
import Grid, { Crown, type GridCell } from "./Grid";
import VippsCard from "./VippsCard";
import { YouChip } from "./MeSquare";
import { celebrateFrom, crownFrom } from "./Cheers";
import { PickYourPrize, WishList } from "./WishList";
import RulesButton from "./RulesButton";
import Countdown, { formatLeft, useNow } from "@/components/Countdown";
import { SeasonDrift, SeasonGreeting } from "./SeasonDecor";
import { resolveSeason } from "@/lib/season";
import Receipt from "./Receipt";
import { type LocalHold, readLocalHolds, reconcileHolds, writeLocalHolds } from "@/lib/localHolds";

type Step = "form" | "reserved" | "pay";

/** A failed call to the cells API, with the HTTP status (0 = no contact) so callers can tell why. */
class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

// Names you bought for without switching profile: don't offer the switch again for them.
const SKIP_KEY = "vl_me_skip";

function readSkips(): string[] {
  try {
    const arr = JSON.parse(localStorage.getItem(SKIP_KEY) || "[]");
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function addSkip(norm: string) {
  try {
    localStorage.setItem(SKIP_KEY, JSON.stringify([...new Set([...readSkips(), norm])].slice(-30)));
  } catch {
    /* ignore */
  }
}

export default function RoundView({
  roundId,
  initial,
  initialMe,
  neighbours,
}: {
  roundId: number;
  initial: RoundState;
  initialMe: string | null;
  neighbours: { prev: RoundLink | null; next: RoundLink | null };
}) {
  const { state, refresh, connected } = useRoundState(roundId, initial);
  const me = useMe(initialMe);
  // Bought in another name than your profile: offer to switch (once per name).
  const [switchOffer, setSwitchOffer] = useState<string | null>(null);
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

  // A new profile changes which squares are yours.
  useEffect(() => {
    window.addEventListener(ME_EVENT, refresh);
    return () => window.removeEventListener(ME_EVENT, refresh);
  }, [refresh]);

  // Reconcile local holds against server truth (see reconcileHolds for why `mine` alone isn't enough).
  useEffect(() => {
    setHolds((prev) => {
      const next = reconcileHolds(prev, cells);
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

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const flash = useCallback((msg: string, tone: "ok" | "info" = "ok") => {
    setToast({ msg, tone });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // Long messages stay up long enough to be read.
    toastTimer.current = setTimeout(() => setToast(null), Math.max(4000, msg.length * 70));
  }, []);

  // Every reservation gone (paid elsewhere, or freed by the organiser) while the dialog lists
  // them: close it rather than show "0 lodd", and keep any message as a toast.
  useEffect(() => {
    if (!dialogOpen || step === "form" || holds.length || busy) return;
    setDialogOpen(false);
    if (error) {
      flash(error, "info");
      setError(null);
    }
  }, [dialogOpen, step, holds.length, busy, error, flash]);

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
      let r: Response;
      try {
        r = await fetch(`/api/rounds/${roundId}/cells`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        throw new ApiError("Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.", 0);
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg =
          r.status === 401
            ? "Tilgangen har gått ut. Last siden på nytt og skriv inn PIN-en."
            : data.error || (r.status >= 500 ? "Serveren fikk en feil. Prøv igjen om litt." : "Noe gikk galt.");
        throw new ApiError(msg, r.status);
      }
      return data;
    },
    [roundId],
  );

  // The square in the open form was taken (or sales closed) while you were typing.
  const pickedCell = picked ? cells.find((c) => c.row === picked.row && c.col === picked.col) : undefined;
  const pickedGone =
    !busy && step === "form" && !!picked && (!salesOpen || (!!pickedCell && pickedCell.status !== "available"));

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
    adoptName(hold.name);
    return hold;
  }

  /** Your first purchase gives you a profile. Buying in someone else's name only offers a switch. */
  function adoptName(bought: string) {
    if (me === undefined) return;
    const norm = normName(bought);
    if (!me) {
      chooseMe(bought)
        .then(() => flash(`Du er ${bought} på denne enheten.`))
        .catch(() => {});
    } else if (normName(me) !== norm && !readSkips().includes(norm)) {
      addSkip(norm);
      setSwitchOffer(bought);
    } else if (normName(me) === norm) {
      setSwitchOffer(null);
    }
  }

  async function acceptSwitch() {
    if (!switchOffer) return;
    const name = switchOffer;
    setSwitchOffer(null);
    try {
      await chooseMe(name);
      flash(`Du er ${name} på denne enheten.`);
    } catch (e) {
      flash((e as Error).message, "info");
    }
  }

  async function openBuy(cell: GridCell) {
    // One reservation at a time: a quick second tap shouldn't start a parallel hold.
    if (!salesOpen || cell.status !== "available" || busy) return;
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
        flash((e as Error).message, "info");
        refresh();
      } finally {
        setBusy(false);
      }
      return;
    }
    // Logged in: you buy as yourself unless you type something else.
    if (me) setName(me.slice(0, NAME_DISPLAY_MAX));
    setPicked({ row: cell.row, col: cell.col });
    setStep("form");
    setDialogOpen(true);
  }

  async function submitForm() {
    if (!picked || busy || !hasName || pickedGone) return;
    setBusy(true);
    setError(null);
    try {
      await doHold(picked.row, picked.col);
      setPicked(null);
      setStep("reserved");
      refresh();
    } catch (e) {
      setError((e as Error).message);
      refresh();
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
    // Each square on its own: one the organiser freed mustn't block paying for the rest. A refused
    // square stays in your list; reconciliation lets go of it once the server shows it isn't yours.
    const done: number[] = [];
    const refused: { hold: LocalHold; message: string }[] = [];
    let failure: string | null = null;
    for (const h of holds) {
      try {
        await post({ action: "confirm", cellId: h.cellId });
        done.push(h.cellId);
      } catch (e) {
        const status = e instanceof ApiError ? e.status : 0;
        const c = cells.find((x) => x.row === h.row && x.col === h.col);
        if (status === 409 && c?.status === "sold") done.push(h.cellId); // registered on another device
        else if (status === 409) refused.push({ hold: h, message: (e as Error).message });
        else {
          // No contact, PIN expired or a server error: the rest would fail the same way.
          failure = (e as Error).message;
          break;
        }
      }
    }
    const left = holds.filter((h) => !done.includes(h.cellId));
    setHolds(left);
    writeLocalHolds(roundId, left);
    refresh();
    setBusy(false);
    if (!failure && !refused.length) {
      setDialogOpen(false);
      flash(done.length > 1 ? `${done.length} lodd registrert! Lykke til 🍀` : "Registrert! Lykke til 🍀");
      return;
    }
    const prefix = done.length ? `${done.length} av ${holds.length} lodd er registrert. ` : "";
    if (failure) setError(prefix + failure);
    else {
      const which = refused.map((r) => `${r.hold.col}-${r.hold.row}`).join(", ");
      setError(`${prefix}${refused.length > 1 ? "Rutene" : "Rute"} ${which} ble ikke registrert: ${refused[0].message}`);
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
    } catch (e) {
      flash((e as Error).message, "info");
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
  // Your own wins this round. With a profile, only wins in your name: squares bought on this
  // device for someone else (or as another profile) are theirs to celebrate. Without one, the
  // squares bought on this device.
  const myWins = draws.filter(
    (d) =>
      d.winnerName &&
      d.row &&
      d.col &&
      (me
        ? normName(d.winnerName) === normName(me)
        : cells.some((c) => c.mine && c.row === d.row && c.col === d.col)),
  );
  const myWinKey = myWins.map((d) => `${d.rank}:${d.col}-${d.row}`).join(",");
  const bestWin = myWins.length ? myWins.reduce((a, b) => (b.rank < a.rank ? b : a)) : null;

  // 1. premie gets the crown; every other win gets the bubbles.
  const cheer = useCallback((col: number, row: number, rank: number) => {
    const el = document.querySelector<HTMLElement>(`[data-cell="${col}-${row}"]`);
    if (el) (rank === 1 ? crownFrom : celebrateFrom)(el);
  }, []);

  // Skål! Each of your wins is celebrated once per device: when you open the round, or live
  // as it's drawn. Marked as seen only when it actually plays (so a hidden tab waits for you).
  useEffect(() => {
    if (!myWinKey) return;
    const key = `vl_skaal_${roundId}`;
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {
      /* ignore */
    }
    const fresh = myWinKey
      .split(",")
      .filter((k) => !seen.includes(k))
      .sort((a, b) => parseInt(a) - parseInt(b));
    if (!fresh.length) return;
    const rank = parseInt(fresh[0]);
    const [col, row] = fresh[0].split(":")[1].split("-").map(Number);
    let timer: ReturnType<typeof setTimeout> | undefined;
    const go = () => {
      timer = setTimeout(() => {
        try {
          localStorage.setItem(key, JSON.stringify([...seen, ...fresh]));
        } catch {
          /* ignore */
        }
        cheer(col, row, rank);
      }, 450);
    };
    const onShow = () => {
      if (document.hidden) return;
      document.removeEventListener("visibilitychange", onShow);
      go();
    };
    if (document.hidden) document.addEventListener("visibilitychange", onShow);
    else go();
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onShow);
    };
  }, [myWinKey, roundId, cheer]);

  // Your squares still in the draw; their wishes are saved together, so the first one speaks for all.
  // With a profile, only the squares in your name: the ones you bought for others keep their own wishes.
  const myOpen = cells.filter(
    (c) =>
      c.mine &&
      (!me || (!!c.name && normName(c.name) === normName(me))) &&
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
          <RoundStepper current={round.title} {...neighbours} />
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
              Vinnerne velger premie i trekkerekkefølge. Legg inn ønskeliste etter du har kjøpt om du ikke kan delta.
            </li>
          </ul>
        </RulesButton>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="min-w-0 space-y-6">
          {mySkipped && round.status === "closed" && (
            <PickYourPrize
              rank={mySkipped.rank}
              winner={
                me && mySkipped.winnerName && normName(mySkipped.winnerName) !== normName(me)
                  ? mySkipped.winnerName
                  : null
              }
              prizes={remainingPrizes}
              onChoose={async (prizeId) => {
                await post({ action: "choose", prizeId });
                refresh();
              }}
            />
          )}

          {bestWin && (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-gold/60 bg-gold-soft/40 px-4 py-2.5">
              <p className="flex min-w-0 items-center gap-2 text-plum">
                {bestWin.rank === 1 && <Crown className="h-3 w-4 shrink-0 text-wine" />}
                <span>
                  <span className="font-display text-lg font-semibold text-wine">Hurra!</span> Du vant{" "}
                  {myWins
                    .map((d) => `${d.rank}.`)
                    .sort((a, b) => parseInt(a) - parseInt(b))
                    .join(" og ")}{" "}
                  premie.
                  {bestWin.rank === 1 && <span className="block text-sm text-plum/75">Du arrangerer neste runde.</span>}
                </span>
              </p>
              <button
                type="button"
                onClick={() => cheer(bestWin.col!, bestWin.row!, bestWin.rank)}
                className="shrink-0 rounded-full px-2 py-1 text-sm font-medium text-wine underline decoration-gold decoration-2 underline-offset-4 hover:decoration-wine motion-reduce:hidden"
              >
                {bestWin.rank === 1 ? "Kron meg igjen 👑" : "Mer bobler! 🥂"}
              </button>
            </div>
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
                <div className="min-w-0">
                  <h2 className="font-display text-lg font-semibold text-plum">
                    {holds.length} rute{holds.length > 1 ? "r" : ""} reservert for deg
                  </h2>
                  <p className="text-sm text-plum/60 [overflow-wrap:anywhere]">
                    {holds.map((h) => `${h.col}-${h.row}`).join(", ")} ·{" "}
                    {[...new Map(holds.map((h) => [normName(h.name), h.name])).values()].join(", ")}
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
                  const isMe = !!me && !!d.winnerName && normName(d.winnerName) === normName(me);
                  return (
                    <li
                      key={`d${d.rank}`}
                      className={`flex items-center gap-3 px-3 py-2.5 ${isMe ? "bg-gold-soft/40" : ""}`}
                    >
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
                          <p className="leading-tight [overflow-wrap:anywhere]">
                            <span className="font-semibold text-plum">{d.winnerName}</span>{" "}
                            {isMe && <YouChip />}{" "}
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
                      <p className="text-sm font-medium leading-tight text-plum [overflow-wrap:anywhere]">{prizeName}</p>
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
            {round.status === "settled" && (
              <section aria-labelledby="regnskap">
                <h2 id="regnskap" className="mb-2 text-sm font-semibold uppercase tracking-wide text-plum/60">
                  Regnskap
                </h2>
                <Receipt money={money} look="card" />
              </section>
            )}
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
              <p className="whitespace-pre-wrap rounded-lg bg-gold-soft/30 px-3 py-2 text-sm text-plum/70 [overflow-wrap:anywhere]">
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
                <form
                  className="mt-4 space-y-3"
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitForm();
                  }}
                >
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
                      autoComplete="off"
                      enterKeyHint="go"
                      aria-invalid={!!error || undefined}
                      aria-describedby={error ? "kjop-feil" : undefined}
                      className="mt-1 w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base"
                      placeholder="F.eks. Ola N"
                    />
                    <span className="text-xs text-plum/60">
                      Kort navn eller initialer.
                    </span>
                  </label>
                  {pickedGone ? (
                    <>
                      <p role="alert" className="text-sm font-medium text-wine">
                        {salesOpen
                          ? "Noen rakk å ta ruten før deg. Velg en annen ledig rute."
                          : "Loddsalget er stengt, så ruten kan ikke reserveres lenger."}
                      </p>
                      <button
                        type="button"
                        onClick={() => setDialogOpen(false)}
                        className="w-full rounded-lg bg-wine py-2.5 font-semibold text-cream"
                      >
                        {salesOpen ? "Velg en annen rute" : "Lukk"}
                      </button>
                    </>
                  ) : (
                    <>
                      {error && (
                        <p id="kjop-feil" role="alert" className="text-sm text-wine">
                          {error}
                        </p>
                      )}
                      <button
                        type="submit"
                        disabled={busy || !hasName}
                        className="w-full rounded-lg bg-wine py-2.5 font-semibold text-cream disabled:opacity-50"
                      >
                        {busy ? "Reserverer…" : "Reserver ruten"}
                      </button>
                      <p className="text-center text-xs text-plum/60">Ruten er reservert for deg til du betaler.</p>
                    </>
                  )}
                </form>
              </>
            )}

            {step === "reserved" && (
              <>
                <div className="flex items-center justify-between">
                  <h3 id="kjop-tittel" className="font-display text-xl font-semibold text-wine">Rute reservert ✓</h3>
                  <CloseButton onClick={() => setDialogOpen(false)} />
                </div>
                <p className="mt-1 text-sm text-plum/70">
                  Dine ruter: <strong>{holds.map((h) => `${h.col}-${h.row}`).join(", ")}</strong>
                </p>
                <p className="text-sm text-plum/60">
                  {holds.length} lodd · Kr {round.ticket_price * holds.length},- til slutt
                </p>
                {switchOffer && me && (
                  <p className="mt-3 text-sm text-plum/70">
                    Du er <span className="font-semibold text-plum">{me}</span> på denne enheten.{" "}
                    <button
                      type="button"
                      onClick={acceptSwitch}
                      className="font-medium text-wine underline underline-offset-4"
                    >
                      Bytt til {switchOffer}
                    </button>
                  </p>
                )}

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
                {error && (
                  <p role="alert" className="mt-2 text-sm text-wine">
                    {error}
                  </p>
                )}
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

      {/* The live region stays mounted: one that appears together with its text is often not read out. */}
      <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4">
        {toast && (
          <div
            key={toast.msg}
            className={`w-max max-w-full animate-pop rounded-2xl px-5 py-2 text-center text-sm font-medium shadow-lg ${
              toast.tone === "info" ? "bg-plum text-cream" : "bg-sage text-white"
            }`}
          >
            {toast.msg}
          </div>
        )}
      </div>
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

/** "Uke 36 – 2026" -> "Uke 36" when the neighbour is in the same year as the round on screen. */
function stepLabel(title: string, current: string): string {
  const year = (t: string) => t.match(/(\d{4})\s*$/)?.[1];
  return year(title) && year(title) === year(current) ? title.replace(/\s*[–-]\s*\d{4}\s*$/, "") : title;
}

function Chevron({ dir }: { dir: "left" | "right" }) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d={dir === "left" ? "M10 3.5 5.5 8 10 12.5" : "M6 3.5 10.5 8 6 12.5"} />
    </svg>
  );
}

/** Step to the week before or after, right above the round's title. */
function RoundStepper({ current, prev, next }: { current: string; prev: RoundLink | null; next: RoundLink | null }) {
  if (!prev && !next) return null;
  const link =
    "-mx-1.5 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium text-plum/60 transition-colors hover:bg-wine/5 hover:text-wine focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-wine";
  return (
    <nav aria-label="Andre runder" className="mb-0.5 flex items-center gap-4">
      {prev && (
        <Link href={`/runde/${prev.id}`} className={link} aria-label={`Forrige runde: ${prev.title}`}>
          <Chevron dir="left" />
          {stepLabel(prev.title || `Runde ${prev.id}`, current)}
        </Link>
      )}
      {next && (
        <Link href={`/runde/${next.id}`} className={link} aria-label={`Neste runde: ${next.title}`}>
          {stepLabel(next.title || `Runde ${next.id}`, current)}
          <Chevron dir="right" />
        </Link>
      )}
    </nav>
  );
}

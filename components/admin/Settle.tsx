"use client";

import { useState, type ReactNode } from "react";
import { roundAction } from "@/lib/adminApi";
import { kr } from "@/lib/format";
import type { AdminRoundState } from "@/lib/adminTypes";
import { prizeOfDraw, settleCheck, type Phase } from "@/lib/phases";
import { ConfirmButton, ErrorNote, IconAlert, IconCheck, btn, useAction } from "./ui";

export default function Settle({
  state,
  reload,
  goTo,
}: {
  state: AdminRoundState;
  reload: () => void;
  goTo: (p: Phase) => void;
}) {
  const { money, round, draws, prizes, cells } = state;
  const check = settleCheck(cells, prizes, draws);
  const settled = round.status === "settled";
  const winners = draws.filter((d) => d.winner_name).sort((a, b) => a.rank - b.rank);
  const [confirming, setConfirming] = useState(false);
  const { run, busy, error } = useAction();

  const settle = () =>
    run(async () => {
      await roundAction(round.id, { type: "status", status: "settled", force: check.needsForce });
      setConfirming(false);
      reload();
    });
  const unsettle = () =>
    run(async () => {
      await roundAction(round.id, { type: "status", status: "drawn" });
      reload();
    });

  const owing = check.unpaid + check.held;

  return (
    <div className="space-y-6">
      {!settled && (
        <ul className="space-y-2">
          <CheckItem ok={round.status !== "open" && round.status !== "draft"}>
            {round.status === "open" || round.status === "draft" ? "Salget er ikke stengt" : "Salget er stengt"}
          </CheckItem>
          <CheckItem
            ok={check.allDrawn}
            action={!check.allDrawn && <LinkButton onClick={() => goTo(check.prizes ? "trekk" : "forbered")}>{check.prizes ? "Til trekningen" : "Legg inn premier"}</LinkButton>}
          >
            {!check.prizes
              ? "Ingen premier lagt inn"
              : check.allDrawn
                ? `Alle ${check.prizes} premiene er trukket`
                : `${check.drawn} av ${check.prizes} premier har fått en vinner`}
          </CheckItem>
          <CheckItem
            ok={!owing}
            soft
            action={owing > 0 && <LinkButton onClick={() => goTo("selg")}>Til betalingene</LinkButton>}
          >
            {!owing ? "Alle lodd er betalt" : `${owing} lodd mangler betaling`}
          </CheckItem>
        </ul>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section aria-labelledby="regnskap" className="rounded-xl border border-plum/10 bg-white p-4 text-sm">
          <h3 id="regnskap" className="font-display text-lg font-semibold text-plum">Regnskapet</h3>
          <dl className="mt-2 tabular-nums">
            <Line label="Inn fra forrige runde" value={kr(money.carriedOver)} />
            <Line label={`Lodd solgt (${money.sold} × ${money.ticketPrice} kr)`} value={`+ ${kr(money.loddSolgt)}`} />
            <Line label={money.poletCostAuto ? "Kost på polet (sum premier)" : "Kost på polet"} value={`− ${kr(money.poletCost)}`} />
            <Line label="Går videre til neste runde" value={kr(money.videre)} total negative={money.videre < 0} />
          </dl>
          {check.unpaid > 0 && !settled && (
            <p className="mt-2 text-xs text-plum/80">{check.unpaid} solgte lodd er ikke markert betalt, men er regnet med.</p>
          )}
          {check.held > 0 && !settled && (
            <p className="mt-1 text-xs text-plum/80">{check.held} reserverte lodd er ikke regnet med før de er betalt.</p>
          )}
        </section>

        <section aria-labelledby="vinnere" className="rounded-xl border border-plum/10 bg-white p-4 text-sm">
          <h3 id="vinnere" className="font-display text-lg font-semibold text-plum">Vinnerne</h3>
          <ol className="mt-2 space-y-1.5">
            {winners.map((d) => (
              <li key={d.rank} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-plum/80">
                  {d.rank}. {prizeOfDraw(prizes, d)?.name || "velger premie"}
                </span>
                <span className="whitespace-nowrap font-semibold text-plum">
                  {d.winner_name} <span className="font-normal tabular-nums text-plum/70">{d.col}-{d.row}</span>
                </span>
              </li>
            ))}
            {!winners.length && <li className="text-plum/70">Ingen vinnere trukket ennå.</li>}
          </ol>
        </section>
      </div>

      {settled ? (
        <div className="rounded-xl bg-sage/10 px-5 py-4">
          <p className="flex items-center gap-2 font-display text-xl font-semibold text-sage">
            <IconCheck className="h-5 w-5" /> Gjort opp – {kr(money.videre)} går videre.
          </p>
          {!state.successor.id && (
            <div className="mt-2">
              <ConfirmButton
                question="Angre oppgjøret og låse opp runden?"
                confirmLabel="Ja, angre"
                onConfirm={unsettle}
              >
                Angre oppgjøret
              </ConfirmButton>
            </div>
          )}
        </div>
      ) : confirming ? (
        <div role="alertdialog" aria-labelledby="bekreft-oppgjor" className="rounded-xl border border-wine/30 bg-white p-5">
          <p id="bekreft-oppgjor" className="font-display text-xl font-semibold text-plum">
            Nå føres {kr(money.videre)} videre til neste runde. Stemmer det?
          </p>
          {check.needsForce && (
            <p className="mt-1 flex items-start gap-2 text-sm text-wine">
              <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
              {owing} lodd mangler fortsatt betaling. Sjekk om vedkommende har glemt å trykke Betalt. Du kan markere som Betalt i Salg på denne siden.
            </p>
          )}
          <p className="mt-1 text-sm text-plum/80">Etterpå låses runden. Du kan angre så lenge neste runde ikke er startet.</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <button type="button" disabled={busy} onClick={settle} className={btn.primary} autoFocus>
              {busy ? "Gjør opp…" : "Ja, gjør opp"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className={btn.secondary}>
              Avbryt
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" disabled={!check.ready || busy} onClick={() => setConfirming(true)} className={btn.primary}>
            Gjør opp runden
          </button>
          {!check.ready && <span className="text-sm text-plum/80">Trekk alle premiene først.</span>}
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function CheckItem({
  ok,
  soft,
  action,
  children,
}: {
  ok: boolean;
  soft?: boolean;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-sage text-white" : soft ? "bg-gold-soft text-plum" : "border-2 border-wine/50 text-wine"
        }`}
      >
        {ok ? <IconCheck className="h-3.5 w-3.5" /> : soft ? <IconAlert className="h-3.5 w-3.5" /> : null}
      </span>
      <span className={`text-sm ${ok ? "text-plum" : "font-semibold text-plum"}`}>{children}</span>
      {action}
    </li>
  );
}

function LinkButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="text-sm font-semibold text-wine underline underline-offset-4 hover:text-wine-dark">
      {children}
    </button>
  );
}

function Line({ label, value, total, negative }: { label: string; value: string; total?: boolean; negative?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 py-1 ${total ? "mt-1 border-t border-plum/20 pt-2 text-base font-semibold text-plum" : "text-plum/80"}`}>
      <dt>{label}</dt>
      <dd className={negative ? "text-wine" : undefined}>{value}</dd>
    </div>
  );
}

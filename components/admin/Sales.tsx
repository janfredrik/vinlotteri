"use client";

import { useEffect, useRef, useState } from "react";
import { roundAction } from "@/lib/adminApi";
import { fmt, weekdayTime } from "@/lib/datetime";
import Grid, { type GridCell } from "@/components/Grid";
import { NAME_DISPLAY_MAX, gridLabel } from "@/lib/format";
import { kr } from "@/lib/format";
import type { AdminRoundState } from "@/lib/adminTypes";
import type { Cell } from "@/lib/types";
import { ConfirmButton, ErrorNote, IconCheck, btn, useAction } from "./ui";

const CELL_STATUS: Record<Cell["status"], string> = {
  available: "Ledig",
  held: "Reservert, venter på betaling",
  sold: "Solgt",
};

/** Held first (nobody has confirmed them), then unpaid, then paid - each in purchase order. */
function owingRank(c: Cell) {
  return c.status === "held" ? 0 : !c.paid ? 1 : 2;
}

export default function Sales({
  state,
  reload,
  locked,
  fixable = false,
}: {
  state: AdminRoundState;
  reload: () => void;
  locked: boolean;
  /** Locked, but history editing is on: buyer names can still be corrected. */
  fixable?: boolean;
}) {
  const { round, cells, money, draws } = state;
  const roundId = round.id;
  const [selId, setSelId] = useState<number | null>(null);
  const { run, busy, error } = useAction();

  const sel = cells.find((c) => c.id === selId) ?? null;
  const taken = cells
    .filter((c) => c.status === "sold" || c.status === "held")
    .sort((a, b) => owingRank(a) - owingRank(b) || (a.created_at ?? "").localeCompare(b.created_at ?? ""));
  const held = taken.filter((c) => c.status === "held").length;
  const owing = taken.filter((c) => owingRank(c) < 2);
  const [filter, setFilter] = useState<"owing" | "all">(owing.length ? "owing" : "all");
  const shown = filter === "owing" ? owing : taken;

  const gridCells: GridCell[] = cells.map((c) => ({
    row: c.row,
    col: c.col,
    status: c.status,
    label: gridLabel(c.buyer_name),
  }));

  const act = (body: Record<string, unknown>) =>
    run(async () => {
      await roundAction(roundId, body);
      reload();
      return true;
    });

  const setPaid = (c: Cell, paid: boolean) => act({ type: "cellPaid", cellId: c.id, paid });

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-x-8 gap-y-3 border-y border-plum/10 py-3 sm:flex sm:flex-wrap">
        <Stat label="Solgt" value={`${money.sold}`} />
        <Stat label="Reservert" value={`${held}`} tone={held ? "warn" : undefined} />
        <Stat label="Mangler betaling" value={`${money.unpaidCount + held}`} tone={money.unpaidCount + held ? "warn" : "good"} />
        <Stat label="Inn fra lodd" value={kr(money.loddSolgt)} />
      </dl>

      <SaleStatus state={state} locked={locked} act={act} busy={busy} hasDraws={draws.length > 0} />
      <ErrorNote>{error}</ErrorNote>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] lg:items-start">
        {/* On phones the grid steps out of the timeline indent so the squares get room for names. */}
        <div className="relative -ml-11 sm:ml-0">
          <Grid
            size={round.grid_size}
            cells={gridCells}
            onCellClick={(gc) => {
              const c = cells.find((c) => c.row === gc.row && c.col === gc.col);
              // A settled round at most lets you correct names, so empty squares have nothing to offer.
              if (c && (!locked || c.status !== "available")) setSelId(c.id);
            }}
          />
          <p className="mt-2 text-xs text-plum/70">
            {!locked
              ? "Trykk på en rute for å tildele, frigi eller rette navnet."
              : fixable
                ? "Trykk på en solgt rute for å rette navnet."
                : "Trykk på en solgt rute for å se hvem som kjøpte den."}
          </p>
        </div>

        <div>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-plum">Betalinger</h3>
            <div role="radiogroup" aria-label="Vis" className="flex rounded-full border border-plum/20 p-0.5 text-sm">
              {(
                [
                  ["owing", `Mangler (${owing.length})`],
                  ["all", `Alle (${taken.length})`],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="radio"
                  aria-checked={filter === id}
                  onClick={() => setFilter(id)}
                  className={`min-h-9 rounded-full px-3 ${filter === id ? "bg-wine text-cream" : "text-plum/80 hover:text-wine"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <ul className="mt-3 divide-y divide-plum/10 rounded-xl border border-plum/10 bg-white">
            {shown.map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-3 py-2">
                <span className="w-9 shrink-0 font-semibold tabular-nums text-plum">{c.col}-{c.row}</span>
                <span className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => setSelId(c.id)}
                    className="block max-w-full truncate text-left text-sm font-medium text-plum underline-offset-4 hover:text-wine hover:underline"
                    aria-label={`${c.buyer_name}, rute ${c.col}-${c.row}: åpne ruten`}
                  >
                    {c.buyer_name}
                  </button>
                  <span className="block text-xs text-plum/70">
                    {c.status === "held" ? "Reservert" : "Kjøpt"} {fmt(c.created_at)}
                  </span>
                </span>
                {c.paid ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-sage">
                      <IconCheck /> Betalt
                    </span>
                    {!locked && (
                      <button
                        type="button"
                        onClick={() => setPaid(c, false)}
                        disabled={busy}
                        className={`${btn.quiet} text-xs`}
                        aria-label={`Angre betalt for ${c.buyer_name}, rute ${c.col}-${c.row}`}
                      >
                        Angre
                      </button>
                    )}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setPaid(c, true)}
                    disabled={busy || locked}
                    className="min-h-10 shrink-0 rounded-lg border border-gold bg-gold-soft/50 px-3 text-sm font-semibold text-plum hover:bg-gold-soft disabled:opacity-50"
                    aria-label={`Marker ${c.buyer_name}, rute ${c.col}-${c.row}, som betalt`}
                  >
                    Marker betalt
                  </button>
                )}
              </li>
            ))}
            {!shown.length && (
              <li className="px-3 py-6 text-center text-sm text-plum/70">
                {filter === "owing" && taken.length ? "Alle har betalt. Pengene stemmer." : "Ingen har kjøpt lodd ennå."}
              </li>
            )}
          </ul>
        </div>
      </div>

      <CellDialog
        cell={sel}
        cells={cells}
        knownNames={state.knownNames}
        locked={locked}
        canRename={!locked || fixable}
        onClose={() => setSelId(null)}
        act={act}
        busy={busy}
        error={error}
      />
    </div>
  );
}

function SaleStatus({
  state,
  locked,
  act,
  busy,
  hasDraws,
}: {
  state: AdminRoundState;
  locked: boolean;
  act: (b: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  hasDraws: boolean;
}) {
  const { round } = state;
  if (round.status === "draft")
    return <p className="text-sm text-plum/80">Salget åpner når du lagrer forberedelsene med et Vippsnummer.</p>;
  if (round.status === "open") {
    const closeAt = round.sales_close_at;
    const overtime = !!closeAt && Date.parse(closeAt) <= Date.parse(state.now);
    return (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-plum">
          {overtime
            ? "Salgstiden er ute, men etternølere kan fortsatt kjøpe til du stenger"
            : `Salget er åpent${closeAt ? ` · salgstid til ${weekdayTime(closeAt)}` : ""}`}
        </p>
        <button type="button" disabled={busy} onClick={() => act({ type: "status", status: "closed" })} className={btn.primary}>
          Steng salget
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="text-sm text-plum">Salget er stengt.</p>
      {!locked && !hasDraws && round.status === "closed" && (
        <button type="button" disabled={busy} onClick={() => act({ type: "status", status: "open" })} className={btn.quiet}>
          Gjenåpne salget
        </button>
      )}
    </div>
  );
}

/** Native <dialog>: focus trap, Esc and the backdrop come for free. */
function CellDialog({
  cell,
  cells,
  knownNames,
  locked,
  canRename,
  onClose,
  act,
  busy,
  error,
}: {
  cell: Cell | null;
  cells: Cell[];
  knownNames: string[];
  locked: boolean;
  canRename: boolean;
  onClose: () => void;
  act: (b: Record<string, unknown>) => Promise<unknown>;
  busy: boolean;
  error: string | null;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  // Keep the last cell while the dialog closes so its content doesn't blank out.
  const [shown, setShown] = useState<Cell | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (cell) {
      setShown(cell);
      setName("");
      if (!d.open) d.showModal();
    } else if (d.open) d.close();
  }, [cell]);

  const done = async (body: Record<string, unknown>) => {
    if (await act(body)) onClose();
  };
  const c = cell ?? shown;

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="rute-tittel"
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl bg-cream p-0 text-plum shadow-[0_20px_50px_-12px_rgba(44,10,20,0.45)]"
    >
      {c && (
        <div className="p-5">
          <h3 id="rute-tittel" className="font-display text-xl font-semibold text-wine">
            Rute {c.col}-{c.row}
          </h3>
          <p className="mt-1 text-sm text-plum/80">
            {CELL_STATUS[c.status]}
            {c.buyer_name ? ` · ${c.buyer_name}` : ""}
            {c.status === "sold" ? (c.paid ? " · betalt" : " · ikke betalt") : ""}
          </p>

          <div className="mt-4 space-y-2">
            {!locked && (c.status === "sold" || c.status === "held") && (
              <>
                {!c.paid ? (
                  <button type="button" disabled={busy} onClick={() => done({ type: "cellPaid", cellId: c.id, paid: true })} className={`${btn.primary} w-full`}>
                    Marker som betalt
                  </button>
                ) : (
                  <button type="button" disabled={busy} onClick={() => done({ type: "cellPaid", cellId: c.id, paid: false })} className={`${btn.secondary} w-full`}>
                    Fjern betalt-merking
                  </button>
                )}
                <div className="pt-1 text-center">
                  <ConfirmButton
                    question={`Frigi ${c.col}-${c.row}?`}
                    confirmLabel="Ja, frigi"
                    onConfirm={() => done({ type: "cellClear", cellId: c.id })}
                  >
                    Frigi ruten
                  </ConfirmButton>
                </div>
              </>
            )}

            {canRename && (c.status === "sold" || c.status === "held") && (
              <RenameForm
                key={`${c.id}-${c.buyer_name}`}
                cell={c}
                cells={cells}
                knownNames={knownNames}
                busy={busy}
                done={done}
                prominent={locked}
              />
            )}

            {!locked && c.status === "available" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (name.trim().length >= 2) void done({ type: "cellAssign", row: c.row, col: c.col, name, paid: true });
                }}
                className="space-y-2"
              >
                <label className="block text-sm font-medium text-plum">
                  Navn på kjøperen
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={NAME_DISPLAY_MAX}
                    autoFocus
                    className="mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base"
                  />
                  <span className="mt-1 block text-xs font-normal text-plum/70">Maks {NAME_DISPLAY_MAX} tegn.</span>
                </label>
                <button type="submit" disabled={busy || name.trim().length < 2} className={`${btn.primary} w-full`}>
                  Tildel og marker betalt
                </button>
              </form>
            )}
          </div>

          <div className="mt-3">
            <ErrorNote>{error}</ErrorNote>
          </div>
          <button type="button" onClick={onClose} className={`${btn.quiet} mt-2 w-full justify-center`}>
            Lukk
          </button>
        </div>
      )}
    </dialog>
  );
}

/** Correcting a name - someone used another nickname than usual, and the stats would count them twice. */
function RenameForm({
  cell,
  cells,
  knownNames,
  busy,
  done,
  prominent,
}: {
  cell: Cell;
  cells: Cell[];
  knownNames: string[];
  busy: boolean;
  done: (body: Record<string, unknown>) => Promise<void>;
  /** The only thing left to do on a settled round, so it gets a real button instead of a link. */
  prominent: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(cell.buyer_name ?? "");
  const [all, setAll] = useState(true);
  const same = cells.filter(
    (o) => (o.status === "sold" || o.status === "held") && o.buyer_name_norm === cell.buyer_name_norm,
  ).length;
  const unchanged = name.trim() === (cell.buyer_name ?? "").trim();

  if (!open)
    return (
      <div className="text-center">
        <button type="button" onClick={() => setOpen(true)} className={prominent ? `${btn.secondary} w-full` : btn.quiet}>
          Rett navnet
        </button>
      </div>
    );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim().length >= 2 && !unchanged)
          void done({ type: "cellRename", cellId: cell.id, name, all: same > 1 && all });
      }}
      className="space-y-2 rounded-xl border border-plum/10 bg-white p-3"
    >
      <label className="block text-sm font-medium text-plum">
        Riktig navn
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          list="kjente-navn"
          autoFocus
          className="mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base"
        />
        <span className="mt-1 block text-xs font-normal text-plum/70">
          Bruk navnet personen pleier å kjøpe med, så teller statistikken dem som én.
        </span>
      </label>
      <datalist id="kjente-navn">
        {knownNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      {same > 1 && (
        <label className="flex items-center gap-2 text-sm text-plum">
          <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="h-4 w-4 accent-wine" />
          Gjelder alle {same} lodd til {cell.buyer_name} i runden
        </label>
      )}
      <button type="submit" disabled={busy || name.trim().length < 2 || unchanged} className={`${btn.primary} w-full`}>
        Lagre navnet
      </button>
    </form>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "warn" | "good" }) {
  return (
    <div>
      <dt className="text-xs font-medium text-plum/70">{label}</dt>
      <dd
        className={`font-display text-2xl font-semibold tabular-nums ${
          tone === "warn" ? "text-wine" : tone === "good" ? "text-sage" : "text-plum"
        }`}
      >
        {value}
      </dd>
    </div>
  );
}

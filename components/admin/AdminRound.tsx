"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/adminApi";
import { kr } from "@/lib/format";
import type { AdminRoundState } from "@/lib/adminTypes";
import { PHASES, STATUS_LABEL, currentPhase, phaseIndex, settleCheck, type Phase } from "@/lib/phases";
import Settings from "./Settings";
import Prizes from "./Prizes";
import Sales from "./Sales";
import DrawPanel from "./DrawPanel";
import Settle from "./Settle";
import Handover from "./Handover";
import AdminGuide, { useAdminGuide } from "./AdminGuide";
import { ConfirmButton, IconCheck, IconChevron, IconExternal, IconHelp, btn, useAction, ErrorNote } from "./ui";

/**
 * The organiser's week as one timeline: Forbered → Salg → Trekning → Oppgjør → Avslutt runde.
 * The step the round is in opens by itself; finished steps fold up into a one-line summary.
 */
export default function AdminRound({ roundId }: { roundId: number }) {
  const router = useRouter();
  const [state, setState] = useState<AdminRoundState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<Phase>>(new Set());
  const lastPhase = useRef<Phase | null>(null);
  const flushPrizes = useRef<(() => Promise<void>) | null>(null);
  const guide = useAdminGuide();

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/admin/rounds/${roundId}`);
      setState(d);
      setErr(null);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [roundId]);

  useEffect(() => {
    load();
    let es: EventSource | null = null;
    try {
      es = new EventSource(`/api/rounds/${roundId}/stream`);
      es.onmessage = (e) => {
        if (e.data === "update") load();
      };
    } catch {
      /* ignore */
    }
    const poll = setInterval(load, 15_000);
    return () => {
      es?.close();
      clearInterval(poll);
    };
  }, [roundId, load]);

  const now = state ? currentPhase(state.round.status) : null;

  const goTo = useCallback((p: Phase) => {
    setOpen((s) => new Set(s).add(p));
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("steg", p);
      window.history.replaceState(null, "", url);
    } catch {
      /* ignore */
    }
    requestAnimationFrame(() =>
      document.getElementById(`steg-${p}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  }, []);

  // Open the step the round is in - on first load (or the one in ?steg=), and again whenever the
  // round moves on, so closing the sale lands you in the draw.
  useEffect(() => {
    if (!now) return;
    if (lastPhase.current === null) {
      const asked = new URLSearchParams(window.location.search).get("steg") as Phase | null;
      const first = asked && PHASES.some((p) => p.id === asked) ? asked : now;
      setOpen(new Set([first]));
      if (asked) goTo(asked);
    } else if (lastPhase.current === "trekk" && now === "oppgjor") {
      // The last draw is being revealed; open the next step but stay put. The draw panel
      // offers "Gå til oppgjøret" when they're ready.
      setOpen((s) => new Set(s).add(now));
    } else if (lastPhase.current !== now) {
      goTo(now);
    }
    lastPhase.current = now;
  }, [now, goTo]);

  if (err === "Krever tilgangs-PIN.") {
    return (
      <p className="text-sm text-plum/70">
        Du må <Link href="/apne" className="text-wine underline">låse opp</Link> med tilgangs-PIN.
      </p>
    );
  }
  if (!state || !now) return <p className="text-sm text-plum/70">{err ?? "Laster…"}</p>;

  const { round, money, prizes, cells, draws } = state;
  const locked = round.status === "settled";
  const check = settleCheck(cells, prizes, draws);
  const owing = check.unpaid + check.held;
  const firstWinner = draws.find((d) => d.rank === 1)?.winner_name;

  const summary: Record<Phase, string> = {
    forbered:
      round.status === "draft"
        ? round.vipps_number
          ? `${prizes.length} premier · klar til å åpne`
          : "Mangler Vippsnummer"
        : `${prizes.length ? `${prizes.length} ${prizes.length === 1 ? "premie" : "premier"}` : "Ingen premier ennå"} · Vipps ${round.vipps_number}`,
    selg:
      round.status === "draft"
        ? "Åpner når forberedelsene er lagret"
        : `${money.sold} av ${cells.length} solgt · ${owing ? `${owing} mangler betaling` : "alle betalt"}`,
    trekk: check.prizes ? `${check.drawn} av ${check.prizes} fordelt` : "Ingen premier ennå",
    oppgjor: locked ? `Gjort opp · ${kr(money.videre)} videre` : `${kr(money.videre)} går videre`,
    stafett: state.successor.id
      ? `${state.successor.title || "Neste runde"} er startet`
      : firstWinner
        ? `${firstWinner} arrangerer neste runde`
        : "Neste runde",
  };

  const toggle = (p: Phase) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(p)) n.delete(p);
      else n.add(p);
      return n;
    });

  const body: Record<Phase, ReactNode> = {
    forbered: (
      <div className="space-y-8">
        <Settings state={state} reload={load} locked={locked} fixable={locked && state.historyEdit} beforeSave={async () => flushPrizes.current?.()}>
          <Prizes state={state} reload={load} locked={locked} fixable={locked && state.historyEdit} flushRef={flushPrizes} />
        </Settings>
      </div>
    ),
    selg: <Sales state={state} reload={load} locked={locked} fixable={locked && state.historyEdit} />,
    trekk: <DrawPanel state={state} reload={load} locked={locked} goTo={goTo} />,
    oppgjor: <Settle state={state} reload={load} goTo={goTo} />,
    stafett: <Handover state={state} onNext={(id) => router.push(`/admin/runde/${id}`)} />,
  };

  const nowIdx = phaseIndex(now);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/admin" className="text-sm text-plum/70 hover:text-wine">
            ← Alle runder
          </Link>
          <h1 className="mt-1 font-display text-3xl font-semibold text-balance text-wine">
            {round.title || `Runde ${roundId}`}
          </h1>
          <p className="mt-1 text-sm text-plum/70">
            {STATUS_LABEL[round.status]}
            {round.organizer_name ? ` · arrangør ${round.organizer_name}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" onClick={guide.show} className={btn.quiet}>
            <IconHelp className="h-4 w-4" /> Slik funker det
          </button>
          <Link href={`/runde/${roundId}`} target="_blank" className={btn.quiet}>
            Åpne kjøpesiden <IconExternal className="h-3.5 w-3.5" />
          </Link>
        </div>
      </header>

      <AdminGuide
        open={guide.open}
        onClose={guide.close}
        round={{
          id: round.id,
          status: round.status,
          title: round.title,
          organizer: round.organizer_name,
          vipps: round.vipps_number,
          salesCloseAt: round.sales_close_at,
        }}
      />

      {/* Step rail: where the round is, and a shortcut to each step. */}
      <nav aria-label="Rundens steg">
        <ol className="grid grid-cols-5 gap-1">
          {PHASES.map((p, i) => {
            const done = i < nowIdx;
            const current = i === nowIdx;
            return (
              <li key={p.id} className="relative">
                {i > 0 && (
                  <span
                    aria-hidden="true"
                    className={`absolute right-1/2 top-4 h-px w-full -translate-y-1/2 ${i <= nowIdx ? "bg-wine/60" : "bg-plum/15"}`}
                  />
                )}
                <button
                  type="button"
                  onClick={() => goTo(p.id)}
                  aria-current={current ? "step" : undefined}
                  className="group relative z-10 flex w-full flex-col items-center gap-1.5 rounded-lg px-1 pb-1 text-center"
                >
                  <StepDot state={done ? "done" : current ? "current" : "todo"} />
                  <span
                    className={`text-xs font-semibold sm:text-sm ${current ? "text-wine" : done ? "text-plum" : "text-plum/70"} group-hover:text-wine`}
                  >
                    {p.label}
                  </span>
                  <span className="hidden text-xs leading-snug text-plum/70 sm:block">{summary[p.id]}</span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {locked && (
        <p className="rounded-lg bg-parchment/70 px-4 py-3 text-sm text-plum">
          {state.historyEdit
            ? "Runden er gjort opp, men retting av historikk er slått på. Du kan rette tittel, arrangør, Vippsnummer og premier under «Forbered», navn på kjøperne under «Salg» og vinnerrutene under «Trekning». Pengene står fast."
            : "Runden er gjort opp, så alt er låst. Må noe rettes, angrer du oppgjøret under «Oppgjør» dersom ny runde ikke har startet."}
        </p>
      )}

      <div className="relative">
        {PHASES.map((p, i) => {
          const isOpen = open.has(p.id);
          const done = i < nowIdx;
          const current = i === nowIdx;
          return (
            <section
              key={p.id}
              id={`steg-${p.id}`}
              aria-labelledby={`steg-${p.id}-tittel`}
              className="relative scroll-mt-20 pb-2 pl-11 sm:pl-14"
            >
              {/* the rail between steps */}
              {i < PHASES.length - 1 && (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0 left-4 top-10 w-px ${done ? "bg-wine/50" : "bg-plum/15"}`}
                />
              )}
              <span className="absolute left-0 top-2">
                <StepDot state={done ? "done" : current ? "current" : "todo"} />
              </span>

              <h2 id={`steg-${p.id}-tittel`} className="m-0">
                <button
                  type="button"
                  onClick={() => toggle(p.id)}
                  aria-expanded={isOpen}
                  aria-controls={`steg-${p.id}-innhold`}
                  className="group flex w-full items-start justify-between gap-3 rounded-lg py-2 text-left"
                >
                  <span className="min-w-0">
                    <span
                      className={`block font-display text-xl font-semibold sm:text-2xl ${current ? "text-wine" : "text-plum"} group-hover:text-wine`}
                    >
                      {p.label}
                      {current && (
                        <span className="ml-2 rounded-full bg-gold-soft px-2 py-0.5 align-middle font-sans text-xs font-semibold text-plum">nå</span>
                      )}
                    </span>
                    <span className="mt-0.5 block font-sans text-sm font-normal text-plum/70">{summary[p.id]}</span>
                  </span>
                  <IconChevron
                    className={`mt-2 h-5 w-5 shrink-0 text-plum/60 transition-transform ${isOpen ? "rotate-180" : ""}`}
                  />
                </button>
              </h2>

              <div id={`steg-${p.id}-innhold`} hidden={!isOpen} className="pb-8 pt-3">
                {isOpen && body[p.id]}
              </div>
            </section>
          );
        })}
      </div>

      {!locked && <DangerZone roundId={roundId} onDeleted={() => router.push("/admin")} />}
    </div>
  );
}

function StepDot({ state }: { state: "done" | "current" | "todo" }) {
  if (state === "done")
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full bg-wine text-cream">
        <IconCheck className="h-4 w-4" />
      </span>
    );
  if (state === "current")
    return (
      <span className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 border-gold bg-cream">
        <span className="h-3 w-3 rounded-full bg-wine" />
      </span>
    );
  return <span className="relative flex h-8 w-8 rounded-full border-2 border-plum/20 bg-cream" />;
}

function DangerZone({ roundId, onDeleted }: { roundId: number; onDeleted: () => void }) {
  const { run, error } = useAction();
  return (
    <details className="group border-t border-plum/10 pt-4 text-sm">
      <summary className="cursor-pointer text-plum/70 hover:text-wine">Faresone</summary>
      <div className="mt-3 space-y-2">
        <p className="text-plum/70">Sletter runden med alle lodd, premier og trekninger. Kan ikke angres.</p>
        <ConfirmButton
          className={btn.secondary}
          question="Slette hele runden?"
          confirmLabel="Ja, slett"
          onConfirm={() =>
            run(async () => {
              await api(`/api/admin/rounds/${roundId}`, { method: "DELETE" });
              onDeleted();
            })
          }
        >
          Slett runden
        </ConfirmButton>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </details>
  );
}

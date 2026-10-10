"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { kr } from "@/lib/format";
import { weekdayTime } from "@/lib/datetime";
import { PHASES, STATUS_LABEL, currentPhase, phaseIndex, type Phase } from "@/lib/phases";
import type { RoundSummary } from "@/lib/repo";
import { Crown } from "@/components/Grid";
import { ErrorNote, IconAlert, IconArrowRight, IconCheck, IconExternal, IconGitHub, IconHelp, btn, useAction } from "./ui";
import AdminGuide, { useAdminGuide } from "./AdminGuide";

/**
 * The organiser's front page: the round in progress first, with what needs doing next,
 * then every earlier round as a ledger.
 */
export default function AdminHome() {
  const router = useRouter();
  const [rounds, setRounds] = useState<RoundSummary[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { run, busy, error } = useAction();
  const guide = useAdminGuide();

  const load = useCallback(() => {
    api("/api/admin/rounds")
      .then((d) => setRounds(d.rounds))
      .catch((e) => setLoadError((e as Error).message));
  }, []);
  useEffect(load, [load]);

  // Only for the very first round; later rounds start from the handover so the money carries over.
  const blankRound = () =>
    run(async () => {
      const d = await api("/api/admin/rounds", { method: "POST", body: JSON.stringify({}) });
      router.push(`/admin/runde/${d.id}`);
    });

  if (!rounds) return <p className="text-sm text-plum/70">{loadError ?? "Laster…"}</p>;

  const active = rounds.filter((r) => r.status !== "settled");
  const past = rounds.filter((r) => r.status === "settled");
  const latest = rounds[0];

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-wine">Arrangør</h1>
          {!active.length && <p className="mt-1 text-sm text-plum/70">Ingen runde i gang akkurat nå.</p>}
        </div>
        <button type="button" onClick={guide.show} className={btn.quiet}>
          <IconHelp className="h-4 w-4" /> Slik funker det
        </button>
      </header>

      <AdminGuide
        open={guide.open}
        onClose={guide.close}
        round={
          active[0] && {
            id: active[0].id,
            status: active[0].status,
            title: active[0].title,
            organizer: active[0].organizer,
            vipps: active[0].vippsNumber,
            salesCloseAt: active[0].salesCloseAt,
          }
        }
      />

      {active.map((r) => (
        <ActiveRound key={r.id} round={r} />
      ))}

      {!active.length && latest && <NextRoundPrompt latest={latest} />}

      {!rounds.length && (
        <section className="rounded-2xl border border-plum/10 bg-white px-6 py-8">
          <p className="font-display text-2xl font-semibold text-plum">Første runde</p>
          <p className="mt-1 max-w-prose text-plum/70">
            Lag runden, legg inn Vippsnummer og premier, og åpne salget når alt er klart.
          </p>
          <button type="button" onClick={blankRound} disabled={busy} className={`${btn.primary} mt-5`}>
            {busy ? "Lager…" : "Lag første runde"} <IconArrowRight />
          </button>
          <ErrorNote>{error}</ErrorNote>
        </section>
      )}

      {past.length > 0 && (
        <section aria-labelledby="tidligere" className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <h2 id="tidligere" className="font-display text-xl font-semibold text-plum">
              Tidligere runder
            </h2>
            <span className="text-sm text-plum/70 tabular-nums">{past.length} gjort opp</span>
          </div>
          <PastRounds rounds={past} />
        </section>
      )}

      <a
        href="https://github.com/janfredrik/vinlotteri"
        aria-label="Kildekoden på GitHub"
        title="Kildekoden på GitHub"
        className="mx-auto flex h-11 w-11 items-center justify-center rounded-full text-plum/50 transition-colors hover:text-wine"
      >
        <IconGitHub className="h-5 w-5" />
      </a>
    </div>
  );
}

/* ------------------------------------------------------------ this week --- */

type Todo = { text: string; warn?: boolean };

/** What the organiser should look at next, in the order the week asks for it. */
function todos(r: RoundSummary): Todo[] {
  const list: Todo[] = [];
  const unpaid = r.owing ? { text: `${r.owing} ${r.owing === 1 ? "rute mangler" : "ruter mangler"} betaling`, warn: true } : null;
  switch (r.status) {
    case "draft":
      if (!r.vippsNumber) list.push({ text: "Legg inn Vippsnummeret", warn: true });
      list.push(
        r.prizes
          ? { text: `${r.prizes} ${r.prizes === 1 ? "premie" : "premier"} lagt inn` }
          : { text: "Legg inn premiene", warn: true },
      );
      if (r.vippsNumber && r.prizes) list.push({ text: "Klar til å åpne salget" });
      break;
    case "open":
      list.push({ text: `${r.sold} av ${r.inPlay} ruter solgt` });
      list.push(unpaid ?? { text: "Alle solgte ruter er betalt" });
      break;
    case "closed":
      list.push({ text: r.prizes ? `${r.drawn} av ${r.prizes} premier fordelt` : "Ingen premier å trekke", warn: !r.prizes });
      if (unpaid) list.push(unpaid);
      break;
    case "drawn":
      list.push({ text: `${kr(r.videre)} går videre til neste runde` });
      if (unpaid) list.push(unpaid);
      break;
  }
  return list;
}

function ActiveRound({ round: r }: { round: RoundSummary }) {
  const now = currentPhase(r.status);
  const nowIdx = phaseIndex(now);
  const label = PHASES[nowIdx].label;
  const closes =
    r.salesCloseAt && (r.status === "draft" || r.status === "open")
      ? `Salget stenger ${weekdayTime(r.salesCloseAt)}`
      : STATUS_LABEL[r.status];

  return (
    <section
      aria-labelledby={`runde-${r.id}`}
      className="animate-reveal overflow-hidden rounded-2xl bg-wine text-cream shadow-[0_18px_40px_-20px_rgba(90,16,41,0.8)]"
    >
      <div className="px-5 pb-6 pt-6 sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <h2 id={`runde-${r.id}`} className="font-display text-3xl font-semibold text-balance sm:text-4xl">
            {r.title || `Runde ${r.id}`}
          </h2>
          <Link
            href={`/runde/${r.id}`}
            target="_blank"
            className="inline-flex min-h-9 items-center gap-1.5 text-sm text-cream/80 underline-offset-4 hover:text-cream hover:underline"
          >
            Kjøpesiden <IconExternal className="h-3.5 w-3.5" />
          </Link>
        </div>
        <p className="mt-1 text-cream/80">
          {closes}
          {r.organizer ? ` · arrangør ${r.organizer}` : ""}
          {r.carriedOver ? ` · ${kr(r.carriedOver)} fra forrige runde` : ""}
        </p>

        <ol aria-label="Rundens steg" className="mt-6 grid grid-cols-5 gap-1">
          {PHASES.map((p, i) => (
            <RailStep key={p.id} phase={p} roundId={r.id} state={i < nowIdx ? "done" : i === nowIdx ? "current" : "todo"} first={i === 0} reached={i <= nowIdx} />
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-5 bg-cream px-5 py-5 text-plum sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <ul className="space-y-1.5">
          {todos(r).map((t) => (
            <li key={t.text} className={`flex items-center gap-2 ${t.warn ? "font-semibold text-wine" : "text-plum/80"}`}>
              {t.warn ? <IconAlert className="h-4 w-4 shrink-0" /> : <IconCheck className="h-4 w-4 shrink-0 text-sage" />}
              {t.text}
            </li>
          ))}
        </ul>
        <Link href={`/admin/runde/${r.id}?steg=${now}`} className={`${btn.primary} shrink-0`}>
          Fortsett: {label} <IconArrowRight />
        </Link>
      </div>
    </section>
  );
}

function RailStep({
  phase,
  roundId,
  state,
  first,
  reached,
}: {
  phase: { id: Phase; label: string };
  roundId: number;
  state: "done" | "current" | "todo";
  first: boolean;
  reached: boolean;
}) {
  return (
    <li className="relative">
      {!first && (
        <span
          aria-hidden="true"
          className={`absolute right-1/2 top-3.5 h-px w-full -translate-y-1/2 ${reached ? "bg-cream/70" : "bg-cream/25"}`}
        />
      )}
      <Link
        href={`/admin/runde/${roundId}?steg=${phase.id}`}
        aria-current={state === "current" ? "step" : undefined}
        className="group relative z-10 flex flex-col items-center gap-1.5 rounded-lg px-0.5 pb-1 text-center focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold-soft"
      >
        {state === "done" ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-cream text-wine">
            <IconCheck className="h-3.5 w-3.5" />
          </span>
        ) : state === "current" ? (
          <span className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-gold-soft bg-wine-dark">
            <span className="h-2.5 w-2.5 rounded-full bg-gold-soft" />
          </span>
        ) : (
          <span className="h-7 w-7 rounded-full border-2 border-cream/30 bg-wine" />
        )}
        <span
          className={`text-xs leading-tight sm:text-sm ${state === "current" ? "font-semibold text-cream" : "text-cream/75"} group-hover:text-cream group-hover:underline`}
        >
          {phase.label}
        </span>
      </Link>
    </li>
  );
}

/** Nothing in progress: point at the handover of the last round, which carries the money. */
function NextRoundPrompt({ latest }: { latest: RoundSummary }) {
  if (latest.hasSuccessor) return null;
  return (
    <section className="rounded-2xl border border-gold/40 bg-parchment/60 px-5 py-6 sm:px-7">
      <p className="flex items-center gap-2 font-display text-2xl font-semibold text-balance text-plum">
        {latest.firstWinner ? (
          <>
            <Crown className="h-4 w-6 shrink-0 text-gold" />
            {latest.firstWinner} arrangerer neste runde
          </>
        ) : (
          "Neste runde"
        )}
      </p>
      <p className="mt-1 max-w-prose text-plum/80">
        {latest.title || `Runde ${latest.id}`} er gjort opp, og {kr(latest.videre)} følger med videre. Start neste runde fra
        avslutningen, så kommer pengene med.
      </p>
      <Link href={`/admin/runde/${latest.id}?steg=stafett`} className={`${btn.primary} mt-5`}>
        Start neste runde <IconArrowRight />
      </Link>
    </section>
  );
}

/* ---------------------------------------------------------------- ledger --- */

function PastRounds({ rounds }: { rounds: RoundSummary[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-plum/10 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-plum/10 bg-parchment/50 text-xs text-plum/70">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Runde</th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium sm:table-cell">Arrangør</th>
            <th scope="col" className="hidden px-4 py-2.5 font-medium md:table-cell">Trukket først</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Solgt</th>
            <th scope="col" className="px-4 py-2.5 text-right font-medium">Videre</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-plum/[0.07]">
          {rounds.map((r) => (
            <tr key={r.id} className="relative transition-colors hover:bg-parchment/40">
              <td className="px-4 py-3">
                {/* The link covers the whole row, so any part of it opens the round. */}
                <Link
                  href={`/admin/runde/${r.id}`}
                  className="whitespace-nowrap font-medium text-plum after:absolute after:inset-0 after:content-[''] hover:text-wine focus-visible:outline-none focus-visible:after:rounded-sm focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-wine"
                >
                  {r.title || `Runde ${r.id}`}
                </Link>
                <span className="block text-xs text-plum/70 sm:hidden">{r.organizer || "—"}</span>
              </td>
              <td className="hidden px-4 py-3 text-plum/80 sm:table-cell">{r.organizer || "—"}</td>
              <td className="hidden px-4 py-3 text-plum/80 md:table-cell">
                {r.firstWinner ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Crown className="h-2.5 w-3.5 text-gold" />
                    {r.firstWinner}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td className="px-4 py-3 text-right text-plum/80 tabular-nums">
                {r.sold}
                <span className="text-plum/60">/{r.inPlay}</span>
              </td>
              <td className={`px-4 py-3 text-right font-medium tabular-nums ${r.videre < 0 ? "text-wine" : "text-plum"}`}>
                {kr(r.videre)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

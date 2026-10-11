"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { ErrorNote, IconArrowRight, IconExternal, btn, useAction } from "@/components/admin/ui";

type WrappedYear = { year: number; open: boolean; released: boolean };

/**
 * The switches only the one running the lottery should touch: when the year in review opens,
 * whether settled rounds can be corrected, and merging names. Behind its own PIN (SUPERADMIN_PIN).
 */
export default function SuperadminHome() {
  const { run, busy } = useAction();

  const leave = () =>
    run(async () => {
      await api("/api/superadmin/access", { method: "DELETE" });
      window.location.assign("/admin");
    });

  return (
    <div className="space-y-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-semibold text-wine">Superadmin</h1>
          <p className="mt-1 max-w-prose text-sm text-plum/70">Ting som ikke hører hjemme hos arrangøren av uka.</p>
        </div>
        <button type="button" onClick={leave} disabled={busy} className={btn.quiet}>
          Logg ut av superadmin
        </button>
      </header>

      <Vintages />
      <HistoryEdit />

      <section aria-labelledby="navn" className="rounded-2xl border border-plum/10 bg-white px-5 py-6 sm:px-7">
        <h2 id="navn" className="font-display text-2xl font-semibold text-plum">
          Navn
        </h2>
        <p className="mt-1 max-w-prose text-plum/70">
          Slå sammen navn som er samme person, som «Kari», «KA» og «KAN». Det endrer navnet i alle runder.
        </p>
        <Link href="/superadmin/navn" className={`${btn.secondary} mt-5`}>
          Rydd i navn <IconArrowRight />
        </Link>
      </section>
    </div>
  );
}

/** The year in review ("Årgang"): each year opens only when released here, which also posts to Teams. */
function Vintages() {
  const [years, setYears] = useState<WrappedYear[] | null>(null);
  const [first, setFirst] = useState<number | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const { run, busy, error } = useAction();

  useEffect(() => {
    api("/api/superadmin/wrapped")
      .then((d) => {
        setYears(d.years);
        setFirst(d.first);
      })
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const release = (year: number, released: boolean) =>
    run(async () => {
      const d = await api("/api/superadmin/wrapped", { method: "POST", body: JSON.stringify({ year, released }) });
      setYears(d.years);
    });

  return (
    <section aria-labelledby="argang" className="rounded-2xl bg-plum px-5 py-6 text-cream sm:px-7">
      <h2 id="argang" className="font-display text-2xl font-semibold">
        Årgang
      </h2>
      <p className="mt-1 max-w-prose text-cream/80">
        Året oppsummert. Ingen ser årgangen før du slipper den, og da går det en melding i Teams. Slipp den etter årets siste
        trekning.
      </p>

      {!years ? (
        <p className="mt-5 text-sm text-cream/70">{loadError ?? "Laster…"}</p>
      ) : !years.length ? (
        <p className="mt-5 text-sm text-cream/70">Ingen trukne runder fra {first ?? "i år"} ennå.</p>
      ) : (
        <ul className="mt-5 divide-y divide-cream/15 border-y border-cream/15">
          {years.map((y) => (
            <li key={y.year} className="flex flex-wrap items-center gap-x-4 gap-y-3 py-4">
              <span className="font-display text-2xl font-semibold text-gold">{y.year}</span>
              <span className="text-sm text-cream/70">{y.released ? "Sluppet" : "Ikke sluppet"}</span>
              <span className="ml-auto flex flex-wrap items-center gap-3">
                <Link
                  href={`/wrapped/${y.year}`}
                  target="_blank"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-cream/30 px-4 py-2 font-semibold text-cream transition-colors hover:border-cream"
                >
                  {y.released ? "Åpne" : "Forhåndsvis"} <IconExternal className="h-4 w-4" />
                </Link>
                {y.released && (
                  <Link
                    href={`/wrapped/${y.year}?vis=storskjerm`}
                    target="_blank"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-cream/30 px-4 py-2 font-semibold text-cream transition-colors hover:border-cream"
                  >
                    Storskjerm <IconExternal className="h-4 w-4" />
                  </Link>
                )}
                {y.released ? (
                  <button
                    type="button"
                    onClick={() => release(y.year, false)}
                    disabled={busy}
                    className="min-h-11 px-2 text-sm text-cream/70 underline underline-offset-4 hover:text-cream disabled:opacity-50"
                  >
                    Trekk tilbake
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => release(y.year, true)}
                    disabled={busy}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-gold px-5 py-2 font-semibold text-plum transition-colors hover:bg-gold-soft disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busy ? "Slipper…" : `Slipp årgang ${y.year}`}
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}

/** Correcting settled rounds (prizes and winning squares), for imported history the sheet only half had. */
function HistoryEdit() {
  const [on, setOn] = useState<boolean | null>(null);
  const { run, busy, error } = useAction();

  useEffect(() => {
    api("/api/superadmin/settings")
      .then((d) => setOn(!!d.historyEdit))
      .catch(() => setOn(false));
  }, []);

  const flip = () =>
    run(async () => {
      const d = await api("/api/superadmin/settings", { method: "POST", body: JSON.stringify({ historyEdit: !on }) });
      setOn(!!d.historyEdit);
    });

  return (
    <section aria-labelledby="historikk" className="rounded-2xl border border-plum/10 bg-white px-5 py-6 sm:px-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="historikk" className="font-display text-2xl font-semibold text-plum">
            Rette historikk
          </h2>
          <p className="mt-1 max-w-prose text-plum/70">
            Åpner runder som er gjort opp for retting av tittel, arrangør, Vippsnummer, kjøpernavn, premier (også fra
            skjermbilde) og vinnerruter. Pengene står fast. Alle forbi PIN-en kan administrere, så slå det av igjen når du er
            ferdig.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={!!on}
          aria-labelledby="historikk"
          onClick={flip}
          disabled={busy || on === null}
          className={`relative mt-1 inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-wine disabled:opacity-60 ${on ? "bg-wine" : "bg-plum/20"}`}
        >
          <span
            aria-hidden="true"
            className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform ${on ? "translate-x-7" : "translate-x-1"}`}
          />
        </button>
      </div>
      <p className="mt-3 text-sm font-semibold text-plum">{on === null ? "Laster…" : on ? "Slått på" : "Slått av"}</p>
      <ErrorNote>{error}</ErrorNote>
    </section>
  );
}

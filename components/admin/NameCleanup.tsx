"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/adminApi";
import { mostRecent, sharedRounds, type NameUse } from "@/lib/names";
import { normName } from "@/lib/format";
import { ConfirmButton, ErrorNote, IconAlert, IconCheck, btn, useAction } from "./ui";

type Sort = "navn" | "sist" | "mest";

const byName = new Intl.Collator("nb", { sensitivity: "base", numeric: true });

function day(iso: string): string {
  return new Date(iso).toLocaleDateString("nb-NO", { day: "numeric", month: "short", year: "numeric" });
}

function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

/**
 * Tidying up the people list: the same colleague often shows up as "Kristin", "KR" and "KRL".
 * Pick two or more, check that they never bought in the same round, and merge them into one name.
 */
export default function NameCleanup() {
  const [names, setNames] = useState<NameUse[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("navn");
  const [picked, setPicked] = useState<string[]>([]);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    api("/api/superadmin/names")
      .then((d) => setNames(d.names))
      .catch((e) => setLoadError((e as Error).message));
  }, []);

  const shown = useMemo(() => {
    if (!names) return [];
    const q = normName(query);
    const list = names.filter((n) => !q || n.spellings.some((s) => normName(s).includes(q)) || picked.includes(n.norm));
    const last = (n: NameUse) => n.rounds[0]?.date ?? "";
    return list.sort((a, b) =>
      sort === "sist"
        ? last(b).localeCompare(last(a))
        : sort === "mest"
          ? b.lodd - a.lodd || byName.compare(a.name, b.name)
          : byName.compare(a.name, b.name),
    );
  }, [names, query, sort, picked]);

  if (!names) return <p className="text-sm text-plum/70">{loadError ?? "Laster…"}</p>;

  const selected = picked.map((p) => names.find((n) => n.norm === p)).filter((n): n is NameUse => !!n);
  const toggle = (norm: string) => {
    setDone(null);
    setPicked((p) => (p.includes(norm) ? p.filter((x) => x !== norm) : [...p, norm]));
  };

  return (
    <div className={`space-y-6 ${selected.length ? "pb-[55vh]" : ""}`}>
      <header className="space-y-1">
        <Link href="/superadmin" className={btn.quiet + " -ml-2"}>
          ← Superadmin
        </Link>
        <h1 className="font-display text-3xl font-semibold text-wine">Navn</h1>
        <p className="max-w-prose text-plum/70">
          {plural(names.length, "navn", "navn")} er brukt. Velg to eller flere som er samme person og slå dem sammen. Har
          de kjøpt i samme runde, er det nok to forskjellige.
        </p>
      </header>

      {done && (
        <p role="status" className="flex items-center gap-2 font-medium text-plum">
          <IconCheck className="h-4 w-4 text-sage" /> {done}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-48 flex-1 text-sm text-plum/80">
          Søk
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="KR, Kristin …"
            className="mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base sm:text-sm"
          />
        </label>
        <label className="text-sm text-plum/80">
          Sorter
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as Sort)}
            className="mt-1 block rounded-lg border border-plum/20 bg-white px-3 py-2 text-base sm:text-sm"
          >
            <option value="navn">Alfabetisk</option>
            <option value="sist">Sist brukt</option>
            <option value="mest">Flest lodd</option>
          </select>
        </label>
      </div>

      <ul className="divide-y divide-plum/[0.07] overflow-hidden rounded-xl border border-plum/10 bg-white">
        {shown.map((n) => {
          const on = picked.includes(n.norm);
          const last = n.rounds[0];
          return (
            <li key={n.norm}>
              <label
                className={`flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors ${on ? "bg-parchment" : "hover:bg-parchment/40"}`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(n.norm)}
                  className="mt-1 h-4 w-4 shrink-0 accent-wine"
                />
                <span className="min-w-0 flex-1">
                  <span className="font-semibold text-plum">{n.name}</span>
                  {n.spellings.length > 1 && (
                    <span className="ml-2 text-xs text-plum/60">også {n.spellings.slice(1).join(", ")}</span>
                  )}
                  <span className="block text-sm text-plum/70">
                    {plural(n.lodd, "lodd", "lodd")} i {plural(n.rounds.filter((r) => r.lodd).length, "runde", "runder")}
                    {n.wins ? ` · ${plural(n.wins, "gevinst", "gevinster")}` : ""}
                    {n.organized ? ` · arrangert ${plural(n.organized, "gang", "ganger")}` : ""}
                  </span>
                </span>
                {last && (
                  <span className="shrink-0 text-right text-xs text-plum/70">
                    Sist {last.title}
                    <span className="block tabular-nums">{day(last.date)}</span>
                  </span>
                )}
              </label>
            </li>
          );
        })}
        {!shown.length && <li className="px-4 py-6 text-sm text-plum/70">Ingen navn passer søket.</li>}
      </ul>

      {selected.length > 0 && (
        <MergePanel
          selected={selected}
          onClear={() => setPicked([])}
          onMerged={(list, msg) => {
            setNames(list);
            setPicked([]);
            setDone(msg);
          }}
        />
      )}
    </div>
  );
}

function MergePanel({
  selected,
  onClear,
  onMerged,
}: {
  selected: NameUse[];
  onClear: () => void;
  onMerged: (names: NameUse[], message: string) => void;
}) {
  const newest = mostRecent(selected)!;
  const [target, setTarget] = useState(newest.name);
  const [custom, setCustom] = useState(false);
  const { run, busy, error } = useAction();
  const clashes = sharedRounds(selected);

  // A fresh pick defaults to the name used last; keep a typed-in name.
  useEffect(() => {
    if (!custom) setTarget(newest.name);
  }, [newest.name, custom]);

  const name = target.trim();
  const canMerge = selected.length > 1 && name.length >= 2;
  const totalLodd = selected.reduce((n, s) => n + s.lodd, 0);

  const merge = () =>
    run(async () => {
      const d = await api("/api/superadmin/names", {
        method: "POST",
        body: JSON.stringify({ norms: selected.map((s) => s.norm), name }),
      });
      onMerged(d.names, `${selected.map((s) => s.name).join(", ")} heter nå ${name} (${plural(d.rounds, "runde", "runder")} endret).`);
    });

  return (
    <section
      aria-label="Slå sammen"
      className="fixed inset-x-0 bottom-0 z-20 max-h-[50vh] overflow-y-auto border-t border-plum/15 bg-cream shadow-[0_-12px_30px_-18px_rgba(60,20,40,0.5)]"
    >
      <div className="mx-auto max-w-3xl space-y-4 px-4 py-4 sm:px-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold text-plum">
            {selected.length === 1 ? "Velg minst ett navn til" : `Slå sammen ${selected.length} navn`}
          </h2>
          <button type="button" onClick={onClear} className={btn.quiet}>
            Fjern valg
          </button>
        </div>

        <table className="w-full text-left text-sm">
          <thead className="text-xs text-plum/70">
            <tr>
              <th scope="col" className="py-1 pr-3 font-medium">Navn</th>
              <th scope="col" className="py-1 pr-3 font-medium">Sist brukt</th>
              <th scope="col" className="py-1 text-right font-medium">Lodd</th>
            </tr>
          </thead>
          <tbody>
            {[...selected]
              .sort((a, b) => (b.rounds[0]?.date ?? "").localeCompare(a.rounds[0]?.date ?? ""))
              .map((s) => (
                <tr key={s.norm} className="border-t border-plum/[0.07]">
                  <td className="py-1.5 pr-3 font-semibold text-plum">
                    {s.name}
                    {s === newest && selected.length > 1 && (
                      <span className="ml-2 rounded-full bg-sage/20 px-2 py-0.5 text-xs font-medium text-plum">nyligst</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-3 text-plum/80">
                    {s.rounds[0] ? `${s.rounds[0].title} · ${day(s.rounds[0].date)}` : "—"}
                  </td>
                  <td className="py-1.5 text-right tabular-nums text-plum/80">{s.lodd}</td>
                </tr>
              ))}
          </tbody>
        </table>

        {selected.length > 1 &&
          (clashes.length ? (
            <div role="alert" className="rounded-lg border border-wine/30 bg-white px-3 py-2 text-sm text-wine">
              <p className="flex items-center gap-2 font-semibold">
                <IconAlert className="h-4 w-4 shrink-0" />
                Kjøpt i samme runde {plural(clashes.length, "gang", "ganger")}: trolig forskjellige personer
              </p>
              <ul className="mt-1 space-y-0.5 text-plum/80">
                {clashes.slice(0, 5).map((c) => (
                  <li key={c.id}>
                    {c.title}: {c.names.join(" og ")}
                  </li>
                ))}
                {clashes.length > 5 && <li>… og {clashes.length - 5} til</li>}
              </ul>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-plum/80">
              <IconCheck className="h-4 w-4 shrink-0 text-sage" /> Aldri kjøpt i samme runde.
            </p>
          ))}

        {selected.length > 1 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-plum">Riktig navn</legend>
            <div className="flex flex-wrap gap-2">
              {selected.map((x) => x.name).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={!custom && target === s}
                  onClick={() => {
                    setCustom(false);
                    setTarget(s);
                  }}
                  className={`min-h-9 rounded-lg border px-3 text-sm font-semibold ${
                    !custom && target === s ? "border-wine bg-wine text-cream" : "border-plum/20 bg-white text-plum hover:border-wine"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <label className="block text-sm text-plum/80">
              Eller skriv et annet
              <input
                value={custom ? target : ""}
                onChange={(e) => {
                  setCustom(true);
                  setTarget(e.target.value);
                }}
                maxLength={40}
                className="mt-1 block w-full max-w-xs rounded-lg border border-plum/20 bg-white px-3 py-2 text-base sm:text-sm"
              />
            </label>
          </fieldset>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <ConfirmButton
            className={btn.primary}
            disabled={!canMerge || busy}
            question={`${plural(totalLodd, "lodd", "lodd")} og alle gevinster får navnet ${name}. Sikker?`}
            confirmLabel="Ja, slå sammen"
            onConfirm={merge}
          >
            {busy ? "Slår sammen…" : canMerge ? `Slå sammen til ${name}` : "Slå sammen"}
          </ConfirmButton>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import { patchRound, roundAction } from "@/lib/adminApi";
import { fromLocalInput, toLocalInput } from "@/lib/datetime";
import type { AdminRoundState } from "@/lib/adminTypes";
import { SEASONS, roundSeason, seasonInfo } from "@/lib/season";
import DatePicker from "./DatePicker";
import { btn } from "./ui";

export default function Settings({
  state,
  reload,
  locked,
  fixable = false,
  children,
  beforeSave,
}: {
  state: AdminRoundState;
  reload: () => void;
  locked: boolean;
  /** Locked, but history editing is on: title, organiser and Vippsnummer can still be corrected. */
  fixable?: boolean;
  /** Shown between the fields and the save button, outside the form so it can hold forms of its own. */
  children?: ReactNode;
  /** Runs before the round is saved; if it throws, nothing more is saved. */
  beforeSave?: () => Promise<void>;
}) {
  const r = state.round;
  const [form, setForm] = useState({
    title: r.title,
    ticket_price: String(r.ticket_price),
    max_per_person: String(r.max_per_person),
    organizer_name: r.organizer_name,
    vipps_number: r.vipps_number,
    carried_over: String(r.carried_over),
    polet_cost: r.polet_cost == null ? "" : String(r.polet_cost),
    notes: r.notes,
    restriction_lifts_at: toLocalInput(r.restriction_lifts_at),
    sales_close_at: toLocalInput(r.sales_close_at),
    theme: roundSeason(r.theme) ?? "none",
  });
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof typeof form | "form", string>>>({});

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSavedNote(null);
    setErrors((e) => ({ ...e, [k]: undefined, form: undefined }));
  }

  function validate(opening: boolean) {
    const e: typeof errors = {};
    // Imported history may have no Vippsnummer; that shouldn't block correcting the title. A draft
    // saved without opening can wait for the new organiser's number too.
    if (!locked && (opening || r.status !== "draft") && !form.vipps_number.trim()) e.vipps_number = "Fyll inn Vippsnummeret kjøperne skal betale til.";
    const lifts = fromLocalInput(form.restriction_lifts_at);
    const closes = fromLocalInput(form.sales_close_at);
    if (lifts && closes && Date.parse(lifts) > Date.parse(closes))
      e.restriction_lifts_at = "Maks-grensen må oppheves før salget stenger.";
    if (Number(form.ticket_price) <= 0) e.ticket_price = "Prisen må være mer enn 0 kr.";
    if (Number(form.max_per_person) < 0) e.max_per_person = "Kan ikke være negativt.";
    return e;
  }

  // The save button sits below the prizes, far from the fields: bring the first bad one into view.
  function showFirstError() {
    requestAnimationFrame(() => {
      const label = document.querySelector("#round-settings [data-error]")?.closest("label");
      if (!label) return;
      const details = label.closest("details");
      if (details) details.open = true;
      label.scrollIntoView({ behavior: "smooth", block: "center" });
      label.querySelector<HTMLElement>("input, select, textarea, button")?.focus({ preventScroll: true });
    });
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    setSavedNote(null);
    const opening = r.status === "draft" && (ev.nativeEvent as SubmitEvent).submitter?.getAttribute("value") !== "draft";
    const e = validate(opening);
    if (Object.keys(e).length) {
      const only = Object.keys(e).length === 1 ? Object.values(e)[0] : null;
      setErrors({ ...e, form: only ?? "Sjekk feltene som er merket." });
      showFirstError();
      return;
    }
    setErrors(e);

    setBusy(true);
    try {
      await beforeSave?.();
      if (locked) {
        await patchRound(r.id, { title: form.title, organizer_name: form.organizer_name, vipps_number: form.vipps_number.trim() });
        setSavedNote("Lagret.");
        reload();
        return;
      }
      await patchRound(r.id, {
        title: form.title,
        ticket_price: Number(form.ticket_price) || 0,
        max_per_person: Number(form.max_per_person) || 0,
        organizer_name: form.organizer_name,
        vipps_number: form.vipps_number.trim(),
        carried_over: Number(form.carried_over) || 0,
        polet_cost: form.polet_cost === "" ? null : Number(form.polet_cost),
        notes: form.notes,
        restriction_lifts_at: fromLocalInput(form.restriction_lifts_at),
        sales_close_at: fromLocalInput(form.sales_close_at),
        theme: form.theme,
      });
      let opened = false;
      if (opening) {
        await roundAction(r.id, { type: "status", status: "open" });
        opened = true;
      }
      setSavedNote(opened ? "Lagret. Loddsalget er åpent!" : r.status === "draft" ? "Lagret. Salget er fortsatt ikke åpnet." : "Lagret.");
      reload();
    } catch (err) {
      setErrors({ form: (err as Error).message });
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base disabled:bg-parchment/50 disabled:text-plum/60 sm:text-sm";
  const invalid = "border-wine ring-1 ring-wine";
  const season = roundSeason(form.theme);
  const themeSummary = season ? `${seasonInfo(season).emoji} ${seasonInfo(season).label.toLowerCase()}` : "uten tema";

  return (
    <>
      <form id="round-settings" onSubmit={save} noValidate>
        <fieldset disabled={locked && !fixable} className="space-y-6">
          <legend className="sr-only">Innstillinger for runden</legend>
          <div>
            <h3 className="font-display text-lg font-semibold text-plum">Denne uka</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Field label="Arrangør">
                <input className={input} value={form.organizer_name} onChange={(e) => set("organizer_name", e.target.value)} autoComplete="name" />
              </Field>
              <Field
                label="Vippsnummer"
                required
                hint={errors.vipps_number ? undefined : "Kjøperne betaler hit. Uten det kan salget ikke åpne."}
                error={errors.vipps_number}
              >
                <input
                  className={`${input} tabular-nums ${errors.vipps_number ? invalid : ""}`}
                  value={form.vipps_number}
                  onChange={(e) => set("vipps_number", e.target.value)}
                  inputMode="numeric"
                  autoComplete="tel"
                  aria-invalid={!!errors.vipps_number}
                />
              </Field>
              <Field label="Tittel" wide>
                <input className={input} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Uke 41 – 2026" />
              </Field>
              <fieldset disabled={locked} className="contents">
              <Field
                label="Maks-grensen oppheves"
                hint={errors.restriction_lifts_at ? undefined : "Etter dette kan alle kjøpe så mange de vil. Vanligvis 30 min før trekning."}
                error={errors.restriction_lifts_at}
              >
                <DateTimeInput
                  label="Maks-grensen oppheves"
                  invalid={!!errors.restriction_lifts_at}
                  value={form.restriction_lifts_at}
                  onChange={(v) => set("restriction_lifts_at", v)}
                />
              </Field>
              <Field label="Salget stenger" hint={form.sales_close_at ? undefined : "Tomt: salget stenges bare for hånd."}>
                <DateTimeInput label="Salget stenger" clearable value={form.sales_close_at} onChange={(v) => set("sales_close_at", v)} />
              </Field>
              </fieldset>
            </div>
          </div>

          <details className="group rounded-lg border border-plum/10 bg-white/60 px-4 py-3">
            <summary className="cursor-pointer text-sm font-semibold text-plum">
              Flere valg
              <span className="ml-2 font-normal text-plum/70">
                kr {form.ticket_price || 0} per lodd · maks {Number(form.max_per_person) || "ubegrenset"} · inn kr {form.carried_over || 0} · {themeSummary}
                {form.notes.trim() && " · med beskjed"}
              </span>
            </summary>
            <fieldset disabled={locked} className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Pris per lodd (kr)" error={errors.ticket_price}>
                <input type="number" min={1} className={`${input} tabular-nums`} value={form.ticket_price} onChange={(e) => set("ticket_price", e.target.value)} />
              </Field>
              <Field label="Maks lodd per person" hint="0 betyr ingen grense." error={errors.max_per_person}>
                <input type="number" min={0} className={`${input} tabular-nums`} value={form.max_per_person} onChange={(e) => set("max_per_person", e.target.value)} />
              </Field>
              <Field label="Inn fra forrige runde (kr)" hint="Fylles ut automatisk når forrige runde gjøres opp.">
                <input type="number" className={`${input} tabular-nums`} value={form.carried_over} onChange={(e) => set("carried_over", e.target.value)} />
              </Field>
              <Field label="Kost på polet (kr)" hint={`La stå tom for å bruke summen av premieprisene (nå kr ${state.money.poletCost}).`}>
                <input type="number" className={`${input} tabular-nums`} value={form.polet_cost} onChange={(e) => set("polet_cost", e.target.value)} />
              </Field>
              <Field
                label="Sesongtema"
                hint={season ? "Pynter kjøpesiden. Gjelder bare denne runden." : "Kjøpesiden vises uten pynt."}
                wide
              >
                <select className={input} value={form.theme} onChange={(e) => set("theme", e.target.value)}>
                  <option value="none">Ingen</option>
                  {SEASONS.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.emoji} {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Beskjed på kjøpesiden" wide>
                <textarea className={input} rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
              </Field>
            </fieldset>
          </details>
        </fieldset>
      </form>

      {children}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" form="round-settings" disabled={busy || (locked && !fixable)} className={btn.primary}>
          {busy ? "Lagrer…" : r.status === "draft" ? "Lagre og åpne salget" : "Lagre"}
        </button>
        {r.status === "draft" && (
          <button type="submit" form="round-settings" value="draft" disabled={busy} className={btn.secondary}>
            Lagre uten å åpne
          </button>
        )}
        <p aria-live="polite" className="text-sm">
          {savedNote && <span className="font-medium text-sage">{savedNote}</span>}
          {errors.form && <span className="font-medium text-wine">{errors.form}</span>}
        </p>
      </div>
    </>
  );
}

function Field({
  label,
  hint,
  error,
  required,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`block text-sm ${wide ? "sm:col-span-2" : ""}`}>
      <span className="font-medium text-plum">
        {label}
        {required && <span className="text-wine"> *</span>}
      </span>
      {children}
      {error ? (
        <span data-error className="mt-1 block text-sm font-medium text-wine">{error}</span>
      ) : hint ? (
        <span className="mt-1 block text-xs text-plum/70">{hint}</span>
      ) : null}
    </label>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "1430", "14.30", "9:05" -> "14:30" / "09:05"; null when it isn't a time of day. */
function parseTime(t: string): string | null {
  const m = t.trim().match(/^(\d{1,2})(?:[:.]?(\d{2}))?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  return h < 24 && min < 60 ? `${pad(h)}:${pad(min)}` : null;
}

/**
 * Norwegian date + 24-hour time, with the same "YYYY-MM-DDTHH:MM" value as datetime-local. The
 * native datetime-local follows the browser's locale, so an English browser shows AM/PM.
 */
function DateTimeInput({
  label,
  value,
  onChange,
  invalid,
  clearable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  clearable?: boolean;
}) {
  const [date, timeOfValue] = value ? value.split("T") : ["", ""];
  const [time, setTime] = useState(timeOfValue);
  // Follow the value when it changes from outside (reload), not while someone is typing.
  useEffect(() => {
    setTime((t) => (parseTime(t) === timeOfValue ? t : timeOfValue));
  }, [timeOfValue]);

  const emit = (d: string, t: string) => {
    const parsed = parseTime(t);
    onChange(d && parsed ? `${d}T${parsed}` : d ? `${d}T${timeOfValue || "15:00"}` : "");
  };

  const field = `rounded-lg border bg-white px-3 py-2 text-base sm:text-sm ${invalid ? "border-wine ring-1 ring-wine" : "border-plum/20"}`;
  return (
    <span className="mt-1 flex gap-2">
      <DatePicker label={label} className={field} value={date} onChange={(d) => emit(d, time)} invalid={invalid} clearable={clearable} />
      <input
        className={`${field} w-20 shrink-0 text-center tabular-nums`}
        aria-label={`${label}, klokkeslett`}
        inputMode="numeric"
        placeholder="15:00"
        maxLength={5}
        value={time}
        onChange={(e) => {
          setTime(e.target.value);
          if (date && parseTime(e.target.value)) emit(date, e.target.value);
        }}
        onBlur={() => setTime(timeOfValue)}
      />
    </span>
  );
}

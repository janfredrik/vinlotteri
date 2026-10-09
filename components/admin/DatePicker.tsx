"use client";

import { useEffect, useRef, useState } from "react";
import { isoWeek } from "@/lib/datetime";

const pad = (n: number) => String(n).padStart(2, "0");
const toValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromValue = (v: string) => {
  const [y, m, d] = v.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
};
const WEEKDAYS = ["ma", "ti", "on", "to", "fr", "lø", "sø"];

/**
 * Norwegian date picker: Monday first, week numbers, "fredag 11. sep. 2026" on the button.
 * The native date input follows the browser's locale instead. Value is "YYYY-MM-DD" or "".
 */
export default function DatePicker({
  label,
  value,
  onChange,
  invalid,
  clearable,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  clearable?: boolean;
  className: string;
}) {
  const selected = fromValue(value);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = selected ?? new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const root = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && selected) setMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
    setOpen(!open);
  };
  const pick = (d: Date) => {
    onChange(toValue(d));
    setOpen(false);
  };

  // Six Monday-first weeks covering the month.
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + i)),
  );
  const today = toValue(new Date());
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1));

  return (
    <span ref={root} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`${label}, dato${selected ? `: ${selected.toLocaleDateString("nb-NO", { dateStyle: "full" })}` : ""}`}
        className={`${className} w-full truncate text-left ${invalid ? "border-wine ring-1 ring-wine" : ""} ${selected ? "" : "text-plum/60"}`}
      >
        {selected
          ? selected.toLocaleDateString("nb-NO", { weekday: "long", day: "numeric", month: "short", year: "numeric" })
          : "Velg dato"}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={label}
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded-xl border border-plum/15 bg-white p-3 text-plum shadow-[0_12px_32px_-12px_rgba(60,20,40,0.35)]"
        >
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="Forrige måned" className="h-8 w-8 rounded-lg text-lg hover:bg-parchment">
              ‹
            </button>
            <span className="text-sm font-semibold capitalize">
              {month.toLocaleDateString("nb-NO", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => shift(1)} aria-label="Neste måned" className="h-8 w-8 rounded-lg text-lg hover:bg-parchment">
              ›
            </button>
          </div>
          <table className="mt-2 w-full table-fixed text-center text-sm tabular-nums">
            <thead>
              <tr className="text-xs text-plum/60">
                <th className="w-8 font-normal">uke</th>
                {WEEKDAYS.map((d) => (
                  <th key={d} className="font-normal">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weeks.map((days) => (
                <tr key={toValue(days[0])}>
                  <td className="text-xs text-plum/60">{isoWeek(days[0])}</td>
                  {days.map((d) => {
                    const v = toValue(d);
                    const isSel = v === value;
                    const outside = d.getMonth() !== month.getMonth();
                    return (
                      <td key={v} className="p-0.5">
                        <button
                          type="button"
                          onClick={() => pick(d)}
                          aria-pressed={isSel}
                          aria-label={d.toLocaleDateString("nb-NO", { dateStyle: "full" })}
                          className={`h-8 w-full rounded-lg ${
                            isSel
                              ? "bg-wine font-semibold text-cream"
                              : `hover:bg-parchment ${outside ? "text-plum/35" : ""} ${v === today ? "ring-1 ring-wine/50" : ""}`
                          }`}
                        >
                          {d.getDate()}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex justify-between text-sm">
            <button type="button" onClick={() => pick(new Date())} className="font-semibold text-wine hover:underline">
              I dag
            </button>
            {clearable && value && (
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="text-plum/70 hover:underline"
              >
                Fjern
              </button>
            )}
          </div>
        </div>
      )}
    </span>
  );
}

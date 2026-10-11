"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { chooseMe, useMe } from "@/lib/me";
import { normName } from "@/lib/format";
import { MeSquare } from "./MeSquare";

const SEARCH_FROM = 10;
const MIGRATED_KEY = "vl_me_migrated";

/**
 * The part of the screen the on-screen keyboard leaves free, or null while it's closed.
 * A bottom sheet stays anchored behind the keyboard on phones (iOS doesn't resize the layout
 * for it), so while typing the sheet is placed in this area instead.
 */
function useKeyboardArea(active: boolean) {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!active || !vv) {
      setArea(null);
      return;
    }
    const update = () => {
      const covered = window.innerHeight - vv.height;
      setArea(covered > 120 ? { top: vv.offsetTop, height: vv.height } : null);
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [active]);
  return area;
}

/** Top-right profile: a mini grid square with your initials. Tap to pick who you are.
 *  With `label`, the same picker opens from a plain text button instead (e.g. inside Wrapped). */
export function MeButton({ label, className }: { label?: string; className?: string } = {}) {
  const me = useMe();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [names, setNames] = useState<string[] | null>(null);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fill, setFill] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [mounted, setMounted] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const prev = useRef<string | null | undefined>(undefined);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migrating = useRef(false);

  // Fill the square in once when a profile appears where there was none (not on page load).
  useEffect(() => {
    if (prev.current === null && me) {
      setFill(true);
      const t = setTimeout(() => setFill(false), 600);
      prev.current = me;
      return () => clearTimeout(t);
    }
    prev.current = me;
  }, [me]);

  // One-time move for devices from before profiles: the name last bought with (vl_name) becomes
  // the profile, if someone has bought under it. Once per device, so «Glem meg» stays forgotten.
  useEffect(() => {
    if (me === undefined || migrating.current) return;
    const done = () => {
      try {
        localStorage.setItem(MIGRATED_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    try {
      if (localStorage.getItem(MIGRATED_KEY)) return;
    } catch {
      return;
    }
    if (me) return done();
    let saved = "";
    try {
      saved = localStorage.getItem("vl_name")?.trim() ?? "";
    } catch {
      /* ignore */
    }
    if (saved.length < 2) return done();
    // Marked done only once it's settled, so a page load without network tries again next time.
    migrating.current = true;
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then(async (data) => {
        const list: unknown[] = Array.isArray(data?.names) ? data.names : [];
        const match = list.find((n): n is string => typeof n === "string" && normName(n) === normName(saved));
        if (!match) return done();
        await chooseMe(match);
        done();
        router.refresh();
        flash(`Du er ${match} på denne enheten.`);
      })
      .catch(() => {})
      .finally(() => {
        migrating.current = false;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me]);

  useEffect(() => {
    setMounted(true);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  // Load the list each time the sheet opens, then put focus somewhere sensible. The search
  // field only gets it with a mouse: on a phone the keyboard would cover the list.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setQ("");
    setError(null);
    setLoadFailed(false);
    fetch("/api/me", { cache: "no-store" })
      .then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        setNames(Array.isArray(data.names) ? data.names.filter((n: unknown) => typeof n === "string") : []);
      })
      .catch(() => {
        if (cancelled) return;
        setNames(null);
        setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, attempt]);

  useEffect(() => {
    if (!open || !names) return;
    const d = dialogRef.current;
    const finePointer = window.matchMedia("(pointer: fine)").matches;
    const active = d?.querySelector<HTMLElement>("[data-active]");
    const target =
      (finePointer && d?.querySelector<HTMLElement>("[data-search]")) ||
      active ||
      d?.querySelector<HTMLElement>("[data-close]");
    target?.focus();
    // With focus in the search field, still show where you are in the list.
    if (active && target !== active) active.scrollIntoView({ block: "center" });
  }, [open, names]);

  const shown = useMemo(() => {
    if (!names) return [];
    const needle = normName(q);
    return needle ? names.filter((n) => normName(n).includes(needle)) : names;
  }, [names, q]);

  function flash(msg: string) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    // Long messages stay up long enough to be read.
    toastTimer.current = setTimeout(() => setToast(null), Math.max(4000, msg.length * 70));
  }

  async function pick(name: string | null) {
    setBusy(true);
    setError(null);
    try {
      await chooseMe(name);
      setOpen(false);
      router.refresh();
      flash(name ? `Hei, ${name} 👋` : "Profilen er glemt på denne enheten.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const meNorm = me ? normName(me) : null;
  const kb = useKeyboardArea(open);

  return (
    <>
      {label ? (
        <button type="button" onClick={() => setOpen(true)} className={className}>
          {label}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label={me ? `Profil: ${me} – bytt` : "Velg hvem du er"}
          title={me ? `Du er ${me}` : "Hvem er du?"}
          className="-m-1 inline-flex h-11 w-11 items-center justify-center rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-wine"
        >
          {me === undefined ? (
            <span className="h-9 w-9" aria-hidden="true" />
          ) : (
            <MeSquare name={me} ring={!!me} fill={fill} />
          )}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="meg-tittel"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === dialogRef.current && !busy && setOpen(false)}
        className="mx-auto mb-4 mt-auto w-[calc(100%-2rem)] max-w-md animate-pop rounded-2xl bg-cream p-0 text-plum shadow-[0_20px_50px_-12px_rgba(44,10,20,0.45)] sm:my-auto"
        // Keyboard open: fill the visible area above it with a fixed height, so the sheet
        // neither hides behind the keyboard nor shrinks as the search narrows the list.
        style={kb ? { marginTop: kb.top + 8, marginBottom: "auto", maxHeight: kb.height - 16 } : undefined}
      >
        {open && (
          <div
            className="flex max-h-[min(36rem,calc(100dvh-3rem))] flex-col p-5"
            style={kb ? { height: kb.height - 16, maxHeight: kb.height - 16 } : undefined}
          >
            <div className="flex items-center justify-between">
              <h3 id="meg-tittel" className="font-display text-xl font-semibold text-wine">
                Hvem er du?
              </h3>
              <button
                type="button"
                data-close
                onClick={() => setOpen(false)}
                aria-label="Lukk"
                className="-my-2 -mr-2.5 inline-flex h-11 w-11 items-center justify-center rounded-full text-plum/60 transition-colors hover:bg-plum/5 hover:text-plum"
              >
                <svg
                  viewBox="0 0 20 20"
                  aria-hidden="true"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinecap="round"
                >
                  <path d="m5.5 5.5 9 9m0-9-9 9" />
                </svg>
              </button>
            </div>

            {names && names.length > SEARCH_FROM && (
              <label className="mt-4 block">
                <span className="sr-only">Søk etter navn</span>
                <input
                  data-search
                  type="search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Søk etter navn"
                  autoComplete="off"
                  className="w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base placeholder:text-plum/45"
                />
              </label>
            )}

            <div className="-mx-2 mt-3 min-h-0 flex-1 overflow-y-auto overscroll-contain px-2">
              {loadFailed ? (
                <p role="alert" className="py-4 text-sm text-plum/70">
                  Fikk ikke hentet navnene.{" "}
                  <button
                    type="button"
                    onClick={() => setAttempt((a) => a + 1)}
                    className="font-medium text-wine underline underline-offset-4"
                  >
                    Prøv igjen
                  </button>
                </p>
              ) : names === null ? (
                <p className="py-4 text-sm text-plum/60">
                  Henter navn
                  <span className="dots" />
                </p>
              ) : names.length === 0 ? (
                <p className="py-4 text-sm text-plum/70">
                  Ingen har kjøpt lodd ennå. Kjøp en rute, så blir du valgt automatisk.
                </p>
              ) : shown.length === 0 ? (
                <p className="py-4 text-sm text-plum/70">Ingen navn passer «{q.trim()}».</p>
              ) : (
                // Names are mostly short initials, so they sit as tiles in a grid (like the
                // squares themselves) instead of full-width rows.
                <ul className="grid grid-cols-2 gap-2 py-1 sm:grid-cols-3">
                  {shown.map((n) => {
                    const active = normName(n) === meNorm;
                    return (
                      <li key={n} className="min-w-0">
                        <button
                          type="button"
                          data-active={active || undefined}
                          disabled={busy}
                          aria-current={active || undefined}
                          onClick={() => (active ? setOpen(false) : pick(n))}
                          title={n}
                          className={`flex h-12 w-full items-center gap-2.5 rounded-lg border px-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-wine disabled:opacity-60 ${
                            active
                              ? "border-gold bg-gold-soft/40"
                              : "border-plum/10 bg-white hover:border-plum/25 hover:bg-parchment/50"
                          }`}
                        >
                          <MeSquare name={n} size="sm" />
                          <span
                            className={`min-w-0 flex-1 truncate ${active ? "font-semibold text-wine" : "font-medium"}`}
                          >
                            {n}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error && (
              <p role="alert" className="mt-2 text-sm text-wine">
                {error}
              </p>
            )}

            {me && (
              <button
                type="button"
                onClick={() => pick(null)}
                disabled={busy}
                className="mt-4 self-center py-1 text-sm text-plum/60 underline underline-offset-4 hover:text-wine"
              >
                Glem meg på denne enheten
              </button>
            )}
          </div>
        )}
      </dialog>

      {/* Portal: the header's backdrop-blur would otherwise make `fixed` relative to the header. */}
      {/* The live region stays mounted so screen readers announce each message. */}
      {mounted &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
          >
            {toast && (
              <div
                key={toast}
                className="w-max max-w-full animate-pop rounded-2xl bg-sage px-5 py-2 text-center text-sm font-medium text-white shadow-lg [overflow-wrap:anywhere]"
              >
                {toast}
              </div>
            )}
          </div>,
          document.body,
        )}
    </>
  );
}

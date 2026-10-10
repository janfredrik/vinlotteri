"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/* --------------------------------------------------------------- actions --- */

/** Runs an admin action with a busy flag and keeps the error message instead of swallowing it. */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | undefined> => {
    setBusy(true);
    setError(null);
    try {
      return await fn();
    } catch (e) {
      setError((e as Error).message || "Noe gikk galt. Prøv igjen.");
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);
  return { busy, error, setError, run };
}

export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="text-sm font-medium text-wine">
      {children}
    </p>
  );
}

/* --------------------------------------------------------------- buttons --- */

export const btn = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-wine px-5 py-2 font-semibold text-cream transition-colors hover:bg-wine-dark disabled:cursor-not-allowed disabled:bg-plum/25 disabled:text-plum/70",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-wine/40 bg-white px-4 py-2 font-semibold text-wine transition-colors hover:border-wine disabled:cursor-not-allowed disabled:opacity-50",
  quiet:
    "inline-flex min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-plum/70 underline-offset-4 hover:text-wine hover:underline disabled:cursor-not-allowed disabled:opacity-40",
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-wine-dark px-4 py-2 font-semibold text-cream hover:bg-plum",
};

/**
 * A two-step button for things that are hard to take back: the first press asks, the second does it.
 * Replaces the native confirm() dialog, which looks like it belongs to another app.
 */
export function ConfirmButton({
  children,
  question,
  confirmLabel,
  onConfirm,
  className = btn.quiet,
  disabled,
}: {
  children: ReactNode;
  question: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<unknown>;
  className?: string;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  const yes = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (armed) yes.current?.focus();
  }, [armed]);

  if (!armed)
    return (
      <button type="button" className={className} disabled={disabled} onClick={() => setArmed(true)}>
        {children}
      </button>
    );
  return (
    <span
      className="inline-flex flex-wrap items-center gap-2 text-sm text-plum"
      onKeyDown={(e) => e.key === "Escape" && setArmed(false)}
    >
      <span>{question}</span>
      <button
        ref={yes}
        type="button"
        className={btn.danger + " min-h-9 px-3 py-1 text-sm"}
        onClick={async () => {
          await onConfirm();
          setArmed(false);
        }}
      >
        {confirmLabel}
      </button>
      <button type="button" className={btn.quiet} onClick={() => setArmed(false)}>
        Avbryt
      </button>
    </span>
  );
}

/* ----------------------------------------------------------------- icons --- */

type IconProps = { className?: string };
const icon = (d: ReactNode) =>
  function Icon({ className = "h-4 w-4" }: IconProps) {
    return (
      <svg
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className={className}
      >
        {d}
      </svg>
    );
  };

export const IconCheck = icon(<path d="m4.5 10.5 3.5 3.5 7.5-8" />);
export const IconUp = icon(<path d="M10 15.5v-11M5.5 9 10 4.5 14.5 9" />);
export const IconDown = icon(<path d="M10 4.5v11M5.5 11l4.5 4.5 4.5-4.5" />);
export const IconTrash = icon(
  <path d="M4 6h12M8 6V4.5h4V6M5.5 6l.8 9.5h7.4l.8-9.5M8.5 9v4M11.5 9v4" />,
);
export const IconCamera = icon(
  <>
    <path d="M3 7.5A1.5 1.5 0 0 1 4.5 6h2l1.2-1.8h4.6L13.5 6h2A1.5 1.5 0 0 1 17 7.5v7a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5z" />
    <circle cx="10" cy="11" r="2.8" />
  </>,
);
export const IconChevron = icon(<path d="m6 8 4 4 4-4" />);
export const IconExternal = icon(<path d="M11 4.5h4.5V9M15.5 4.5 9 11M8 5.5H5.5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V12" />);
export const IconAlert = icon(<path d="M10 6.5v4M10 13.5v.01M8.7 3.3 2.6 14a1.5 1.5 0 0 0 1.3 2.2h12.2a1.5 1.5 0 0 0 1.3-2.2L11.3 3.3a1.5 1.5 0 0 0-2.6 0Z" />);
export const IconArrowRight = icon(<path d="M4.5 10h11M11 5.5l4.5 4.5-4.5 4.5" />);
/** GitHub's mark is a filled shape, so it doesn't go through the stroked `icon()` helper. */
export function IconGitHub({ className = "h-4 w-4" }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}
export const IconHelp = icon(
  <>
    <circle cx="10" cy="10" r="7" />
    <path d="M8 8.2a2 2 0 1 1 2.8 1.8c-.5.3-.8.7-.8 1.3v.2M10 14v.01" />
  </>,
);

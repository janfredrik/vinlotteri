"use client";

import { useCallback, useEffect, useState } from "react";
import type { RoundState } from "./types";

// A connect that hasn't opened by now is stuck (after sleep or a flaky VPN the request can hang
// in CONNECTING forever without ever erroring), and an open stream this quiet is dead: the server
// sends a ping every 25 s.
const OPEN_TIMEOUT = 8_000;
const SILENCE_LIMIT = 60_000;

export function useRoundState(roundId: number, initial: RoundState) {
  const [state, setState] = useState<RoundState>(initial);
  const [connected, setConnected] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch(`/api/rounds/${roundId}/state`, { cache: "no-store" });
      if (r.ok) setState(await r.json());
    } catch {
      /* keep last state */
    }
  }, [roundId]);

  useEffect(() => {
    let es: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    let backoff = 5_000;
    let lastSeen = Date.now();

    const scheduleRetry = () => {
      clearTimeout(retry);
      retry = setTimeout(connect, backoff);
      backoff = Math.min(backoff * 2, 30_000);
    };

    // Mobile browsers kill the stream when the tab is backgrounded or the phone sleeps, and
    // EventSource then often lands in CLOSED (or hangs in CONNECTING) and never retries on its
    // own. Reopen it ourselves.
    function connect() {
      clearTimeout(retry);
      clearTimeout(watchdog);
      es?.close();
      try {
        const s = new EventSource(`/api/rounds/${roundId}/stream`);
        es = s;
        s.onopen = () => {
          clearTimeout(watchdog);
          backoff = 5_000;
          lastSeen = Date.now();
          setConnected(true);
        };
        s.onmessage = (e) => {
          lastSeen = Date.now();
          if (e.data === "update") refresh();
        };
        s.onerror = () => {
          setConnected(false);
          if (s.readyState === EventSource.CLOSED) {
            clearTimeout(watchdog);
            scheduleRetry();
          }
        };
        watchdog = setTimeout(() => {
          if (s.readyState === EventSource.OPEN) return;
          s.close();
          setConnected(false);
          scheduleRetry();
        }, OPEN_TIMEOUT);
      } catch {
        /* fall back to polling */
      }
    }

    const stale = () =>
      !es || es.readyState !== EventSource.OPEN || Date.now() - lastSeen > SILENCE_LIMIT;

    // Coming back to the tab: catch up on what we missed and revive a dead stream right away.
    const onResume = (e: Event) => {
      if (e.type === "visibilitychange" && document.visibilityState !== "visible") return;
      refresh();
      if (stale()) {
        setConnected(false);
        backoff = 5_000;
        connect();
      }
    };

    // An already open stream can survive going offline (it stays OPEN until the silence check
    // catches it a minute later), so drop it as soon as the browser says the network is gone.
    const onOffline = () => {
      clearTimeout(watchdog);
      es?.close();
      setConnected(false);
      scheduleRetry();
    };

    connect();
    const poll = setInterval(() => {
      refresh();
      if (es?.readyState === EventSource.OPEN && Date.now() - lastSeen > SILENCE_LIMIT) {
        setConnected(false);
        connect();
      }
    }, 12_000);
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("online", onResume);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(retry);
      clearTimeout(watchdog);
      es?.close();
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("online", onResume);
      window.removeEventListener("offline", onOffline);
    };
  }, [roundId, refresh]);

  return { state, refresh, connected };
}

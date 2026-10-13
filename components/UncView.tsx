"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import type { PublicCell, RoundState } from "@/lib/types";
import { useRoundState } from "@/lib/useRoundState";
import { NAME_DISPLAY_MAX, formatPrice, gridLabel, normName } from "@/lib/format";
import { vinmonopoletImage } from "@/lib/vinmonopolet";
import { weekdayTime } from "@/lib/datetime";
import { ME_EVENT, chooseMe, useMe } from "@/lib/me";
import { type LocalHold, readLocalHolds, reconcileHolds, writeLocalHolds } from "@/lib/localHolds";

/* Unc mode: the round drawn as the old Excel sheet. The lottery sits in B3:G8 (column letter
 * B = lottery column 1, sheet row 3 = lottery row 1), prizes float to the right of it, the
 * ledger sits under it. Type a name into a free cell to reserve it; «Betalt» confirms it.
 * Squares are chequered white/red like the old sheet, winners yellow. */

const GRID_TOP = 3; // sheet row of lottery row 1
const GRID_LEFT = 2; // sheet column (B) of lottery column 1
const PRIZE_LEFT = 9; // column I

const GREEN = "#217346";
const CHECK_RED = "#B87470";
const WIN_YELLOW = "#FFFF00";
const SHEET_FONT = 'Aptos, Calibri, Carlito, "Segoe UI", Arial, sans-serif';
const GRID_FONT = 'Cambria, Caladea, Georgia, "Times New Roman", serif';

const letter = (c: number) => String.fromCharCode(64 + c);
const ref = (r: number, c: number) => `${letter(c)}${r}`;
const nok = (n: number) => `${n < 0 ? "-" : ""}${Math.abs(n)}`;

interface Sheetcell {
  v: ReactNode;
  /** What the formula bar shows; defaults to the plain text of v. */
  f?: string;
  className?: string;
  style?: CSSProperties;
}

interface Dialog {
  message: ReactNode;
  confirm?: { label: string; run: () => void };
}

export default function UncView({
  roundId,
  initial,
  initialMe,
  sheets,
}: {
  roundId: number;
  initial: RoundState;
  initialMe: string | null;
  sheets: { id: number; title: string }[];
}) {
  const { state, refresh, connected } = useRoundState(roundId, initial);
  const me = useMe(initialMe);
  const { round, prizes, cells, draws, money, salesOpen, restrictionActive, vipps } = state;
  const size = round.grid_size;

  const [holds, setHolds] = useState<LocalHold[]>([]);
  const [sel, setSel] = useState({ r: GRID_TOP, c: GRID_LEFT });
  const [edit, setEdit] = useState<string | null>(null);
  const [pending, setPending] = useState<Map<string, string>>(new Map());
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const sheetRef = useRef<HTMLDivElement>(null);
  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Enter, Tab, Escape and blur can all end one edit; only the first one counts.
  const editDone = useRef(false);

  useEffect(() => {
    setHolds(readLocalHolds(roundId));
  }, [roundId]);

  useEffect(() => {
    window.addEventListener(ME_EVENT, refresh);
    return () => window.removeEventListener(ME_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    setHolds((prev) => {
      const next = reconcileHolds(prev, cells);
      if (next.length !== prev.length) writeLocalHolds(roundId, next);
      return next;
    });
    // Optimistic names go once the server shows the square as taken.
    setPending((prev) => {
      if (!prev.size) return prev;
      const next = new Map(prev);
      for (const c of cells) if (c.status !== "available") next.delete(`${c.row},${c.col}`);
      return next.size === prev.size ? prev : next;
    });
  }, [cells, roundId]);

  // The sheet is the whole window; the page behind shouldn't scroll along.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus({ preventScroll: true });
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => () => {
    if (statusTimer.current) clearTimeout(statusTimer.current);
  }, []);

  const say = useCallback((msg: string) => {
    setStatus(msg);
    if (statusTimer.current) clearTimeout(statusTimer.current);
    statusTimer.current = setTimeout(() => setStatus(null), Math.max(5000, msg.length * 80));
  }, []);

  const post = useCallback(
    async (body: Record<string, unknown>) => {
      let r: Response;
      try {
        r = await fetch(`/api/rounds/${roundId}/cells`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
      } catch {
        throw new Error("Fikk ikke kontakt med serveren. Sjekk nettet og prøv igjen.");
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok)
        throw new Error(
          r.status === 401
            ? "Tilgangen har gått ut. Last siden på nytt og skriv inn PIN-en."
            : data.error || "Noe gikk galt.",
        );
      return data;
    },
    [roundId],
  );

  /* ------------------------------------------------------------ the sheet --- */

  const cellAt = useMemo(() => new Map(cells.map((c) => [`${c.row},${c.col}`, c] as [string, PublicCell])), [cells]);
  const holdAt = useMemo(() => new Map(holds.map((h) => [`${h.row},${h.col}`, h])), [holds]);
  const wins = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of draws) {
      if (!d.row || !d.col || !d.winnerName) continue;
      const key = `${d.row},${d.col}`;
      if (!m.has(key) || d.rank < m.get(key)!) m.set(key, d.rank);
    }
    return m;
  }, [draws]);

  const lotteryAt = (r: number, c: number) => {
    const row = r - GRID_TOP + 1;
    const col = c - GRID_LEFT + 1;
    return row >= 1 && row <= size && col >= 1 && col <= size ? { row, col, key: `${row},${col}` } : null;
  };

  const winners = draws.filter((d) => d.winnerName);
  const prizeCols = Math.max(4, prizes.length) * 2;
  const colCount = Math.min(26, Math.max(17, PRIZE_LEFT + prizeCols));
  const rowCount = Math.max(32, 16 + winners.length + 6);

  const colWidth = (c: number) => (c === 1 ? 64 : c >= GRID_LEFT && c < GRID_LEFT + size ? 100 : c === 8 ? 64 : 110);
  const rowHeight = (r: number) => (r === 2 ? 52 : r >= GRID_TOP && r < GRID_TOP + size ? 64 : r === 13 ? 30 : 24);

  const fixed = useMemo(() => {
    const m = new Map<string, Sheetcell>();
    const put = (r: number, c: number, cell: Sheetcell) => m.set(ref(r, c), cell);
    const big = { fontFamily: GRID_FONT, fontSize: 22 };

    for (let i = 1; i <= size; i++) {
      put(2, GRID_LEFT + i - 1, { v: i, className: "justify-center", style: big });
      put(GRID_TOP + i - 1, 1, { v: i, className: "justify-center", style: big });
    }

    // Ledger, under the lottery.
    const D = 4;
    const G = 7;
    put(11, D, { v: "Pengestats", className: "font-bold" });
    put(12, G, { v: "Sum", className: "justify-end font-bold" });
    put(13, D, { v: "Inn fra forrige gang" });
    put(13, G, { v: nok(money.carriedOver), className: "justify-end" });
    put(14, D, { v: "Lodd solgt" });
    put(14, 6, { v: "+", className: "justify-center" });
    put(14, G, { v: nok(money.loddSolgt), f: `=${money.sold}*${money.ticketPrice}`, className: "justify-end text-[#5B9BD5]" });
    put(15, D, { v: "Kost på polet" });
    put(15, 6, { v: "-", className: "justify-center" });
    put(15, G, {
      v: nok(money.poletCost),
      f: money.poletCostAuto ? `=SUMMER(${prizes.map((p) => formatPrice(p.price ?? 0)).join(";") || 0})` : undefined,
      className: "justify-end text-[#C00000]",
    });
    put(16, D, { v: "Videre", className: "font-bold" });
    put(16, G, {
      v: nok(money.videre),
      f: "=G13+G14-G15",
      className: "justify-end font-bold",
      style: { borderTop: "3px double #000" },
    });

    // Rules and Vipps, right of the ledger.
    const I = PRIZE_LEFT;
    put(10, I, { v: `${round.ticket_price},- per lodd.` });
    if (round.max_per_person > 0)
      put(11, I, {
        v: restrictionActive
          ? `Maks ${round.max_per_person} lodd per person${round.restriction_lifts_at ? ` frem til ${weekdayTime(round.restriction_lifts_at)}` : ""}.`
          : `Maksgrensen på ${round.max_per_person} lodd er opphevet. Kjøp så mye du vil.`,
      });
    if (round.sales_close_at) put(12, I, { v: `Salget stenger ${weekdayTime(round.sales_close_at)}.` });
    if (vipps?.number) {
      const pretty = vipps.number.replace(/(\d{3})(\d{2})(\d{3})/, "$1 $2 $3");
      put(13, I, {
        v: `VIPPS: ${round.organizer_name ? `(${round.organizer_name}) ` : ""}${pretty}`,
        style: { fontSize: 20 },
      });
    }
    put(15, I, { v: "Vinnere:" });
    winners.forEach((d, i) => {
      const prize = d.prizeName ? ` (${d.prizeName.split(/\s+/).slice(0, 2).join(" ")})` : "";
      put(16 + i, I, { v: `${d.rank}: ${d.winnerName}${prize}` });
    });
    return m;
  }, [size, money, prizes, round, restrictionActive, vipps, winners]);

  const lotteryText = (key: string) => pending.get(key) ?? cellAt.get(key)?.name ?? "";

  const canWrite = (r: number, c: number) => {
    const l = lotteryAt(r, c);
    if (!l || !salesOpen || pending.has(l.key)) return false;
    return (cellAt.get(l.key)?.status ?? "available") === "available";
  };

  const selLottery = lotteryAt(sel.r, sel.c);
  const selHold = selLottery ? holdAt.get(selLottery.key) : undefined;
  const formula =
    edit ??
    (selLottery ? lotteryText(selLottery.key) : (() => {
      const f = fixed.get(ref(sel.r, sel.c));
      if (!f) return "";
      return f.f ?? (typeof f.v === "string" || typeof f.v === "number" ? String(f.v) : "");
    })());

  /* ---------------------------------------------------------- actions --- */

  function move(dr: number, dc: number) {
    setSel((s) => ({ r: Math.min(rowCount, Math.max(1, s.r + dr)), c: Math.min(colCount, Math.max(1, s.c + dc)) }));
  }

  function startEdit(initialText = "") {
    if (!canWrite(sel.r, sel.c)) {
      if (lotteryAt(sel.r, sel.c) && !salesOpen) say("Arket er skrivebeskyttet. Loddsalget er stengt.");
      else if (lotteryAt(sel.r, sel.c)) say("Cellen er opptatt.");
      return;
    }
    editDone.current = false;
    setEdit(initialText);
  }

  async function commit(dr: number, dc: number) {
    if (editDone.current || edit === null) return;
    editDone.current = true;
    const name = edit.trim();
    const l = lotteryAt(sel.r, sel.c);
    setEdit(null);
    move(dr, dc);
    sheetRef.current?.focus({ preventScroll: true });
    if (!l || !name) return;
    if (name.length < 2) {
      setDialog({ message: "Navnet må ha minst to tegn." });
      return;
    }
    setPending((p) => new Map(p).set(l.key, name));
    setBusy(true);
    try {
      const data = await post({ action: "hold", row: l.row, col: l.col, name });
      setHolds((prev) => {
        const next = [...prev, { cellId: data.cellId, row: l.row, col: l.col, name }];
        writeLocalHolds(roundId, next);
        return next;
      });
      try {
        localStorage.setItem("vl_name", name);
      } catch {
        /* ignore */
      }
      if (me === null) chooseMe(name).catch(() => {});
      say(`${ref(sel.r, sel.c)} er reservert. Vipps Kr ${round.ticket_price},- og trykk Betalt når du har gjort det.`);
    } catch (e) {
      setPending((p) => {
        const next = new Map(p);
        next.delete(l.key);
        return next;
      });
      setDialog({ message: (e as Error).message });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  function cancelEdit() {
    editDone.current = true;
    setEdit(null);
    sheetRef.current?.focus({ preventScroll: true });
  }

  async function release(hold: LocalHold) {
    setBusy(true);
    try {
      await post({ action: "release", cellId: hold.cellId });
      setHolds((prev) => {
        const next = prev.filter((h) => h.cellId !== hold.cellId);
        writeLocalHolds(roundId, next);
        return next;
      });
      say("Innholdet er fjernet, og ruten er ledig igjen.");
    } catch (e) {
      setDialog({ message: (e as Error).message });
    } finally {
      setBusy(false);
      refresh();
    }
  }

  async function confirmAll() {
    setDialog(null);
    setBusy(true);
    const done: number[] = [];
    let failure: string | null = null;
    for (const h of holds) {
      try {
        await post({ action: "confirm", cellId: h.cellId });
        done.push(h.cellId);
      } catch (e) {
        failure = (e as Error).message;
      }
    }
    const left = holds.filter((h) => !done.includes(h.cellId));
    setHolds(left);
    writeLocalHolds(roundId, left);
    setBusy(false);
    refresh();
    if (failure) setDialog({ message: failure });
    else say(done.length > 1 ? `${done.length} lodd registrert. Lykke til 🍀` : "Registrert. Lykke til 🍀");
  }

  function askPay() {
    if (!holds.length) {
      say("Betalt brukes til å markere egne celler som betalt. Skriv navnet ditt i en ledig celle først.");
      return;
    }
    const refs = holds.map((h) => ref(h.row + GRID_TOP - 1, h.col + GRID_LEFT - 1)).join(", ");
    const sum = round.ticket_price * holds.length;
    setDialog({
      message: (
        <>
          Har du vippset <strong>Kr {sum},-</strong>
          {round.organizer_name ? ` til ${round.organizer_name}` : ""}
          {vipps?.number ? ` (${vipps.number})` : ""} for {holds.length > 1 ? "cellene" : "cellen"} {refs}?
        </>
      ),
      confirm: { label: "Ja, jeg har betalt", run: confirmAll },
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (edit !== null || dialog) return;
    const k = e.key;
    const arrows: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    if (arrows[k]) {
      e.preventDefault();
      move(...arrows[k]);
    } else if (k === "Tab") {
      e.preventDefault();
      move(0, e.shiftKey ? -1 : 1);
    } else if (k === "Enter") {
      e.preventDefault();
      if (canWrite(sel.r, sel.c)) startEdit();
      else move(e.shiftKey ? -1 : 1, 0);
    } else if (k === "F2") {
      e.preventDefault();
      startEdit();
    } else if (k === "Delete" || k === "Backspace") {
      e.preventDefault();
      if (selHold) release(selHold);
      else if (selLottery && cellAt.get(selLottery.key)?.status !== "available") say("Du kan bare fjerne dine egne, ubetalte celler.");
    } else if (k.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (canWrite(sel.r, sel.c)) {
        e.preventDefault();
        startEdit(k);
      } else if (selLottery) startEdit();
    }
  }

  // Keep the selected cell in view while moving with the keyboard.
  // Done by hand: scrollIntoView doesn't know about the sticky headers.
  useEffect(() => {
    const box = sheetRef.current;
    const el = box?.querySelector(`[data-ref="${ref(sel.r, sel.c)}"]`);
    if (!box || !el) return;
    const z = zoom / 100;
    const b = box.getBoundingClientRect();
    const e = el.getBoundingClientRect();
    const top = e.top - b.top - 22 * z;
    const bottom = e.bottom - b.top - box.clientHeight;
    const left = e.left - b.left - 40 * z;
    const right = e.right - b.left - box.clientWidth;
    if (top < 0) box.scrollTop += top;
    else if (bottom > 0) box.scrollTop += bottom;
    if (left < 0) box.scrollLeft += left;
    else if (right > 0) box.scrollLeft += right;
  }, [sel, zoom]);

  /* ------------------------------------------------------------ render --- */

  const knownNames = useMemo(() => {
    const names = new Map<string, string>();
    for (const n of [me, ...cells.map((c) => c.name)]) {
      if (n && n.trim().length <= NAME_DISPLAY_MAX) names.set(normName(n), n.trim());
    }
    return [...names.values()];
  }, [cells, me]);

  const myHeld = holds.length;
  const defaultStatus = !salesOpen
    ? round.status === "drawn" || round.status === "settled"
      ? "Trekningen er ferdig. Arket er skrivebeskyttet."
      : "Loddsalget er stengt. Arket er skrivebeskyttet."
    : myHeld
      ? `Du har ${myHeld} ubetalt${myHeld > 1 ? "e" : ""} celle${myHeld > 1 ? "r" : ""}. Vipps Kr ${round.ticket_price * myHeld},- og trykk Betalt.`
      : "Skriv navnet ditt i en ledig celle for å kjøpe lodd.";


  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white text-[13px] text-black"
      style={{ fontFamily: SHEET_FONT }}
    >
      {/* Title bar */}
      <div className="flex h-9 shrink-0 items-center gap-3 px-3 text-white" style={{ background: GREEN }}>
        <span className="flex items-center gap-1.5 text-xs">
          Autolagring
          <span
            className={`inline-flex h-3.5 w-7 items-center rounded-full border border-white/80 px-0.5 ${connected ? "justify-end bg-white/30" : "justify-start"}`}
            title={connected ? "Live" : "Kobler til …"}
          >
            <span className="h-2 w-2 rounded-full bg-white" />
          </span>
          {connected ? "På" : "Av"}
        </span>
        <span className="flex-1 truncate text-center text-[13px]">Vinlotteri.xlsx</span>
        <Link href={`/runde/${roundId}`} className="rounded px-2 text-lg leading-none hover:bg-[#E81123]" aria-label="Lukk arket">
          ×
        </Link>
      </div>

      {/* Ribbon */}
      <div className="shrink-0 border-b border-[#d4d4d4] bg-[#f3f3f3]">
        <div className="flex gap-4 overflow-x-auto px-3 pt-1 text-[13px] whitespace-nowrap">
          {["Fil", "Hjem", "Sett inn", "Sideoppsett", "Formler", "Data", "Se gjennom", "Visning"].map((t) => (
            <span
              key={t}
              className={t === "Hjem" ? "border-b-[3px] pb-0.5 font-semibold" : "pb-1 text-[#444]"}
              style={t === "Hjem" ? { borderColor: GREEN, color: GREEN } : undefined}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex items-stretch gap-1 overflow-x-auto bg-white px-2 py-1.5">
          <div className="flex flex-col justify-center gap-1 border-r border-[#e1e1e1] pr-2">
            <div className="flex gap-1">
              <span className="w-28 border border-[#c8c8c8] px-1 text-xs leading-5">Calibri</span>
              <span className="w-9 border border-[#c8c8c8] px-1 text-xs leading-5">11</span>
            </div>
            <div className="flex gap-0.5 text-xs text-[#999]">
              <span className="w-5 text-center font-bold">F</span>
              <span className="w-5 text-center italic">K</span>
              <span className="w-5 text-center underline">U</span>
            </div>
          </div>
          <RibbonButton
            onClick={askPay}
            disabled={busy || !salesOpen}
            title="Marker dine celler som betalt"
            label="Betalt"
            active={myHeld > 0}
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <rect x="3.5" y="3.5" width="17" height="17" rx="1.5" fill="none" stroke="#444" strokeWidth="1.6" />
              <path d="m7.5 12.5 3 3 6-7" fill="none" stroke="#217346" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </RibbonButton>
          <RibbonButton
            onClick={() => selHold && release(selHold)}
            disabled={busy || !selHold || !salesOpen}
            title="Fjern innhold: frigi din ubetalte celle"
            label="Fjern"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
              <path d="m4 15 8-8 6 6-5 5H7z" fill="none" stroke="#444" strokeWidth="1.6" strokeLinejoin="round" />
              <path d="m8 11 6 6M13 18h7" stroke="#C00000" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </RibbonButton>
          <div className="ml-auto hidden items-center pr-2 text-xs text-[#666] sm:flex">
            {busy ? "Lagrer …" : connected ? "Alle endringer er lagret" : "Kobler til …"}
          </div>
        </div>
      </div>

      {/* Formula bar */}
      <div className="flex h-7 shrink-0 items-center border-b border-[#d4d4d4] bg-white text-[13px]">
        <div className="flex h-full w-20 items-center border-r border-[#d4d4d4] px-2">{ref(sel.r, sel.c)}</div>
        <div className="flex h-full items-center border-r border-[#d4d4d4] px-2 italic text-[#666]">fx</div>
        <div className="min-w-0 flex-1 truncate px-2">{formula}</div>
      </div>

      {/* Sheet */}
      <div
        ref={sheetRef}
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative min-h-0 flex-1 overflow-auto outline-none"
        aria-label="Regneark"
      >
        <div
          className="grid w-max"
          style={{
            zoom: zoom / 100,
            gridTemplateColumns: `40px ${Array.from({ length: colCount }, (_, i) => `${colWidth(i + 1)}px`).join(" ")}`,
            gridTemplateRows: `22px ${Array.from({ length: rowCount }, (_, i) => `${rowHeight(i + 1)}px`).join(" ")}`,
          }}
        >
          <div className="sticky left-0 top-0 z-30 border-b border-r border-[#c8c8c8] bg-[#e6e6e6]" />
          {Array.from({ length: colCount }, (_, i) => {
            const c = i + 1;
            const on = sel.c === c;
            return (
              <div
                key={`h${c}`}
                className="sticky top-0 z-20 flex items-center justify-center border-b border-r border-[#c8c8c8] text-xs"
                style={on ? { background: "#d2e8dc", color: GREEN, borderBottom: `2px solid ${GREEN}` } : { background: "#f3f3f3", color: "#444" }}
              >
                {letter(c)}
              </div>
            );
          })}

          {Array.from({ length: rowCount }, (_, i) => {
            const r = i + 1;
            const on = sel.r === r;
            return [
              <div
                key={`r${r}`}
                className="sticky left-0 z-20 flex items-end justify-start border-b border-r border-[#c8c8c8] pb-0.5 pl-1 text-xs"
                style={{
                  gridRow: r + 1,
                  gridColumn: 1,
                  ...(on ? { background: "#d2e8dc", color: GREEN, borderRight: `2px solid ${GREEN}` } : { background: "#f3f3f3", color: "#444" }),
                }}
              >
                {r}
              </div>,
              ...Array.from({ length: colCount }, (_, j) => {
                const c = j + 1;
                const id = ref(r, c);
                const selected = sel.r === r && sel.c === c;
                const l = lotteryAt(r, c);
                const pos = { gridRow: r + 1, gridColumn: c + 1 };
                const select = () => {
                  if (edit !== null) {
                    if (selected) return;
                    commit(0, 0);
                  } else if (selected && canWrite(r, c)) return startEdit();
                  setSel({ r, c });
                  sheetRef.current?.focus({ preventScroll: true });
                };

                if (l) {
                  const cell = cellAt.get(l.key);
                  const pend = pending.get(l.key);
                  const won = wins.has(l.key);
                  const paid = cell?.status === "sold";
                  const mine = holdAt.has(l.key) || cell?.mine;
                  const editing = selected && edit !== null;
                  return (
                    <div
                      key={id}
                      data-ref={id}
                      onMouseDown={(e) => editing || e.preventDefault()}
                      onClick={select}
                      onDoubleClick={() => edit === null && startEdit()}
                      className="relative flex items-center justify-center overflow-hidden border-b border-r border-black"
                      style={{
                        ...pos,
                        fontFamily: GRID_FONT,
                        fontSize: 22,
                        background: won ? WIN_YELLOW : (l.row + l.col) % 2 === 0 ? CHECK_RED : "#fff",
                        color: pend ? "#888" : "#000",
                        borderTop: r === GRID_TOP ? "1px solid #000" : undefined,
                        borderLeft: c === GRID_LEFT ? "1px solid #000" : undefined,
                      }}
                      title={mine && cell?.status === "held" ? "Din reservasjon. Vipps og trykk Betalt." : undefined}
                    >
                      {editing ? (
                        <CellEditor
                          value={edit}
                          names={knownNames}
                          onChange={setEdit}
                          onCommit={(dr, dc) => commit(dr, dc)}
                          onCancel={cancelEdit}
                        />
                      ) : (
                        <span className="truncate px-1">{gridLabel(pend ?? cell?.name ?? null)}</span>
                      )}
                      {mine && !paid && !editing && (
                        <span
                          aria-hidden="true"
                          className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent"
                          style={{ borderTopColor: "#C00000" }}
                        />
                      )}
                      {selected && !editing && <Selection />}
                    </div>
                  );
                }

                const f = fixed.get(id);
                return (
                  <div
                    key={id}
                    data-ref={id}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={select}
                    className={`relative flex items-center whitespace-nowrap border-b border-r border-[#e1e1e1] px-1 ${f ? "z-[1]" : ""} ${f?.className ?? ""}`}
                    style={{ ...pos, ...f?.style }}
                  >
                    {f && <span className="bg-white">{f.v}</span>}
                    {selected && <Selection />}
                  </div>
                );
              }),
            ];
          })}

          {/* Prize pictures float over the cells, like images pasted in from vinmonopolet.no. */}
          {prizes.map((p, i) => {
            const img = p.image_url || vinmonopoletImage(p.varenummer);
            return (
              <div
                key={p.id}
                className="z-[5] m-1 flex flex-col overflow-hidden bg-white p-2"
                style={{ gridRow: `${GRID_TOP + 1} / span ${size}`, gridColumn: `${PRIZE_LEFT + 1 + i * 2} / span 2` }}
              >
                <div className="flex h-36 shrink-0 items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {img ? <img src={img} alt="" className="h-full w-auto object-contain" /> : <span className="text-4xl">🍾</span>}
                </div>
                {p.category && (
                  <div className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-[#555]">{p.category}</div>
                )}
                <div className="text-[15px] leading-tight text-[#1a3a5c]" style={{ fontFamily: GRID_FONT }}>
                  {p.name}
                </div>
                {p.varenummer && <div className="mt-1 text-[10px] text-[#666]">{p.varenummer}</div>}
                {p.price != null && (
                  <div className="mt-auto text-xl font-bold text-[#1a3a5c]">
                    Kr {formatPrice(p.price)}
                    {p.volume && <span className="ml-1 text-xs font-normal">{p.volume}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Sheet tabs: one per round */}
      <SheetTabs sheets={sheets} current={roundId} />

      {/* Status bar */}
      <div className="flex h-6 shrink-0 items-center gap-3 px-3 text-xs text-white" style={{ background: GREEN }}>
        <span>{edit !== null ? "Rediger" : "Klar"}</span>
        <span className="min-w-0 flex-1 truncate">{status ?? defaultStatus}</span>
        <span className="hidden sm:inline">Antall: {money.sold}</span>
        <button type="button" onClick={() => setZoom((z) => Math.max(50, z - 10))} className="px-1" aria-label="Zoom ut">
          −
        </button>
        <span className="w-10 text-center">{zoom} %</span>
        <button type="button" onClick={() => setZoom((z) => Math.min(200, z + 10))} className="px-1" aria-label="Zoom inn">
          +
        </button>
      </div>

      {dialog && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/10 p-4">
          <div role="alertdialog" aria-modal="true" className="w-full max-w-sm border border-[#888] bg-white shadow-xl">
            <div className="flex items-center justify-between px-3 py-1.5 text-xs">
              <span>Vinlotteri</span>
              <button type="button" onClick={() => setDialog(null)} aria-label="Lukk" className="px-1 text-base leading-none">
                ×
              </button>
            </div>
            <div className="flex gap-3 px-4 py-3">
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ background: dialog.confirm ? "#2B78E4" : "#E8A33D" }}
              >
                {dialog.confirm ? "?" : "!"}
              </span>
              <p className="pt-1 leading-snug">{dialog.message}</p>
            </div>
            <div className="flex justify-end gap-2 bg-[#f3f3f3] px-4 py-2.5">
              {dialog.confirm && (
                <button
                  type="button"
                  autoFocus
                  onClick={dialog.confirm.run}
                  className="min-w-20 border px-3 py-1 text-white"
                  style={{ background: GREEN, borderColor: GREEN }}
                >
                  {dialog.confirm.label}
                </button>
              )}
              <button
                type="button"
                autoFocus={!dialog.confirm}
                onClick={() => {
                  setDialog(null);
                  sheetRef.current?.focus({ preventScroll: true });
                }}
                className="min-w-20 border border-[#adadad] bg-[#e1e1e1] px-3 py-1"
              >
                {dialog.confirm ? "Avbryt" : "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Excel's tab strip: arrows bottom left scroll it, a tab opens that round. The year is left off
 *  tabs from the same year as the open round ("Uke 39"), and kept on older ones. */
function SheetTabs({ sheets, current }: { sheets: { id: number; title: string }[]; current: number }) {
  const strip = useRef<HTMLDivElement>(null);
  const year = sheets.find((s) => s.id === current)?.title.match(/(\d{4})\s*$/)?.[1];
  const label = (s: { id: number; title: string }) => {
    const t = s.title || `Runde ${s.id}`;
    return (year ? t.replace(new RegExp(`\\s*[–-]\\s*${year}\\s*$`), "") : t).slice(0, 31);
  };

  useEffect(() => {
    strip.current?.querySelector("[aria-current]")?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [current]);

  const scroll = (dir: number) => strip.current?.scrollBy({ left: dir * 240, behavior: "smooth" });

  return (
    <div className="flex h-8 shrink-0 items-stretch border-t border-[#d4d4d4] bg-[#f3f3f3] text-[13px]">
      <div className="flex shrink-0 items-center gap-1 px-2 text-[#444]">
        <button type="button" onClick={() => scroll(-1)} aria-label="Rull fanene til venstre" className="px-1 hover:text-black">
          ◀
        </button>
        <button type="button" onClick={() => scroll(1)} aria-label="Rull fanene til høyre" className="px-1 hover:text-black">
          ▶
        </button>
      </div>
      <div ref={strip} className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]">
        {sheets.map((s) =>
          s.id === current ? (
            <span
              key={s.id}
              aria-current="page"
              className="flex shrink-0 items-center border-x border-[#d4d4d4] bg-white px-5 font-semibold shadow-[inset_0_-3px_0]"
              style={{ color: GREEN }}
            >
              {label(s)}
            </span>
          ) : (
            <Link
              key={s.id}
              href={`/runde/${s.id}/unc`}
              className="flex shrink-0 items-center border-r border-[#d4d4d4] px-5 text-[#333] hover:bg-[#e6e6e6]"
            >
              {label(s)}
            </Link>
          ),
        )}
      </div>
    </div>
  );
}

function Selection() {
  return (
    <span aria-hidden="true" className="pointer-events-none absolute -inset-px z-10" style={{ border: `2px solid ${GREEN}` }}>
      <span className="absolute -bottom-[4px] -right-[4px] h-[6px] w-[6px] border border-white" style={{ background: GREEN }} />
    </span>
  );
}

function RibbonButton({
  onClick,
  disabled,
  title,
  label,
  active,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title: string;
  label: string;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`flex min-w-14 flex-col items-center justify-center gap-0.5 rounded px-2 text-[11px] hover:bg-[#e6e6e6] disabled:opacity-40 ${active ? "bg-[#e6f2ea] outline outline-1 outline-[#9fc9b0]" : ""}`}
    >
      {children}
      {label}
    </button>
  );
}

/** The in-cell editor, with Excel's AutoComplete: typing the start of a name already in the
 *  sheet fills in the rest, selected, so one more keystroke replaces it. */
function CellEditor({
  value,
  names,
  onChange,
  onCommit,
  onCancel,
}: {
  value: string;
  names: string[];
  onChange: (v: string) => void;
  onCommit: (dr: number, dc: number) => void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const suggest = useRef<{ from: number; to: number } | null>(null);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.focus();
    const s = suggest.current;
    if (s) el.setSelectionRange(s.from, s.to);
    else el.setSelectionRange(el.value.length, el.value.length);
  }, [value]);

  return (
    <input
      ref={inputRef}
      value={value}
      maxLength={NAME_DISPLAY_MAX}
      autoCapitalize="words"
      autoComplete="off"
      spellCheck={false}
      aria-label="Navn"
      onChange={(e) => {
        const typed = e.target.value;
        const deleting = (e.nativeEvent as InputEvent).inputType?.startsWith("delete");
        // Like Excel, only suggest when exactly one name fits.
        const fits = deleting || !typed ? [] : names.filter((n) => n.toLowerCase().startsWith(typed.toLowerCase()));
        const hit = fits.length === 1 && fits[0].length > typed.length ? fits[0] : undefined;
        if (hit) {
          suggest.current = { from: typed.length, to: hit.length };
          onChange(typed + hit.slice(typed.length));
        } else {
          suggest.current = null;
          onChange(typed);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onCommit(e.shiftKey ? -1 : 1, 0);
        } else if (e.key === "Tab") {
          e.preventDefault();
          onCommit(0, e.shiftKey ? -1 : 1);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => onCommit(0, 0)}
      className="absolute inset-0 z-20 w-full bg-white px-1 text-center outline-none"
      style={{ fontFamily: GRID_FONT, fontSize: 22, border: `2px solid ${GREEN}` }}
    />
  );
}

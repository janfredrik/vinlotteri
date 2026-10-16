"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { api, imageFrom, ocrPrizeImage, roundAction, uploadPrizeImage } from "@/lib/adminApi";
import { formatPrice } from "@/lib/format";
import { varenummerFromUrl, vinmonopoletImage } from "@/lib/vinmonopolet";
import type { AdminRoundState } from "@/lib/adminTypes";
import type { Prize } from "@/lib/types";
import { ConfirmButton, ErrorNote, IconCamera, IconCheck, IconDown, IconTrash, IconUp, btn, useAction } from "./ui";

const EMPTY = { varenummer: "", name: "", price: "", volume: "", category: "", image_url: "" };
type Draft = typeof EMPTY;

export default function Prizes({
  state,
  reload,
  locked,
  fixable = false,
  flushRef,
}: {
  state: AdminRoundState;
  reload: () => void;
  locked: boolean;
  /** Locked, but history editing is on: each prize's details can still be corrected. */
  fixable?: boolean;
  /** Set to a function that saves whatever is in the form, so the page's Lagre button doesn't drop it. */
  flushRef?: MutableRefObject<(() => Promise<void>) | null>;
}) {
  const roundId = state.round.id;
  const [draft, setDraft] = useState(EMPTY);
  // Mirror of `draft` that async code (scan → lookup → save) can read without waiting for a render.
  const draftRef = useRef(EMPTY);
  function patch(fn: (d: Draft) => Draft) {
    draftRef.current = fn(draftRef.current);
    setDraft(draftRef.current);
  }
  // A scanned prize is added straight away; the form then keeps showing it, and edits update that prize.
  const [addedId, setAddedId] = useState<number | null>(null);
  const addedRef = useRef<number | null>(null);
  const [saved, setSaved] = useState("");
  const savedRef = useRef("");
  const dirty = addedId != null && JSON.stringify(draft) !== saved;
  const added = state.prizes.find((p) => p.id === addedId);
  const seenAdded = useRef(false);
  function setAdded(id: number | null) {
    addedRef.current = id;
    seenAdded.current = false;
    setAddedId(id);
    setFixing(false);
  }
  // Once added, the form shows a receipt of the prize; the fields only come back to fix something.
  const [fixing, setFixing] = useState(false);
  // Where the added prize's details came from, so the receipt can say how much to trust them.
  const [source, setSource] = useState<null | "vinmonopolet" | "bilde">(null);
  const [busy, setBusy] = useState(false);
  // The varenummer last looked up, so Hent can stand out while a typed number is still unfetched.
  const [fetchedNr, setFetchedNr] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  // Scan animation: which step is running, the local preview of the screenshot, and which fields just got filled.
  const [scan, setScan] = useState<null | "upload" | "read" | "lookup">(null);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [flash, setFlash] = useState<string[]>([]);

  function flashFields(keys: string[]) {
    setFlash(keys);
    setTimeout(() => setFlash([]), 2200);
  }
  /** Extra classes for a field: shimmer while scanning, gold flash when just filled. */
  const fx = (key: string) => (scan ? "animate-shimmer" : flash.includes(key) ? "animate-fill" : "");
  const fxStyle = (key: string) => ({ animationDelay: `${Math.max(flash.indexOf(key), 0) * 140}ms` });

  async function takeImage(file: File) {
    setMsg(null);
    if (addedRef.current != null) {
      // The previous prize is already in the list; save any last edits and start a fresh one.
      if (JSON.stringify(draftRef.current) !== savedRef.current) await commit().catch(() => {});
      setAdded(null);
      patch(() => EMPTY);
    }
    setScan("upload");
    setScanUrl(URL.createObjectURL(file));
    try {
      const img = await uploadPrizeImage(file);
      patch((x) => ({ ...x, image_url: img.url }));
      setBusy(true);
      setScan("read");
      const o = await ocrPrizeImage(img.id);
      if (!o.enabled) return setMsg(null);
      // Only fill what the screenshot gave; keep anything already typed.
      patch((x) => ({
        ...x,
        name: o.name ?? x.name,
        varenummer: o.varenummer ?? x.varenummer,
        price: o.price != null ? String(o.price).replace(".", ",") : x.price,
        volume: o.volume ?? x.volume,
        category: o.category ?? x.category,
      }));
      setMsg("Fylte ut fra bildet – sjekk at det stemmer.");
      const got = (["varenummer", "name", "price", "volume", "category"] as const).filter((k) => o[k] != null);
      setScan(null);
      flashFields(got);
      if (o.varenummer) {
        setScan("lookup");
        await lookup(o.varenummer, true);
        setScan(null);
      }
      if (draftRef.current.name.trim() || draftRef.current.varenummer.trim()) {
        await commit();
        setSource("bilde");
        setMsg(null);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      setScan(null);
      setScanUrl((u) => (u && URL.revokeObjectURL(u), null));
    }
  }

  /** A pasted product link or varenummer: fill the form from Vinmonopolet and add it, like a screenshot. */
  async function takeProduct(varenummer: string) {
    setMsg(null);
    if (addedRef.current != null) {
      if (JSON.stringify(draftRef.current) !== savedRef.current) await commit().catch(() => {});
      setAdded(null);
    }
    patch(() => ({ ...EMPTY, varenummer }));
    setScan("lookup");
    try {
      const got = await lookup(varenummer);
      setScan(null);
      flashFields(got);
      if (draftRef.current.name.trim()) {
        await commit();
        setSource("vinmonopolet");
        setMsg(null);
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setScan(null);
    }
  }

  const takeRef = useRef({ image: takeImage, product: takeProduct });
  useEffect(() => {
    takeRef.current = { image: takeImage, product: takeProduct };
  });
  const formRef = useRef<HTMLFormElement>(null);

  // Ctrl+V anywhere on the page (unless a row is being edited, which claims the paste itself).
  // So is a product link or a varenummer, unless it's pasted into a text field outside this form.
  useEffect(() => {
    if (locked) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = imageFrom(e.clipboardData);
      if (f) {
        e.preventDefault();
        void takeRef.current.image(f);
        return;
      }
      const text = e.clipboardData?.getData("text") ?? "";
      const t = e.target as HTMLElement | null;
      const inField = !!t?.closest("input, textarea, [contenteditable]");
      const link = varenummerFromUrl(text);
      // A bare number only counts outside text fields or in the varenummer field (not, say, Pris).
      const bare = !inField || t?.id === "pz-varenr" ? text.match(/^\s*(?:varenr\.?|varenummer:?)?\s*(\d{3,})\s*$/i)?.[1] : null;
      const nr = link ?? bare;
      if (!nr || (inField && !formRef.current?.contains(t))) return;
      e.preventDefault();
      void takeRef.current.product(nr);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locked]);

  /** `fromScreenshot`: the number came from OCR, so Vinmonopolet's own photo replaces the uploaded screenshot. */
  async function lookup(varenummer = draft.varenummer, fromScreenshot = false): Promise<string[]> {
    varenummer = varenummerFromUrl(varenummer) ?? varenummer;
    if (!varenummer.trim()) return [];
    setBusy(true);
    setMsg(null);
    try {
      const d = await api(`/api/admin/lookup?varenummer=${encodeURIComponent(varenummer)}`);
      patch((x) => ({
        ...x,
        varenummer,
        image_url: fromScreenshot ? "" : x.image_url,
        name: d.name ?? x.name,
        price: d.price != null ? String(d.price).replace(".", ",") : x.price,
        volume: d.volume ?? x.volume,
        category: d.category ?? x.category,
      }));
      setFetchedNr(varenummer.trim());
      const got = (["name", "price", "volume", "category"] as const).filter((k) => d[k] != null);
      if (!d.name) setMsg("Fant ikke varen på vinmonopolet.no – fyll inn selv.");
      else if (got.length < 4) setMsg("Fant ikke alt på vinmonopolet.no – fyll inn resten selv.");
      return got;
    } catch (e) {
      setMsg((e as Error).message);
      return [];
    } finally {
      setBusy(false);
    }
  }

  /** Add the draft as a new prize, or – once added – save the form onto that prize. */
  async function commit() {
    const d = draftRef.current;
    const prize = {
      varenummer: d.varenummer.replace(/\D/g, "") || null,
      name: d.name,
      price: d.price === "" ? null : Number(d.price.replace(",", ".")),
      volume: d.volume || null,
      category: d.category || null,
      image_url: d.image_url || null,
    };
    if (addedRef.current == null) {
      const r = await roundAction(roundId, { type: "prizeAdd", prize });
      setAdded(r.id);
    } else {
      await roundAction(roundId, { type: "prizeUpdate", prizeId: addedRef.current, patch: prize });
    }
    savedRef.current = JSON.stringify(d);
    setSaved(savedRef.current);
    reload();
  }

  async function submit(ev?: React.FormEvent) {
    ev?.preventDefault();
    if (!draft.name.trim() && !draft.varenummer.trim()) {
      setMsg("Fyll inn navn eller varenummer først.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const wasNew = addedRef.current == null;
      await commit();
      if (wasNew) setSource(null); // typed by hand
      setFixing(false);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  /** Done with the shown prize: save last edits and clear the form. */
  async function newPrize() {
    if (addedRef.current != null && JSON.stringify(draftRef.current) !== savedRef.current) {
      try {
        await commit();
      } catch (e) {
        return setMsg((e as Error).message);
      }
    }
    setAdded(null);
    patch(() => EMPTY);
    setMsg(null);
  }

  /** Empty the form before it has been added. */
  function reset() {
    patch(() => EMPTY);
    setFetchedNr("");
    setMsg(null);
  }

  /** Take the just-added prize out of the list again, but keep the fields so it can be fixed and re-added. */
  async function undo() {
    if (addedRef.current == null) return;
    setBusy(true);
    try {
      await roundAction(roundId, { type: "prizeDelete", prizeId: addedRef.current });
      setAdded(null);
      setMsg("Fjernet fra listen.");
      reload();
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  // Lagre further down saves the form too: an added prize gets its last edits, a typed one is added.
  useEffect(() => {
    if (!flushRef) return;
    flushRef.current = async () => {
      const d = draftRef.current;
      if (addedRef.current != null) {
        if (JSON.stringify(d) !== savedRef.current) await commit();
      } else if (d.name.trim() || d.varenummer.trim()) {
        await commit();
        setAdded(null);
        patch(() => EMPTY);
        setMsg(null);
      }
    };
    return () => {
      flushRef.current = null;
    };
  });

  // If the shown prize is deleted from its row, the form goes back to being a new prize.
  useEffect(() => {
    if (addedId == null) return;
    if (added) seenAdded.current = true;
    else if (seenAdded.current) setAdded(null);
  }, [added, addedId]);

  // Save edits to an added prize when focus leaves the form.
  function onBlur(e: React.FocusEvent<HTMLFormElement>) {
    if (!dirty || busy || e.currentTarget.contains(e.relatedTarget as Node | null)) return;
    commit().catch((err) => setMsg((err as Error).message));
  }

  const unfetched = /^\d{3,}$/.test(draft.varenummer.trim()) && draft.varenummer.trim() !== fetchedNr;
  const pasteKey = typeof navigator !== "undefined" && /Mac|iP/.test(navigator.platform) ? "⌘V" : "Ctrl+V";
  const missing = (
    [
      ["name", "navn"],
      ["price", "pris"],
      ["volume", "volum"],
      ["category", "kategori"],
    ] as const
  )
    .filter(([k]) => !draft[k].trim())
    .map(([, l]) => l);
  const receipt = addedId != null && !fixing && !scan;
  const image = draft.image_url || vinmonopoletImage(draft.varenummer);
  const input = "mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base sm:text-sm";
  const label = "block text-sm font-medium text-plum";

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display text-lg font-semibold text-plum">Premier</h3>
        <p className="text-sm text-plum/70">Den som trekkes først velger først, og arrangerer neste runde.</p>
      </div>

      <ol className="space-y-2">
        {state.prizes.map((p, i) => (
          <PrizeRow
            key={p.id}
            prize={p}
            first={i === 0}
            last={i === state.prizes.length - 1}
            roundId={roundId}
            reload={reload}
            locked={locked}
            fixable={fixable}
            highlight={p.id === addedId}
          />
        ))}
        {!state.prizes.length && (
          <li className="text-sm text-plum/70">Ingen premier ennå.</li>
        )}
      </ol>

      {!locked && (
        <form
          ref={formRef}
          onSubmit={submit}
          onBlur={onBlur}
          aria-labelledby="ny-premie"
          className={`rounded-xl border-2 border-dashed p-4 transition-colors ${over ? "border-wine bg-wine/5" : "border-plum/20 bg-white"}`}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            const f = imageFrom(e.dataTransfer);
            if (f) void takeImage(f);
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 id="ny-premie" className="font-display text-base font-semibold text-plum">
              {addedId != null && fixing ? `Retter ${added ? `${added.rank}. premie` : "premien"}` : "Ny premie"}
            </h4>
            {addedId != null && fixing && (
              <span className="text-xs text-plum/70" aria-live="polite">
                {dirty ? "Ulagrede endringer" : "✓ Lagret i listen"}
              </span>
            )}
          </div>
          {scan && scanUrl ? (
            <div className="mt-3 flex items-center gap-4 rounded-lg bg-cream p-3">
              <div className="scan-frame relative h-28 w-24 shrink-0 overflow-hidden rounded-md bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={scanUrl} alt="" className="h-full w-full object-contain" />
                <span className="scan-line" />
                <span className="scan-corner left-1 top-1 border-l-2 border-t-2" />
                <span className="scan-corner right-1 top-1 border-r-2 border-t-2" />
                <span className="scan-corner bottom-1 left-1 border-b-2 border-l-2" />
                <span className="scan-corner bottom-1 right-1 border-b-2 border-r-2" />
              </div>
              <div className="text-sm text-plum" aria-live="polite">
                <p className="font-display text-base font-semibold">
                  {scan === "upload" ? "Laster opp bildet" : scan === "read" ? "Leser teksten i bildet" : "Henter fra Vinmonopolet"}
                  <span className="dots" />
                </p>
                <p className="mt-1 text-xs text-plum/70">Navn, pris og varenummer dukker opp i feltene under.</p>
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
              <p className={over ? "font-medium text-wine" : "text-plum/80"}>
                {over ? (
                  "Slipp bildet her"
                ) : (
                  <>
                    {receipt ? "Lim inn neste lenke eller varenummer" : "Lim inn lenke eller varenummer fra Vinmonopolet"}
                    <kbd className="ml-2 hidden rounded border border-plum/20 bg-cream px-1.5 py-0.5 font-sans text-xs text-plum/70 sm:inline">
                      {pasteKey}
                    </kbd>
                  </>
                )}
              </p>
              {!over && (
                <label className="cursor-pointer text-xs text-plum/70 underline underline-offset-4 hover:text-wine has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-wine">
                  Har du bare et bilde? Velg bilde
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = ""; // allow picking the same file again
                      if (f) void takeImage(f);
                    }}
                  />
                </label>
              )}
            </div>
          )}
          {receipt ? (
            <div className="animate-receipt mt-4 flex gap-4 rounded-lg bg-cream p-3 sm:p-4" aria-live="polite">
              <div className="flex h-28 w-20 shrink-0 items-center justify-center rounded-md bg-white p-1.5 sm:h-32 sm:w-24">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-auto object-contain" />
                ) : (
                  <BottleOutline className="h-14 text-plum/20" />
                )}
              </div>
              <div className="min-w-0 flex-1 self-center">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-sage">
                  <span className="receipt-check inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sage text-cream">
                    <IconCheck className="h-3.5 w-3.5" />
                  </span>
                  Lagret som {added ? `${added.rank}.` : "ny"} premie
                </p>
                <p className="mt-1.5 font-display text-lg font-semibold leading-snug text-plum text-balance">
                  {draft.name || `Varenr. ${draft.varenummer}`}
                </p>
                <p className="mt-0.5 text-sm text-plum/80 tabular-nums">
                  {[draft.volume, added?.price != null ? `kr ${formatPrice(added.price)}` : draft.price ? `kr ${draft.price}` : null, draft.category].filter(Boolean).join(" · ")}
                </p>
                {missing.length > 0 ? (
                  <p className="mt-2 text-sm text-wine">
                    Mangler {missing.join(", ").replace(/, ([^,]*)$/, " og $1")}.{" "}
                    <button type="button" onClick={() => setFixing(true)} className="font-semibold underline underline-offset-4 hover:text-wine-dark">
                      Fyll inn
                    </button>
                  </p>
                ) : source === "bilde" ? (
                  <p className="mt-2 text-xs text-plum/70">Lest fra bildet. Se over at det stemmer.</p>
                ) : source === "vinmonopolet" ? (
                  <p className="mt-2 text-xs text-plum/70 tabular-nums">Hentet fra Vinmonopolet, varenr. {draft.varenummer}</p>
                ) : null}
              </div>
            </div>
          ) : (
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <div className="flex shrink-0 items-end gap-2 sm:w-24 sm:flex-col sm:items-center sm:gap-1">
              <div className="flex h-24 w-20 items-center justify-center rounded-lg bg-cream p-1.5 sm:h-36 sm:w-full sm:p-2">
                {draft.image_url || vinmonopoletImage(draft.varenummer) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={draft.image_url || vinmonopoletImage(draft.varenummer) || ""}
                    alt={draft.name ? `Bilde av ${draft.name}` : "Produktbilde"}
                    className="h-full w-auto object-contain"
                  />
                ) : (
                  <BottleOutline className="h-14 text-plum/20 sm:h-20" />
                )}
              </div>
              {draft.image_url && (
                <button type="button" onClick={() => patch((x) => ({ ...x, image_url: "" }))} className={`${btn.quiet} min-h-8 px-1 text-xs`}>
                  Fjern
                </button>
              )}
            </div>
            <div className="grid min-w-0 flex-1 content-start gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="pz-varenr" className={label}>Varenummer eller lenke</label>
                <div className="flex gap-2">
                  <input
                    id="pz-varenr"
                    className={`${input} tabular-nums ${fx("varenummer")}`}
                    style={fxStyle("varenummer")}
                    value={draft.varenummer}
                    onChange={(e) => patch((x) => ({ ...x, varenummer: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void lookup();
                      }
                    }}
                    inputMode="numeric"
                  />
                  <button
                    type="button"
                    onClick={() => lookup()}
                    disabled={busy}
                    className={`${unfetched ? btn.primary : btn.secondary} mt-1 px-4 text-sm`}
                  >
                    Hent
                  </button>
                </div>
              </div>
              <label className={label}>
                Navn
                <input className={`${input} ${fx("name")}`} style={fxStyle("name")} value={draft.name} onChange={(e) => patch((x) => ({ ...x, name: e.target.value }))} />
              </label>
              <label className={label}>
                Pris (kr)
                <input className={`${input} tabular-nums ${fx("price")}`} style={fxStyle("price")} value={draft.price} onChange={(e) => patch((x) => ({ ...x, price: e.target.value }))} inputMode="decimal" />
              </label>
              <label className={label}>
                Volum
                <input className={`${input} ${fx("volume")}`} style={fxStyle("volume")} placeholder="0,75 l" value={draft.volume} onChange={(e) => patch((x) => ({ ...x, volume: e.target.value }))} />
              </label>
              <label className={label}>
                Kategori
                <input className={`${input} ${fx("category")}`} style={fxStyle("category")} placeholder="Rødvin" value={draft.category} onChange={(e) => patch((x) => ({ ...x, category: e.target.value }))} />
              </label>
            </div>
          </div>
          )}
          {msg && <p aria-live="polite" className="mt-3 text-sm text-plum/80">{msg}</p>}
          {addedId == null ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button type="submit" disabled={busy} className={btn.primary}>
                Legg til premie
              </button>
              {JSON.stringify(draft) !== JSON.stringify(EMPTY) && (
                <button type="button" onClick={reset} disabled={busy || !!scan} className={btn.quiet}>
                  Nullstill
                </button>
              )}
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {fixing ? (
                <button type="submit" disabled={busy} className={btn.primary}>
                  Ferdig
                </button>
              ) : (
                <>
                  <button type="button" onClick={newPrize} disabled={busy || !!scan} className={btn.primary}>
                    Legg til en til
                  </button>
                  <button type="button" onClick={() => setFixing(true)} disabled={busy || !!scan} className={btn.secondary}>
                    Rett opp
                  </button>
                </>
              )}
              <button type="button" onClick={undo} disabled={busy || !!scan} className={btn.quiet}>
                Angre – fjern fra listen
              </button>
            </div>
          )}
        </form>
      )}

      {state.prizes.length > 0 && <PrizeTotal prizes={state.prizes} />}
    </div>
  );
}

/** What the prizes cost together. */
function PrizeTotal({ prizes }: { prizes: Prize[] }) {
  const sum = prizes.reduce((s, p) => s + (p.price ?? 0), 0);
  const unpriced = prizes.filter((p) => p.price == null).length;
  return (
    <div className="flex items-baseline justify-between gap-4 border-t border-plum/10 pt-3">
      <p className="text-sm text-plum">
        <span className="font-semibold">Sum premier</span>{" "}
        <span className="text-plum/70">
          ({prizes.length} {prizes.length === 1 ? "premie" : "premier"}
          {unpriced > 0 && `, ${unpriced} uten pris`})
        </span>
      </p>
      <p className="font-display text-lg font-semibold tabular-nums text-plum">kr {formatPrice(Math.round(sum * 100) / 100)}</p>
    </div>
  );
}

function PrizeRow({
  prize,
  first,
  last,
  roundId,
  reload,
  locked,
  fixable,
  highlight,
}: {
  prize: Prize;
  first: boolean;
  last: boolean;
  roundId: number;
  reload: () => void;
  locked: boolean;
  fixable: boolean;
  highlight?: boolean;
}) {
  const [edit, setEdit] = useState(false);
  const [f, setF] = useState({
    name: prize.name,
    price: prize.price != null ? String(prize.price).replace(".", ",") : "",
    volume: prize.volume ?? "",
    varenummer: prize.varenummer ?? "",
    category: prize.category ?? "",
  });
  const [image, setImage] = useState(prize.image_url);
  const img = image || vinmonopoletImage(prize.varenummer);
  const { run, busy, error, setError } = useAction();
  const title = prize.name || `Varenr. ${prize.varenummer ?? "?"}`;

  const [reading, setReading] = useState(false);

  /** A new photo, or a screenshot of the prize: whatever the screenshot shows replaces the fields. */
  async function takeImage(file: File) {
    setError(null);
    try {
      const up = await uploadPrizeImage(file);
      setImage(up.url);
      setReading(true);
      const o = await ocrPrizeImage(up.id);
      if (!o.enabled) return;
      setF((x) => ({
        name: o.name ?? x.name,
        price: o.price != null ? String(o.price).replace(".", ",") : x.price,
        volume: o.volume ?? x.volume,
        varenummer: o.varenummer ?? x.varenummer,
        category: o.category ?? x.category,
      }));
      // Vinmonopolet's own photo beats a screenshot of the whole product page.
      if (o.varenummer) setImage(vinmonopoletImage(o.varenummer) ?? up.url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setReading(false);
    }
  }

  // While editing, this row claims Ctrl+V (capture phase) so the "new prize" box doesn't also take it.
  useEffect(() => {
    if (!edit) return;
    const onPaste = (e: ClipboardEvent) => {
      const f = imageFrom(e.clipboardData);
      if (!f) return;
      e.preventDefault();
      e.stopPropagation();
      void takeImage(f);
    };
    window.addEventListener("paste", onPaste, true);
    return () => window.removeEventListener("paste", onPaste, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edit]);

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const ok = await run(() =>
      roundAction(roundId, {
        type: "prizeUpdate",
        prizeId: prize.id,
        patch: {
          name: f.name,
          price: f.price === "" ? null : Number(f.price.replace(",", ".")),
          volume: f.volume || null,
          varenummer: f.varenummer.replace(/\D/g, "") || null,
          category: f.category || null,
          image_url: image || null,
        },
      }),
    );
    if (ok) {
      setEdit(false);
      reload();
    }
  }

  const iconBtn =
    "inline-flex h-9 w-9 items-center justify-center rounded-md text-plum/70 hover:bg-parchment hover:text-wine disabled:pointer-events-none disabled:opacity-30";
  const field = "rounded-md border border-plum/20 px-2 py-1.5 text-base sm:text-sm";

  return (
    <li
      className={`rounded-xl border bg-white p-3 transition-colors ${highlight ? "border-wine/50 ring-1 ring-wine/30" : "border-plum/10"}`}
      onDragOver={(e) => edit && e.preventDefault()}
      onDrop={(e) => {
        const file = imageFrom(e.dataTransfer);
        if (!edit || !file) return;
        e.preventDefault();
        void takeImage(file);
      }}
    >
      <div className="flex items-center gap-3">
        <span className="w-6 shrink-0 text-center font-display text-lg font-semibold tabular-nums text-wine">{prize.rank}.</span>
        <div className="flex h-12 w-10 shrink-0 items-center justify-center">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img} alt="" className="h-full w-auto object-contain" />
          ) : (
            <span aria-hidden="true">🍾</span>
          )}
        </div>
        {!edit ? (
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-plum">{title}</p>
            <p className="text-xs text-plum/70 tabular-nums">
              {[prize.volume, prize.price != null ? `kr ${formatPrice(prize.price)}` : null].filter(Boolean).join(" · ")}
            </p>
          </div>
        ) : (
          <form id={`pz-${prize.id}`} onSubmit={save} aria-busy={reading} className={`grid min-w-0 flex-1 gap-1.5 sm:grid-cols-2 ${reading ? "animate-shimmer" : ""}`}>
            <input aria-label="Navn" className={field} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Navn" />
            <input aria-label="Pris i kroner" className={field} value={f.price} onChange={(e) => setF({ ...f, price: e.target.value })} placeholder="Pris" inputMode="decimal" />
            <input aria-label="Volum" className={field} value={f.volume} onChange={(e) => setF({ ...f, volume: e.target.value })} placeholder="Volum" />
            <input aria-label="Varenummer" className={field} value={f.varenummer} onChange={(e) => setF({ ...f, varenummer: e.target.value })} placeholder="Varenr." inputMode="numeric" />
            <input aria-label="Kategori" className={field} value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Kategori, f.eks. Rødvin" />
          </form>
        )}
        {(!locked || fixable) && (
          <div className="flex shrink-0 items-center">
            {edit && (
              <label className={`${iconBtn} cursor-pointer`} title="Bytt bilde">
                <IconCamera />
                <span className="sr-only">Bytt bilde for {title}</span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void takeImage(f);
                  }}
                />
              </label>
            )}
            {!edit && !locked && (
              <>
                <button
                  type="button"
                  disabled={first || busy}
                  onClick={() => run(() => roundAction(roundId, { type: "prizeMove", prizeId: prize.id, dir: -1 })).then(reload)}
                  className={iconBtn}
                  aria-label={`Flytt ${title} opp`}
                >
                  <IconUp />
                </button>
                <button
                  type="button"
                  disabled={last || busy}
                  onClick={() => run(() => roundAction(roundId, { type: "prizeMove", prizeId: prize.id, dir: 1 })).then(reload)}
                  className={iconBtn}
                  aria-label={`Flytt ${title} ned`}
                >
                  <IconDown />
                </button>
              </>
            )}
            {!edit ? (
              <button type="button" onClick={() => setEdit(true)} className={btn.quiet}>
                Endre
              </button>
            ) : (
              <>
                <button type="submit" form={`pz-${prize.id}`} disabled={busy || reading} className={`${btn.quiet} font-semibold text-wine`}>
                  Lagre
                </button>
                <button type="button" onClick={() => setEdit(false)} className={btn.quiet}>
                  Avbryt
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {!locked && !edit && (
        <div className="mt-1 flex justify-end">
          <ConfirmButton
            className={`${btn.quiet} text-xs`}
            question={`Slette ${prize.rank}. premie?`}
            confirmLabel="Slett"
            onConfirm={() => run(() => roundAction(roundId, { type: "prizeDelete", prizeId: prize.id })).then(reload)}
          >
            <IconTrash className="h-3.5 w-3.5" />
            Slett
          </ConfirmButton>
        </div>
      )}
      {error && (
        <div className="mt-2">
          <ErrorNote>{error}</ErrorNote>
        </div>
      )}
    </li>
  );
}

/** Empty slot for the prize photo until there is one. */
function BottleOutline({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 64" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d="M9.5 2h5v14c0 3 5 6 5 13v31a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2V29c0-7 5-10 5-13Z" />
      <path d="M4.5 36h15M4.5 50h15" />
    </svg>
  );
}

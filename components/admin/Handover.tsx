"use client";

import { useState } from "react";
import Link from "next/link";
import { roundAction } from "@/lib/adminApi";
import { Crown } from "@/components/Grid";
import { kr } from "@/lib/format";
import { prizeOfDraw } from "@/lib/phases";
import type { AdminRoundState } from "@/lib/adminTypes";
import { ErrorNote, IconArrowRight, btn, useAction } from "./ui";

/** The end of the ritual: whoever was drawn first arranges next week. */
export default function Handover({ state, onNext }: { state: AdminRoundState; onNext: (id: number) => void }) {
  const { round, draws, prizes, money, successor } = state;
  const first = draws.find((d) => d.rank === 1 && d.winner_name);
  const firstPrize = first && prizeOfDraw(prizes, first);
  const [organizer, setOrganizer] = useState(first?.winner_name ?? round.organizer_name);
  const [vipps, setVipps] = useState("");
  const { run, busy, error } = useAction();

  if (round.status !== "settled")
    return (
      <p className="text-sm text-plum/80">
        Når runden er gjort opp, gir du stafettpinnen videre: 1. premie-vinneren arrangerer neste runde, og pengene følger med.
      </p>
    );

  if (successor.id)
    return (
      <Link href={`/admin/runde/${successor.id}`} className={btn.secondary}>
        Til {successor.title || "neste runde"} <IconArrowRight />
      </Link>
    );

  const start = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const d = await roundAction(round.id, { type: "next", organizer_name: organizer, vipps_number: vipps });
      if (d.id) onNext(d.id);
    });
  };

  const input = "mt-1 block w-full rounded-lg border border-plum/20 bg-white px-3 py-2 text-base sm:text-sm";

  return (
    <div className="animate-reveal overflow-hidden rounded-2xl bg-wine text-cream shadow-[0_18px_40px_-20px_rgba(90,16,41,0.8)]">
      <div className="px-6 pb-5 pt-6">
        {first ? (
          <>
            <Crown className="animate-crown h-7 w-10 text-gold-soft" />
            <p className="mt-3 font-display text-3xl font-semibold text-balance sm:text-4xl">
              {first.winner_name} arrangerer neste runde
            </p>
            <p className="mt-1 text-cream/80">
              Ble trukket først{firstPrize?.name ? ` og valgte ${firstPrize.name}` : ""}. Du vippser {kr(money.videre)} til {first.winner_name}.
            </p>
          </>
        ) : (
          <p className="font-display text-3xl font-semibold">Hvem arrangerer neste runde?</p>
        )}
      </div>
      <form onSubmit={start} className="grid gap-4 bg-cream px-6 py-5 text-plum sm:grid-cols-2">
        <label className="block text-sm font-medium">
          Arrangør
          <input className={input} value={organizer} onChange={(e) => setOrganizer(e.target.value)} />
        </label>
        <label className="block text-sm font-medium">
          Vippsnummeret {organizer ? `til ${organizer.split(" ")[0]}` : ""}
          <input className={`${input} tabular-nums`} value={vipps} onChange={(e) => setVipps(e.target.value)} inputMode="numeric" autoComplete="off" />
          <span className="mt-1 block text-xs font-normal text-plum/70">Kan fylles inn senere. Salget åpner først når det er på plass.</span>
        </label>
        <div className="sm:col-span-2">
          <button type="submit" disabled={busy} className={btn.primary}>
            {busy ? "Starter…" : "Start neste runde"} <IconArrowRight />
          </button>
          <ErrorNote>{error}</ErrorNote>
        </div>
      </form>
    </div>
  );
}

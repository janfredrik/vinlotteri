import { NextResponse } from "next/server";
import { badRequest, guardSuper } from "@/lib/http";
import { listNameUses, mergeNames } from "@/lib/repo";
import { notifyRound } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const denied = await guardSuper();
  if (denied) return denied;
  return NextResponse.json({ names: listNameUses() });
}

/** Merge names: { norms: string[], name: string }. */
export async function POST(req: Request) {
  const denied = await guardSuper();
  if (denied) return denied;
  const body = await req.json().catch(() => ({}));
  const norms = Array.isArray(body.norms) ? body.norms.filter((n: unknown): n is string => typeof n === "string") : [];
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!norms.length) return badRequest("Velg navnene som skal slås sammen.");
  if (name.length < 2 || name.length > 40) return badRequest("Skriv inn det riktige navnet (2–40 tegn).");
  const rounds = mergeNames(norms, name);
  rounds.forEach(notifyRound);
  return NextResponse.json({ ok: true, rounds: rounds.length, names: listNameUses() });
}

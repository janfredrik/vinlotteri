import { NextResponse } from "next/server";
import { guardAccess } from "@/lib/http";
import { lookupProduct } from "@/lib/vinmonopolet";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const varenummer = new URL(req.url).searchParams.get("varenummer") ?? "";
  if (!varenummer.replace(/\D/g, "")) return NextResponse.json({ error: "Mangler varenummer." }, { status: 400 });
  return NextResponse.json(await lookupProduct(varenummer));
}

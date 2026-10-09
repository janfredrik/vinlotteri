import { NextResponse } from "next/server";
import { guardAccess, num } from "@/lib/http";
import { db } from "@/lib/db";
import { ocrEnabled, ocrPrize } from "@/lib/ocr";

export const dynamic = "force-dynamic";

/** Body: { imageId }. Reads an uploaded prize image; `enabled: false` when no OCR key is configured. */
export async function POST(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  if (!ocrEnabled()) return NextResponse.json({ enabled: false });
  const id = num((await req.json().catch(() => ({}))).imageId);
  const row = id == null ? undefined : (db.prepare("SELECT mime, data FROM prize_images WHERE id = ?").get(id) as
    | { mime: string; data: Uint8Array }
    | undefined);
  if (!row) return NextResponse.json({ error: "Fant ikke bildet." }, { status: 404 });
  try {
    return NextResponse.json({ enabled: true, ...(await ocrPrize(row.mime, row.data)) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}

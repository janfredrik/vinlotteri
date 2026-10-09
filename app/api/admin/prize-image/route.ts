import { NextResponse } from "next/server";
import { guardAccess } from "@/lib/http";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

const MAX_BYTES = 1_500_000;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

/** Raw image body (already downscaled by the browser). Returns the URL to store in prizes.image_url. */
export async function POST(req: Request) {
  const denied = await guardAccess();
  if (denied) return denied;
  const mime = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  if (!TYPES.includes(mime)) return NextResponse.json({ error: "Kun JPEG, PNG eller WebP." }, { status: 400 });
  const buf = Buffer.from(await req.arrayBuffer());
  if (!buf.length || buf.length > MAX_BYTES) return NextResponse.json({ error: "Bildet er for stort." }, { status: 400 });
  const res = db.prepare("INSERT INTO prize_images (mime, data) VALUES (?, ?)").run(mime, buf);
  return NextResponse.json({ id: Number(res.lastInsertRowid), url: `/api/prize-image/${Number(res.lastInsertRowid)}` });
}

import { db } from "@/lib/db";
import { num } from "@/lib/http";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = num((await params).id);
  const row = id == null ? undefined : (db.prepare("SELECT mime, data FROM prize_images WHERE id = ?").get(id) as
    | { mime: string; data: Uint8Array }
    | undefined);
  if (!row) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(row.data), {
    headers: { "Content-Type": row.mime, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}

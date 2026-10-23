import sharp from "sharp";
import { removeBackground } from "@/lib/cutout";
import { num } from "@/lib/http";
import { POLET_IMAGE_SIZES, poletImageSource } from "@/lib/vinmonopolet";

// Vinmonopolet's photo of a product, with the white backdrop made transparent (lib/cutout.ts).
// Kept in memory once made: the same few bottles are shown all week.

const MAX_CACHED = 300;
const made = new Map<string, Buffer>();

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = num((await params).id);
  if (id == null || id <= 0) return new Response("Not found", { status: 404 });
  const asked = new URL(req.url).searchParams.get("s") ?? "";
  const size = (POLET_IMAGE_SIZES as readonly string[]).includes(asked) ? asked : POLET_IMAGE_SIZES[0];
  const key = `${id}:${size}`;

  let out = made.get(key);
  if (!out) {
    // No picture redirects to an HTML page; answer 404 so the page shows its bottle instead.
    const res = await fetch(poletImageSource(id, size)).catch(() => null);
    if (!res?.ok || !res.headers.get("content-type")?.startsWith("image/"))
      return new Response("Not found", { status: 404 });
    const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    removeBackground(data, info.width, info.height);
    out = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
      .webp({ quality: 88, alphaQuality: 90 })
      .toBuffer();
    if (made.size >= MAX_CACHED) made.delete(made.keys().next().value!);
    made.set(key, out);
  }
  return new Response(new Uint8Array(out), {
    headers: { "Content-Type": "image/webp", "Cache-Control": "public, max-age=604800" },
  });
}

"use client";

export async function api(path: string, init?: RequestInit) {
  const r = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    cache: "no-store",
  });
  if (r.status === 401) {
    window.location.href = `/apne?next=${encodeURIComponent(location.pathname)}`;
    throw new Error("Krever tilgangs-PIN.");
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Feil (${r.status})`);
  return data;
}

export function roundAction(roundId: number, body: Record<string, unknown>) {
  return api(`/api/admin/rounds/${roundId}/actions`, { method: "POST", body: JSON.stringify(body) });
}

export function patchRound(roundId: number, patch: Record<string, unknown>) {
  return api(`/api/admin/rounds/${roundId}`, { method: "PATCH", body: JSON.stringify(patch) });
}

/** Downscale a pasted/dropped image to ≤ 800px JPEG and upload it; resolves to its URL. */
export async function uploadPrizeImage(file: Blob): Promise<{ id: number; url: string }> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // screenshots may be transparent; JPEG has no alpha
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  if (!blob) throw new Error("Kunne ikke lese bildet.");
  const r = await fetch("/api/admin/prize-image", { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: blob });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Feil (${r.status})`);
  return { id: data.id, url: data.url };
}

export interface OcrResult {
  enabled?: boolean;
  name?: string | null;
  varenummer?: string | null;
  price?: number | null;
  volume?: string | null;
  category?: string | null;
}

export function ocrPrizeImage(imageId: number): Promise<OcrResult> {
  return api("/api/admin/prize-ocr", { method: "POST", body: JSON.stringify({ imageId }) });
}

export function imageFrom(dt: DataTransfer | null): File | null {
  return Array.from(dt?.files ?? []).find((f) => f.type.startsWith("image/")) ?? null;
}

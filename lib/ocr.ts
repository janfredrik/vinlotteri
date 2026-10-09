export interface PrizeOcr {
  name: string | null;
  varenummer: string | null;
  price: number | null;
  volume: string | null;
  category: string | null;
}

export const ocrEnabled = () => !!process.env.OCR_API_KEY;

const PROMPT = `Dette er et skjermbilde av et produkt fra Vinmonopolet. Les av teksten og svar KUN med JSON:
{"name": string|null, "varenummer": string|null, "price": number|null, "volume": string|null, "category": string|null}
- name: produktnavnet (f.eks. "Marcel Martin Crémant de Loire Tête de Cuvée Brut")
- varenummer: produktnummeret (siffer), ikke prisen
- price: kroner som tall, med desimaler hvis de står der (169,90 -> 169.9)
- volume: liter med komma, f.eks. "0,75 l" (75 cl -> "0,75 l")
- category: typen med stor forbokstav, f.eks. "Musserende vin", "Rødvin"
Bruk null for det du ikke ser.`;

/** Reads name/price/etc. from a screenshot with a vision model via any OpenAI-compatible chat endpoint. */
export async function ocrPrize(mime: string, data: Uint8Array): Promise<PrizeOcr> {
  const base = (process.env.OCR_BASE_URL || "https://openrouter.ai/api/v1").replace(/\/$/, "");
  const model = process.env.OCR_MODEL || "z-ai/glm-5.3-flash";
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.OCR_API_KEY}` },
    body: JSON.stringify({
      model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${Buffer.from(data).toString("base64")}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`Tekstgjenkjenning feilet (${res.status}).`);
  const body = await res.json();
  const text: string = body?.choices?.[0]?.message?.content ?? "";
  const json = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
  const price = Number(json.price);
  return {
    name: str(json.name),
    varenummer: str(json.varenummer)?.replace(/\D/g, "") || null,
    price: Number.isFinite(price) && price > 0 ? Math.round(price * 100) / 100 : null,
    volume: str(json.volume),
    category: str(json.category),
  };
}

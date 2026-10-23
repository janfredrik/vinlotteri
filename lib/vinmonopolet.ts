export const POLET_IMAGE_SIZES = ["300x300-0", "1200x1200-0"] as const;

/** Public product image (no API key) on Vinmonopolet itself. Non-existing numbers return a bottle silhouette. */
export function poletImageSource(n: number, size: string): string {
  return `https://bilder.vinmonopolet.no/cache/${size}/${n}-1.jpg`;
}

/** The product image as the app shows it: fetched through our own route, white backdrop removed. */
export function vinmonopoletImage(varenummer: string | null | undefined, size = "300x300-0"): string | null {
  if (!varenummer) return null;
  const n = parseInt(String(varenummer).replace(/\D/g, ""), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `/api/polet-bilde/${n}?s=${size}`;
}

/** Product page on vinmonopolet.no, or null without a usable varenummer. */
export function vinmonopoletUrl(varenummer: string | null | undefined): string | null {
  const n = parseInt(String(varenummer ?? "").replace(/\D/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? `https://www.vinmonopolet.no/p/${n}` : null;
}

/** A bigger rendition of a Vinmonopolet cache image; other URLs pass through untouched. */
export function largeImage(url: string): string {
  return url
    .replace(/(bilder\.vinmonopolet\.no\/cache\/)\d+x\d+-0\//, (_, host) => `${host}1200x1200-0/`)
    .replace(/(\/api\/polet-bilde\/\d+\?s=)\d+x\d+-0/, "$11200x1200-0");
}

export interface ProductLookup {
  varenummer: string;
  name: string | null;
  category: string | null;
  price: number | null;
  volume: string | null;
  image: string | null;
}

/** The varenummer in a vinmonopolet.no product link (".../p/20501602"), or null if it isn't one. */
export function varenummerFromUrl(text: string): string | null {
  const m = text.trim().match(/^(?:https?:\/\/)?(?:www\.)?vinmonopolet\.no\/\S*\/p\/(\d+)/i);
  return m ? m[1] : null;
}

const decode = (s: string) =>
  s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

/**
 * Name, price, size and category from the public product page. Reads the schema.org JSON-LD
 * and the category link (/search?q=:relevance:mainCategory:...) rather than the page's
 * generated class names, which change between builds.
 */
async function fromProductPage(clean: string): Promise<Partial<ProductLookup>> {
  const res = await fetch(`https://www.vinmonopolet.no/p/${clean}`, {
    headers: { "User-Agent": "Mozilla/5.0 (vinlotteri)", "Accept-Language": "nb-NO" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) return {};
  const html = await res.text();
  const out: Partial<ProductLookup> = {};

  for (const [, json] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(json);
      const p = [d, ...(Array.isArray(d?.["@graph"]) ? d["@graph"] : [])].find((x) => x?.["@type"] === "Product");
      if (!p) continue;
      if (typeof p.name === "string") out.name = decode(p.name);
      const offer = Array.isArray(p.offers) ? p.offers[0] : p.offers;
      const price = Number(offer?.price);
      if (Number.isFinite(price) && price > 0) out.price = Math.round(price * 100) / 100;
      if (typeof p.size === "string" && p.size.trim()) out.volume = decode(p.size);
      break;
    } catch {
      /* not JSON - try the next one */
    }
  }

  const og = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
  if (!out.name && og) out.name = decode(og);
  const cat = html.match(/mainCategory:[^"<>]+">([^<]+)<\/a>/);
  if (cat) out.category = decode(cat[1]);
  return out;
}

/**
 * Best-effort product details. The image URL always works. Name, price, size and category come
 * from the public product page; VINMONOPOLET_API_KEY (a free self-service key from
 * api.vinmonopolet.no) is a fallback for the name should the page change shape. Anything not
 * found is null and left for the admin to type.
 */
export async function lookupProduct(varenummer: string): Promise<ProductLookup> {
  const clean = String(varenummer).replace(/\D/g, "");
  const base: ProductLookup = {
    varenummer: clean,
    name: null,
    category: null,
    price: null,
    volume: null,
    image: vinmonopoletImage(clean),
  };
  if (!clean) return base;

  const page = await fromProductPage(clean).catch(() => ({}) as Partial<ProductLookup>);
  const merged = { ...base, ...page };
  if (merged.name) return merged;
  return fromApi(clean, merged);
}

async function fromApi(clean: string, base: ProductLookup): Promise<ProductLookup> {
  const key = process.env.VINMONOPOLET_API_KEY;
  if (!key) return base;

  try {
    const res = await fetch(
      `https://apis.vinmonopolet.no/products/v0/details-normal?productId=${clean}`,
      { headers: { "Ocp-Apim-Subscription-Key": key }, cache: "no-store" },
    );
    if (!res.ok) return base;
    const data = await res.json();
    const p = Array.isArray(data) ? data[0]?.basic ?? data[0] : data?.basic ?? data;
    if (!p) return base;
    return {
      ...base,
      name: p.productShortName ?? p.name ?? base.name,
      category: base.category ?? p.mainCategory?.name ?? p.category ?? null,
      price: base.price ?? (typeof p.price === "number" ? Math.round(p.price * 100) / 100 : null),
      volume: base.volume ?? (p.volume ? `${p.volume} l` : null),
    };
  } catch {
    return base;
  }
}

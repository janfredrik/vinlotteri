/** Longest name shown in a grid square before it's cut off. Also used as the
 *  input's maxLength so what you type is always exactly what shows. */
export const NAME_DISPLAY_MAX = 7;

export function gridLabel(name: string | null | undefined, max = NAME_DISPLAY_MAX): string | null {
  if (!name) return null;
  const t = name.trim();
  return t.length <= max ? t : t.slice(0, max);
}

/** 169.9 -> "169,90", 170 -> "170" (Norwegian decimal comma). */
export function formatPrice(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ",");
}

/** Whole kroner for the ledger, with a real minus sign: "kr 119", "kr −70". */
export function kr(n: number): string {
  return `kr ${n < 0 ? "−" : ""}${Math.abs(n)}`;
}

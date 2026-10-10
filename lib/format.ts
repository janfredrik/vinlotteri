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

/** How names are compared everywhere: case and extra spaces don't matter. */
export function normName(s: string): string {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** The profile square's text: short names ("JF", "ef") as they are, joined-up names by their
 *  capitals ("OlaN" -> "ON", "KariAnne" -> "KA"), otherwise the first letter of the first two
 *  words ("Per H" -> "PH", "Nora" -> "N"). */
export function initials(name: string): string {
  const t = name.trim().replace(/\s+/g, " ");
  if (!t) return "?";
  if (!t.includes(" ") && t.length <= 3) return t.toLocaleUpperCase("nb-NO");
  if (!t.includes(" ")) {
    const caps = [...t].filter((ch, i) => i > 0 && /\p{Lu}/u.test(ch));
    if (caps.length) return ([...t][0] + caps[0]).toLocaleUpperCase("nb-NO");
  }
  return t
    .split(" ")
    .slice(0, 2)
    .map((w) => [...w][0])
    .join("")
    .toLocaleUpperCase("nb-NO");
}

/**
 * ReqGen v4 — money in figures and in words (British English, Nigerian naira).
 * "₦85,000.00" · "Eighty-five thousand naira only".
 */

const ONES = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const SCALES = ["", "thousand", "million", "billion", "trillion"];

function belowHundred(n: number) {
  if (n < 20) return ONES[n];
  const t = Math.floor(n / 10);
  const o = n % 10;
  return o ? `${TENS[t]}-${ONES[o]}` : TENS[t];
}

function belowThousand(n: number, joinAnd: boolean) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  const parts: string[] = [];
  if (h) parts.push(`${ONES[h]} hundred`);
  if (rest) parts.push((h || joinAnd ? "and " : "") + belowHundred(rest));
  return parts.join(" ");
}

/** Whole number in words: 1250000 → "one million, two hundred and fifty thousand". */
export function wholeInWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return "zero";
  const groups: number[] = [];
  while (n > 0) { groups.push(n % 1000); n = Math.floor(n / 1000); }
  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i -= 1) {
    const g = groups[i];
    if (!g) continue;
    const isLast = i === 0;
    // "one thousand and five" — British usage puts "and" before a final group below 100.
    const text = belowThousand(g, isLast && groups.length > 1 && g < 100);
    words.push(SCALES[i] ? `${text} ${SCALES[i]}` : text);
  }
  return words.join(", ").replace(/, and /g, " and ");
}

function capitalise(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

/** "Eighty-five thousand naira only" / "Ten naira, fifty kobo only". */
export function nairaInWords(amount: number | string | null | undefined): string {
  const value = Number(amount || 0);
  if (!Number.isFinite(value) || value <= 0) return "";
  const naira = Math.floor(value + 1e-9);
  const kobo = Math.round((value - naira) * 100);
  const parts: string[] = [];
  if (naira) parts.push(`${wholeInWords(naira)} naira`);
  if (kobo) parts.push(`${wholeInWords(kobo)} kobo`);
  return `${capitalise(parts.join(", "))} only`;
}

/** "₦85,000.00" */
export function nairaExact(amount: number | string | null | undefined): string {
  const value = Number(amount || 0);
  return "₦" + (Number.isFinite(value) ? value : 0).toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Reads what a person typed in an amount box: "85,000.50" → 85000.5 (NaN when invalid). */
export function parseAmount(text: string): number {
  const clean = String(text || "").replace(/[₦,\s]/g, "");
  if (!clean) return NaN;
  if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
  return Number(clean);
}

/** Formats an amount box while typing: keeps digits, one dot and two decimals, adds commas. */
export function formatAmountInput(text: string): string {
  const raw = String(text || "").replace(/[^\d.]/g, "");
  const [whole, ...rest] = raw.split(".");
  const dec = rest.join("").slice(0, 2);
  const w = whole.replace(/^0+(?=\d)/, "");
  const withCommas = w.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return raw.includes(".") ? `${withCommas || "0"}.${dec}` : withCommas;
}

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes safely */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format price: grouped 3-by-3 with comma + Persian digits → ۲۵,۰۰۰,۰۰۰ */
export function formatPrice(value: number): string {
  return toFa(new Intl.NumberFormat("en-US").format(value));
}

/** Compact Persian amount → «۱۲۴ میلیون» / «۲٫۳ میلیارد» (kept short for tiles). */
export function formatCompactFa(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${toFa((value / 1_000_000_000).toLocaleString("en-US", { maximumFractionDigits: 1 }))} میلیارد`;
  if (abs >= 1_000_000) return `${toFa((value / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 0 }))} میلیون`;
  if (abs >= 1_000) return `${toFa((value / 1_000).toLocaleString("en-US", { maximumFractionDigits: 0 }))} هزار`;
  return toFa(value);
}

/** Group any digit string 3-by-3 with comma + Persian digits → "۲۵,۰۰۰,۰۰۰" */
export const faGroup = (input: string | number): string => {
  const d = String(input).replace(/[^\d]/g, "");
  return d ? toFa(Number(d).toLocaleString("en-US")) : "";
};

/** Convert Persian digits back to ASCII digits */
export const fromFa = (input: string): string =>
  input.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));

/** Persian digits */
export function toFa(input: number | string): string {
  const map = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/\d/g, (d) => map[+d]);
}

/**
 * Normalize Persian text for matching:
 * Arabic ي/ك → Persian ی/ک, Arabic digits → Persian digits, and ZWNJ
 * (\u200c) is removed on the *query* side but kept when indexing a word list,
 * so «میخوام» still matches «می‌خوام». For whole-string comparisons callers
 * should compare `stripZwnj(normalizeFa(a))` with the same transform.
 */
export function normalizeFa(input: string): string {
  return input
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[٠-٩]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
}

/** Query-time normalization: normalize + drop ZWNJ so spacing variants match. */
export function normalizeQuery(input: string): string {
  return normalizeFa(input).replace(/\u200c/g, "");
}

/** Word-list indexing: normalize and compare each ZWNJ-separated unit too. */
export function faIncludes(haystack: string, needle: string): boolean {
  const target = normalizeQuery(needle);
  if (!target) return false;
  const source = normalizeFa(haystack);
  if (source.includes(target)) return true;
  // «می‌خوام» vs «میخوام»: compare after removing ZWNJ on both sides
  if (source.replace(/\u200c/g, "").includes(target)) return true;
  // and allow matching a chunk across ZWNJ: «خوام» inside «می‌خوام»
  return source.split(/\u200c+/).some((chunk) => chunk.includes(target));
}

/** Discount percentage */
export function discountPercent(price: number, oldPrice?: number): number {
  if (!oldPrice || oldPrice <= price) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

/** Slugify */
export function slugify(text: string): string {
  return text
    .toString()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w\u0600-\u06FF-]/g, "")
    .toLowerCase();
}

/** Short delay helper (mock async) */
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Random id */
export const uid = () => Math.random().toString(36).slice(2, 10);

/** Clamp number */
export const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max);

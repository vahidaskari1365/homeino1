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

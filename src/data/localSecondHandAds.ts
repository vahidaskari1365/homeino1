// ============================================================
// SECOND-HAND ADS — customer-posted listings (demo persistence).
//
// Customers post their own used-product ads from the account area or the
// public /second-hand page; ads live in localStorage (same contract as
// localOrders) and render merged with the marketplace fixtures. Categories
// always come from the REAL catalog (src/data/categories.ts) — the slug is
// stored, the Persian label is derived, so a category rename never orphans
// an ad. Swap for the real ads API when the backend lands.
// ============================================================
import type { SecondHandProduct } from "@/types";
import { categories, getCategory } from "./categories";
import { secondHandProducts } from "./secondHand";
import { uid } from "@/lib/utils";

const KEY = "homeino-second-hand-ads";
const MAX_ADS = 40;
export const MAX_IMAGE_BYTES = 800 * 1024; // data-URL quota safety

export type AdCondition = SecondHandProduct["condition"];
export const AD_CONDITIONS: AdCondition[] = ["نو", "خوب", "قابل‌قبول"];

export interface SecondHandAdDraft {
  title: string;
  categorySlug: string;
  price: number;
  condition: AdCondition;
  city: string;
  age?: string;
  reason?: string;
  description: string;
  image?: string; // data-URL from the file input, or an IMG fallback
}

export interface LocalSecondHandAd extends SecondHandProduct {
  /** true = posted by the logged-in customer in this browser. */
  mine: true;
  /** ISO stamp for precise sorting (fixtures only carry a display date). */
  isoCreatedAt: string;
}

// In-memory fallback for environments without localStorage (tests, SSR,
// private mode) — the demo keeps working for the session either way.
let memoryAds: LocalSecondHandAd[] = [];

function read(): LocalSecondHandAd[] {
  if (typeof window === "undefined") return memoryAds;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as LocalSecondHandAd[]) : [];
  } catch {
    return [];
  }
}

function write(ads: LocalSecondHandAd[]) {
  if (typeof window === "undefined") {
    memoryAds = ads;
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ads));
  } catch {
    memoryAds = ads; // private mode / full quota — session memory keeps working
  }
}

function faDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

export function adCategories() {
  return categories.map((category) => ({ slug: category.slug, name: category.name, subcategories: category.subcategories }));
}

export function adCategoryLabel(slug: string): string {
  return getCategory(slug)?.name ?? "دسته‌بندی";
}

/** All ads shown on the public page: the customer's own ads first, then the
 *  marketplace fixtures (sorted newest-first inside each group). */
export function listAllSecondHandAds(): LocalSecondHandAd[] {
  return read().sort((a, b) => b.isoCreatedAt.localeCompare(a.isoCreatedAt));
}

/** The customer's own ads — for «آگهی‌های من» in the account area. */
export function listMySecondHandAds(): LocalSecondHandAd[] {
  return read().sort((a, b) => b.isoCreatedAt.localeCompare(a.isoCreatedAt));
}

/** Merge for the public grid: mine + fixtures, one typed list. */
export function mergedSecondHandFeed(): (SecondHandProduct & { mine?: boolean })[] {
  const mine = listAllSecondHandAds().map((ad) => ({ ...ad }));
  const mineIds = new Set(mine.map((ad) => ad.id));
  return [...mine, ...secondHandProducts.filter((item) => !mineIds.has(item.id))];
}

export function createSecondHandAd(draft: SecondHandAdDraft): { ok: true; ad: LocalSecondHandAd } | { ok: false; error: string } {
  const title = draft.title.trim();
  const city = draft.city.trim();
  const description = draft.description.trim();
  if (title.length < 3) return { ok: false, error: "عنوان آگهی باید حداقل ۳ نویسه باشد" };
  if (!getCategory(draft.categorySlug)) return { ok: false, error: "دسته‌بندی را انتخاب کن" };
  if (!Number.isFinite(draft.price) || draft.price <= 0) return { ok: false, error: "قیمت باید عددی مثبت باشد" };
  if (!AD_CONDITIONS.includes(draft.condition)) return { ok: false, error: "وضعیت کالا را انتخاب کن" };
  if (!city) return { ok: false, error: "شهر را وارد کن" };
  if (description.length < 20) return { ok: false, error: "توضیحات باید حداقل ۲۰ نویسه باشد" };
  if (draft.image && !draft.image.startsWith("data:image/")) return { ok: false, error: "تصویر نامعتبر است" };

  const now = new Date().toISOString();
  const id = `my-${uid()}`;
  const ad: LocalSecondHandAd = {
    id,
    slug: id,
    title,
    category: draft.categorySlug,
    categoryLabel: adCategoryLabel(draft.categorySlug),
    price: Math.round(draft.price),
    condition: draft.condition,
    city,
    sellerName: "تو",
    image: draft.image || secondHandProducts[0]?.image || "",
    description,
    age: draft.age?.trim() || "نامشخص",
    reason: draft.reason?.trim() || "—",
    status: "active",
    // Same contract as the fixtures: createdAt is the Persian display date;
    // isoCreatedAt carries the sortable ISO stamp.
    createdAt: faDate(now),
    isoCreatedAt: now,
    mine: true,
  };

  const ads = read();
  write([ad, ...ads].slice(0, MAX_ADS));
  return { ok: true, ad };
}

export function markSecondHandAdSold(id: string): LocalSecondHandAd | null {
  const ads = read();
  const target = ads.find((ad) => ad.id === id);
  if (!target) return null;
  const next = { ...target, status: "sold" as const };
  write(ads.map((ad) => (ad.id === id ? next : ad)));
  return next;
}

export function removeSecondHandAd(id: string): boolean {
  const ads = read();
  if (!ads.some((ad) => ad.id === id)) return false;
  write(ads.filter((ad) => ad.id !== id));
  return true;
}

// ------------------------------------------------------------
// SAVED ADS — the heart button on /second-hand. Kept in this module (NOT the
// product wishlist) because sh*/my-* ids can never resolve as products.
// ------------------------------------------------------------
const SAVED_KEY = "homeino-secondhand-saved";

let memorySaved: string[] = [];

export function listSavedAdIds(): string[] {
  if (typeof window === "undefined") return memorySaved;
  try {
    const raw = window.localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function toggleSavedAd(id: string): boolean {
  const current = listSavedAdIds();
  const has = current.includes(id);
  const next = has ? current.filter((x) => x !== id) : [...current, id];
  if (typeof window === "undefined") {
    memorySaved = next;
    return !has;
  }
  try {
    window.localStorage.setItem(SAVED_KEY, JSON.stringify(next));
  } catch {
    memorySaved = next; // non-critical — session memory keeps working
  }
  return !has;
}

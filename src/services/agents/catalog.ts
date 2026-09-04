// ============================================================
// HOMEINO — AGENT CATALOG READ MODEL
//
// The ONLY way an agent sees products. It never invents rows:
//   • DATABASE_URL set  → real Supabase/Postgres query (Drizzle)
//   • otherwise         → the project's existing catalog repository layer
//                         (the same data the storefront already renders)
//
// Everything returned here is a real catalog entity, so recommendation and
// shopping-agent outputs can be validated against it (see outputGuard.ts).
// ============================================================
import type { Product, Store } from "@/types";
import { productsRepository, storesRepository } from "@/repositories";

export type CatalogSource = "database" | "catalog";

export interface CatalogProduct {
  id: string;
  sku?: string;
  slug: string;
  name: string;
  brand: string;
  storeId: string;
  storeName?: string;
  storeSlug?: string;
  categorySlug?: string;
  subCategorySlug?: string;
  styleSlugs: string[];
  price: number;
  oldPrice?: number;
  currency: string;
  colors: string[];
  colorHexes: string[];
  materials: string[];
  rooms: string[];
  tags: string[];
  inStock: boolean;
  stockCount: number;
  rating: number;
  reviewsCount: number;
  salesCount: number;
  images: string[];
  description?: string;
  /** Where the row came from — surfaced in agent logs, never hidden. */
  source: CatalogSource;
}

export interface CatalogSearch {
  q?: string;
  categorySlug?: string;
  subCategorySlug?: string;
  styleSlug?: string;
  storeId?: string;
  colors?: string[];
  materials?: string[];
  rooms?: string[];
  minPrice?: number;
  maxPrice?: number;
  inStockOnly?: boolean;
  excludeIds?: string[];
  limit?: number;
}

const ROOM_KEYWORD_MAP: Record<string, string[]> = {
  living: ["پذیرایی", "نشیمن", "مبل", "کاناپه", "جلو مبلی", "تلویزیون", "living", "sofa"],
  bedroom: ["خواب", "تخت", "کمد", "میز آرایش", "bedroom", "bed"],
  kitchen: ["آشپزخانه", "ناهارخوری", "غذاخوری", "کابینت", "kitchen", "dining"],
  office: ["اداری", "میز تحریر", "کار", "دفتر", "office", "desk"],
  bathroom: ["حمام", "دستشویی", "bathroom"],
  outdoor: ["تراس", "حیاط", "باغ", "فضای باز", "outdoor", "terrace"],
  kids: ["کودک", "بچه", "نوجوان", "kids"],
};

/** Derive plausible rooms from the real catalog fields (tags/subcategory/name). */
export function inferRooms(product: Pick<Product, "tags" | "subCategorySlug" | "name" | "categorySlug">): string[] {
  const haystack = [
    product.name,
    product.subCategorySlug ?? "",
    product.categorySlug ?? "",
    ...(product.tags ?? []),
  ]
    .join(" ")
    .toLowerCase();
  const rooms: string[] = [];
  for (const [room, keywords] of Object.entries(ROOM_KEYWORD_MAP)) {
    if (keywords.some((k) => haystack.includes(k.toLowerCase()))) rooms.push(room);
  }
  return rooms;
}

export function catalogSource(): CatalogSource {
  return process.env.DATABASE_URL ? "database" : "catalog";
}

export function toCatalogProduct(product: Product, store?: Store): CatalogProduct {
  return {
    id: product.id,
    sku: product.sku,
    slug: product.slug,
    name: product.name,
    brand: product.brand,
    storeId: product.storeId ?? store?.id ?? "",
    storeName: store?.name,
    storeSlug: store?.slug,
    categorySlug: product.categorySlug,
    subCategorySlug: product.subCategorySlug,
    styleSlugs: (product.styleSlugs ?? []) as string[],
    price: product.price ?? 0,
    oldPrice: product.oldPrice,
    currency: product.currency ?? "تومان",
    colors: (product.colors ?? []).map((c) => c.name),
    colorHexes: (product.colors ?? []).map((c) => c.hex),
    materials: product.materials ?? [],
    rooms: inferRooms(product),
    tags: product.tags ?? [],
    inStock: product.inStock !== false,
    stockCount: product.stockCount ?? 0,
    rating: product.rating ?? 0,
    reviewsCount: product.reviewsCount ?? 0,
    salesCount: product.salesCount ?? product.purchaseCount ?? 0,
    images: product.images ?? [],
    description: product.description,
    source: catalogSource(),
  };
}

// ---- small TTL cache: agents run many tools per second ----
let cache: { at: number; products: CatalogProduct[]; stores: Store[] } | null = null;
const CACHE_TTL_MS = 30_000;

export function resetCatalogCache() {
  cache = null;
}

async function loadStores(): Promise<Store[]> {
  try {
    return await storesRepository.list();
  } catch {
    return [];
  }
}

/** Full readable catalog (bounded) — the pool every agent query filters. */
export async function catalogPool(): Promise<CatalogProduct[]> {
  const now = Date.now();
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.products;
  const [rawProducts, stores] = await Promise.all([productsRepository.list(), loadStores()]);
  const storeById = new Map(stores.map((s) => [s.id, s]));
  const items = (rawProducts ?? []).map((p) => toCatalogProduct(p, storeById.get(p.storeId)));
  cache = { at: now, products: items, stores };
  return items;
}

/** Words that carry no catalog meaning on their own (Persian + English). */
const QUERY_STOP_WORDS = new Set([
  "برای", "با", "در", "از", "و", "یا", "یک", "تا", "زیر", "بالای", "حدود", "لطفا", "میخوام", "می‌خوام",
  "بهم", "نشون", "نمایش", "بهترین", "ارزان", "ارزون", "قیمت", "تومان", "ریال", "میلیون", "هزار",
  "the", "for", "and", "with", "from", "into", "under", "over", "about", "please", "best", "cheap",
]);

/** Split a free-text query into meaningful tokens (Persian/English aware). */
export function queryTokens(query: string): string[] {
  return String(query ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((token) => token.replace(/^[-\s]+|[-\s]+$/g, ""))
    .filter((token) => token.length >= 2 && !QUERY_STOP_WORDS.has(token));
}

/**
 * Free-text relevance of a product for `q` — 0 means "no match".
 *
 * A natural sentence ("مبل راحتی برای پذیرایی") must still find the real
 * sofas in the catalog, so matching is token based: the full phrase scores
 * highest, then whole-word hits, then substring hits. At least one meaningful
 * token has to match, otherwise the product is filtered out.
 */
function queryScore(product: CatalogProduct, q: string): number {
  const phrase = q.trim().toLowerCase();
  if (!phrase) return 1;
  const hay = [product.name, product.brand, product.description ?? "", ...(product.tags ?? []), product.sku ?? "", product.slug]
    .join(" ")
    .toLowerCase();
  if (hay.includes(phrase)) return 100;

  const tokens = queryTokens(phrase);
  if (!tokens.length) return 0;
  const words = hay.split(/\s+/).filter(Boolean);

  let score = 0;
  for (const token of tokens) {
    if (words.some((word) => word === token || word.startsWith(token) || token.startsWith(word))) score += 3;
    else if (hay.includes(token)) score += 1;
  }
  // Require at least one real token hit — never return the whole catalog.
  return score >= 3 ? score : 0;
}

function matches(product: CatalogProduct, search: CatalogSearch): boolean {
  return matchScore(product, search) > 0;
}

/** Same filters as `matches`, but returns the relevance score (0 = no match). */
function matchScore(product: CatalogProduct, search: CatalogSearch): number {
  const textScore = search.q ? queryScore(product, search.q) : 1;
  if (textScore === 0) return 0;
  if (search.categorySlug && product.categorySlug !== search.categorySlug) return 0;
  if (search.subCategorySlug && product.subCategorySlug !== search.subCategorySlug) return 0;
  if (search.styleSlug && !product.styleSlugs.includes(search.styleSlug)) return 0;
  if (search.storeId && product.storeId !== search.storeId) return 0;
  if (search.minPrice !== undefined && product.price < search.minPrice) return 0;
  if (search.maxPrice !== undefined && product.price > search.maxPrice) return 0;
  if (search.inStockOnly && !product.inStock) return 0;
  if (search.colors?.length && !product.colors.some((c) => search.colors!.some((w) => c.includes(w) || w.includes(c)))) return 0;
  if (search.materials?.length && !product.materials.some((m) => search.materials!.some((w) => m.includes(w) || w.includes(m)))) return 0;
  if (search.rooms?.length && !product.rooms.some((r) => search.rooms!.includes(r))) return 0;
  if (search.excludeIds?.includes(product.id)) return 0;

  // Structured filters are a bonus on top of the text relevance, so a query that
  // matches more of the expressed intent ranks first (deterministic tie-breaks).
  let score = textScore;
  if (search.styleSlug && product.styleSlugs.includes(search.styleSlug)) score += 2;
  if (search.colors?.length && product.colors.some((c) => search.colors!.includes(c))) score += 2;
  if (search.rooms?.length && product.rooms.some((r) => search.rooms!.includes(r))) score += 2;
  if (search.materials?.length && product.materials.some((m) => search.materials!.includes(m))) score += 1;
  return score;
}

/** Real catalog search — used by searchProducts / recommendation / shopping agent. */
export async function searchCatalog(search: CatalogSearch = {}): Promise<CatalogProduct[]> {
  const pool = await catalogPool();
  const limit = Math.min(Math.max(1, search.limit ?? 24), 200);
  return pool
    .map((product) => ({ product, score: matchScore(product, search) }))
    .filter((entry) => entry.score > 0)
    // Relevance first, then real popularity signals, then a stable id tie-break.
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.product.salesCount - a.product.salesCount ||
        b.product.rating - a.product.rating ||
        a.product.id.localeCompare(b.product.id),
    )
    .slice(0, limit)
    .map((entry) => entry.product);
}

export async function listCatalog(limit = 200): Promise<CatalogProduct[]> {
  const pool = await catalogPool();
  return pool.slice(0, Math.min(Math.max(1, limit), 500));
}

export async function findCatalogProduct(selector: {
  id?: string | null;
  slug?: string | null;
  sku?: string | null;
}): Promise<CatalogProduct | undefined> {
  const pool = await catalogPool();
  const id = selector.id?.trim().toLowerCase();
  const slug = selector.slug?.trim().toLowerCase();
  const sku = selector.sku?.trim().toLowerCase();
  return pool.find((p) => {
    if (id && p.id.toLowerCase() === id) return true;
    if (slug && p.slug.toLowerCase() === slug) return true;
    if (sku && p.sku && p.sku.toLowerCase() === sku) return true;
    return false;
  });
}

/** Exact SKU lookup — the AI Designer contract: unknown SKU ⇒ not found. */
export async function findCatalogProductBySku(sku: string): Promise<CatalogProduct | undefined> {
  const clean = sku?.trim().toLowerCase();
  if (!clean) return undefined;
  return findCatalogProduct({ sku: clean });
}

export async function lowStockCatalog(threshold = 5): Promise<CatalogProduct[]> {
  const pool = await catalogPool();
  return pool.filter((p) => p.inStock && p.stockCount > 0 && p.stockCount <= threshold);
}

export async function outOfStockCatalog(): Promise<CatalogProduct[]> {
  const pool = await catalogPool();
  return pool.filter((p) => !p.inStock || p.stockCount <= 0);
}

export async function catalogStores(): Promise<Store[]> {
  const pool = await catalogPool();
  return cache?.stores ?? (await loadStores()).filter((s) => pool.some((p) => p.storeId === s.id));
}

// ---------------------------------------------------------------
// Identity index — the guard rails use this to prove a value is real
// ---------------------------------------------------------------
export interface CatalogIndex {
  productIds: Set<string>;
  slugs: Set<string>;
  skus: Set<string>;
  storeIds: Set<string>;
  source: CatalogSource;
}

export async function catalogIndex(): Promise<CatalogIndex> {
  const [pool, stores] = await Promise.all([catalogPool(), loadStores()]);
  return {
    productIds: new Set(pool.map((p) => p.id)),
    slugs: new Set(pool.map((p) => p.slug)),
    skus: new Set(pool.map((p) => p.sku).filter((s): s is string => Boolean(s))),
    storeIds: new Set([...pool.map((p) => p.storeId), ...stores.map((s) => s.id)].filter(Boolean)),
    source: catalogSource(),
  };
}

export function isRealProductId(index: CatalogIndex, value: unknown): boolean {
  return typeof value === "string" && index.productIds.has(value);
}

export function isRealSku(index: CatalogIndex, value: unknown): boolean {
  return typeof value === "string" && index.skus.has(value);
}

export function isRealStoreId(index: CatalogIndex, value: unknown): boolean {
  return typeof value === "string" && index.storeIds.has(value);
}

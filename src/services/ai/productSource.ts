// ============================================================
// HOMEINO — AI PRODUCT SOURCE (SERVER-ONLY)
//
// The SINGLE source of truth for products & stores in the AI
// pipeline:
//
//   Production (DATABASE_URL → Supabase Postgres)
//       → services/catalogService (Drizzle: products + product_images
//         + product_categories + inventory + vendors)
//   Development / tests (no DATABASE_URL)
//       → shipped seed catalog (src/data/products) — explicitly a
//         development fallback, never used when Supabase is configured.
//
// Guarantees:
//   • SKU resolution is EXACT (after trim/lowercase/whitespace
//     normalization) — never fuzzy, never invented.
//   • When Supabase is configured and the catalog is unreachable,
//     a safe AiError("CATALOG_UNAVAILABLE") is thrown — no silent
//     static fallback in production, no fake products.
//   • Product matching runs against the SAME source, so the pipeline
//     and the storefront can never disagree about the catalog.
// ============================================================

import type { Product, Store } from "../../types";
import { getProductBySkuOrCode as staticByCode } from "../../data/products";
import { products as staticCatalog } from "../../data/products";
import { stores as staticStores } from "../../data/stores";
import {
  matchStoreProducts,
  normalizeProductCode,
  type StoreMatchingOptions,
  type MatchedStoreProduct,
} from "./roomState";
import { AiError } from "./errors";

export { normalizeProductCode };

/** True when the real (Supabase) catalog is configured. */
export function isDatabaseCatalog(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export type ProductSource = "supabase" | "static";

export interface ResolvedProduct {
  product: Product;
  store?: Store;
  source: ProductSource;
}

// ---- DTO → domain mapping (mirrors repositories/products.ts toDomain) ----

type CatalogDto = Record<string, any>;

function dtoToProduct(d: CatalogDto, vendor?: { id?: string }): Product {
  const categorySlugs: string[] = d.categorySlugs ?? [];
  const ratingRaw = Number(d.rating ?? 0);
  return {
    id: d.id,
    slug: d.slug,
    sku: d.sku ?? undefined,
    name: d.title ?? d.name ?? "",
    brand: d.brand ?? d.vendor?.name ?? "",
    storeId: vendor?.id ?? d.vendor?.id ?? "",
    categorySlug: categorySlugs[0] ?? d.categorySlug ?? "",
    subCategorySlug: d.subCategorySlug ?? categorySlugs[1],
    styleSlugs: (d.styleSlugs ?? []) as Product["styleSlugs"],
    price: Number(d.price ?? 0),
    oldPrice: d.compareAtPrice != null ? Number(d.compareAtPrice) : undefined,
    currency: "تومان",
    rating: ratingRaw > 5 ? ratingRaw / 10 : ratingRaw,
    reviewsCount: Number(d.reviewsCount ?? 0),
    purchaseCount: Number(d.salesCount ?? 0),
    images: d.images ?? [],
    colors: d.color ? [{ name: d.color, hex: "#cdbfa6" }] : [],
    materials: d.material ? [d.material] : [],
    dimensions: typeof d.dimensions === "string" ? d.dimensions : undefined,
    description: d.description ?? d.shortDescription ?? "",
    specs: [],
    inStock: d.inStock ?? true,
    stockCount: d.availableQuantity ?? 0,
    trending: false,
    tags: d.tags ?? [],
  };
}

function vendorToStore(v: Record<string, any>): Store {
  return {
    id: v.id,
    slug: v.slug,
    name: v.name,
    logo: v.logo ?? v.name.slice(0, 1),
    logoColor: String(v.metadata?.logoColor ?? "#c2703f"),
    cover: v.cover ?? "",
    description: v.description ?? "",
    rating: Number(v.rating),
    reviewsCount: v.reviewsCount,
    productCount: 0,
    city: v.city ?? "",
    verified: v.verificationStatus === "verified",
    trending: false,
    isNew: false,
    categorySlugs: [],
    salesCount: v.salesCount,
    followersCount: v.followersCount,
    sinceYear: v.sinceYear ?? 1400,
    responseTime: v.responseTime ?? "",
    badges: v.badges ?? [],
    shippingPolicy: v.shippingPolicy ?? "",
    returnPolicy: v.returnPolicy ?? "",
  };
}

// ------------------------------------------------------------
// SKU / PRODUCT-CODE RESOLUTION (exact)
// ------------------------------------------------------------

/**
 * Resolves a SKU / product code against the single product source.
 * Normalization: trim → lowercase → collapse whitespace. Match is EXACT.
 * Returns undefined when the code does not exist — no invented products.
 * Throws AiError("CATALOG_UNAVAILABLE") only when Supabase is configured
 * but unreachable.
 */
export async function resolveProductByCode(code: string | undefined | null): Promise<ResolvedProduct | undefined> {
  const clean = normalizeProductCode(code);
  if (!clean) return undefined;

  if (isDatabaseCatalog()) {
    let dto: Record<string, any> | undefined;
    try {
      const { findProductByCode } = await import("../catalogService");
      dto = await findProductByCode(clean);
    } catch (err) {
      throw AiError.catalogUnavailable(undefined, err instanceof Error ? err.message : err);
    }
    if (!dto) return undefined; // production: NEVER fall back to static data
    const product = dtoToProduct(dto, dto.vendor);
    return { product, store: dto.vendor ? vendorToStore(dto.vendor) : undefined, source: "supabase" };
  }

  // Development / tests: shipped seed catalog
  const product = staticByCode(clean);
  return product
    ? { product, store: staticStores.find((s) => s.id === product.storeId), source: "static" }
    : undefined;
}

// ------------------------------------------------------------
// CATALOG LOADING (for multi-store matching)
// ------------------------------------------------------------

export interface CatalogPool {
  catalog: Product[];
  stores: Store[];
  source: ProductSource;
}

/**
 * Loads the product pool + real store directory for matching.
 * Production: active Supabase products (vendor-joined). On a catalog failure
 * this THROWS AiError("CATALOG_UNAVAILABLE") — callers decide whether an
 * honest empty result is acceptable (matching) or the request must fail (SKU).
 */
export async function loadCatalogForMatching(limit = 50): Promise<CatalogPool> {
  if (isDatabaseCatalog()) {
    const { listProducts, listVendors } = await import("../catalogService");
    try {
      const [res, vendorRows] = await Promise.all([listProducts({ limit, sort: "popular" }), listVendors()]);
      const catalog = res.items.map((d) => dtoToProduct(d as Record<string, any>));
      return { catalog, stores: vendorRows.map(vendorToStore), source: "supabase" };
    } catch (err) {
      throw AiError.catalogUnavailable(undefined, err instanceof Error ? err.message : err);
    }
  }
  return { catalog: staticCatalog, stores: staticStores, source: "static" };
}

// ------------------------------------------------------------
// STORE MATCHING (single-source, multi-store, never fake)
// ------------------------------------------------------------

/**
 * Priority-ranked multi-store matching against the single product source.
 * Priority: exact SKU ≫ exact product id ≫ category/target ≫ subcategory ≫
 * style ≫ color ≫ room ≫ budget ≫ availability. Returns [] when nothing
 * relevant exists — never unrelated filler products.
 */
export async function matchStoreProductsFromSource(options: StoreMatchingOptions): Promise<MatchedStoreProduct[]> {
  const pool = await loadCatalogForMatching();
  return matchStoreProducts({ ...options, catalog: pool.catalog, stores: pool.stores });
}

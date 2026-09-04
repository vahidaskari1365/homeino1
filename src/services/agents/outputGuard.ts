// ============================================================
// HOMEINO — AGENT OUTPUT GUARD
//
// The last line of defence before agent output reaches the database or the UI.
// It walks the produced object and:
//   • drops product references that do not exist in the real catalog
//   • drops invented SKUs and store ids
//   • overwrites any price with the catalog price of the matched product
//   • removes external URLs that were not produced by an allowed browser task
//   • flags the run as `no_data` when a product list ended up empty
//
// A failure here can never create a fake product, price, order or customer.
// ============================================================
import { catalogIndex, findCatalogProduct, type CatalogIndex, type CatalogProduct } from "./catalog";

export interface GuardRemoval {
  path: string;
  value: unknown;
  reason: string;
}

export interface GuardReport {
  removals: GuardRemoval[];
  warnings: string[];
  pricesCorrected: number;
  /** Set when the agent produced a product list that turned out empty. */
  emptyProductList: boolean;
}

export interface GuardedOutput {
  output: Record<string, unknown>;
  report: GuardReport;
}

const PRODUCT_LIST_KEYS = new Set(["products", "items", "recommendations", "matches", "results", "similar", "lowStockItems"]);
const PRICE_KEYS = new Set(["price", "amount", "total", "compareAtPrice", "oldPrice"]);
const ID_KEYS = new Set(["productId", "product_id", "id", "sku", "storeId", "store_id", "vendorId", "vendor_id"]);
const URL_KEYS = new Set(["url", "href", "link", "imageUrl", "image"]);
const MAX_DEPTH = 8;

interface WalkOptions {
  allowedHosts: string[];
  /** Validate the elements of `products` / `items` / … arrays as catalog references. */
  treatAsProductLists: boolean;
  /** True while walking the elements of such a list. */
  inProductList: boolean;
}

/** Identity + hint keys: an element of a product list that carries these is a product claim. */
const PRODUCT_IDENTITY_KEYS = ["productId", "product_id", "id", "slug", "productSlug", "sku", "SKU"];
const PRODUCT_HINT_KEYS = ["name", "title", "price"];

function looksLikeProductReference(source: Record<string, unknown>): boolean {
  return (
    "productId" in source ||
    "product_id" in source ||
    ("slug" in source && ("price" in source || "name" in source || "title" in source)) ||
    ("sku" in source && "name" in source)
  );
}

/** Inside a product list, `{ id, name }` / `{ id, price }` is a product claim too. */
function looksLikeListedProduct(source: Record<string, unknown>): boolean {
  return PRODUCT_IDENTITY_KEYS.some((key) => key in source) && PRODUCT_HINT_KEYS.some((key) => key in source);
}

export async function guardAgentOutput(
  output: Record<string, unknown>,
  options: { allowedExternalHosts?: string[]; treatAsProductLists?: boolean } = {},
): Promise<GuardedOutput> {
  const index = await catalogIndex();
  const report: GuardReport = { removals: [], warnings: [], pricesCorrected: 0, emptyProductList: false };
  const opts: WalkOptions = {
    allowedHosts: options.allowedExternalHosts ?? [],
    // Deny by default: anything an agent presents as a product list is verified.
    treatAsProductLists: options.treatAsProductLists !== false,
    inProductList: false,
  };
  const cleaned = (await walk(output, index, report, "$", 0, opts)) as Record<string, unknown>;
  const result = (cleaned ?? {}) as Record<string, unknown>;

  // A list the agent filled but the guard emptied == fabricated products.
  const before = summarizeProductLists(output).lists;
  const after = summarizeProductLists(result).lists;
  report.emptyProductList = Object.entries(before).some(([path, count]) => count > 0 && (after[path] ?? 0) === 0);

  return { output: result, report };
}

async function walk(
  value: unknown,
  index: CatalogIndex,
  report: GuardReport,
  path: string,
  depth: number,
  opts: WalkOptions,
): Promise<unknown> {
  if (depth > MAX_DEPTH) {
    report.warnings.push(`output truncated at ${path}`);
    return null;
  }
  if (Array.isArray(value)) {
    const out: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      const item = await walk(value[i], index, report, `${path}[${i}]`, depth + 1, opts);
      if (item !== undefined) out.push(item);
    }
    return out;
  }
  if (value && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    const looksLikeProduct =
      looksLikeProductReference(source) || (opts.inProductList && opts.treatAsProductLists && looksLikeListedProduct(source));

    let resolvedProduct: CatalogProduct | undefined;
    if (looksLikeProduct) {
      resolvedProduct = await resolveProduct(source, index);
      if (!resolvedProduct) {
        report.removals.push({
          path,
          value: { id: source.productId ?? source.id, sku: source.sku, name: source.name ?? source.title },
          reason: "product reference not found in the real catalog",
        });
        return undefined; // drop the whole object — never pass a fabricated product
      }
    }

    for (const [key, entry] of Object.entries(source)) {
      const childPath = `${path}.${key}`;

      if (looksLikeProduct && resolvedProduct) {
        if (ID_KEYS.has(key)) {
          const raw = String(entry ?? "");
          const valid =
            (key.toLowerCase().includes("sku") && index.skus.has(raw.toLowerCase())) ||
            (key.toLowerCase().includes("store") || key.toLowerCase().includes("vendor")
              ? index.storeIds.has(raw)
              : index.productIds.has(raw) || index.slugs.has(raw.toLowerCase()));
          if (!valid && raw) {
            report.removals.push({ path: childPath, value: raw, reason: `${key} does not match the resolved catalog product` });
            // Replace with the authoritative catalog value instead of dropping.
            result[key] = key.toLowerCase().includes("sku") ? resolvedProduct.sku ?? null : key === "id" || key === "productId" || key === "product_id" ? resolvedProduct.id : resolvedProduct.storeId;
            continue;
          }
        }
        if (PRICE_KEYS.has(key) && typeof entry === "number" && key === "price" && entry !== resolvedProduct.price) {
          report.removals.push({ path: childPath, value: entry, reason: "price replaced with the real catalog price" });
          result[key] = resolvedProduct.price;
          report.pricesCorrected += 1;
          continue;
        }
      }

      if (URL_KEYS.has(key) && typeof entry === "string" && entry) {
        if (!isAllowedUrl(entry, opts.allowedHosts)) {
          report.removals.push({ path: childPath, value: entry, reason: "external URL not produced by an allowed source" });
          continue;
        }
      }

      const childOpts: WalkOptions =
        Array.isArray(entry) && PRODUCT_LIST_KEYS.has(key)
          ? { ...opts, inProductList: true }
          : opts;
      const child = await walk(entry, index, report, childPath, depth + 1, childOpts);
      if (child !== undefined) result[key] = child;
    }

    if (looksLikeProduct && resolvedProduct) {
      // Always expose the canonical identifiers so the UI cannot drift.
      result.productId = resolvedProduct.id;
      result.slug = resolvedProduct.slug;
      if (resolvedProduct.sku) result.sku = resolvedProduct.sku;
      result.price = resolvedProduct.price;
      result.currency = resolvedProduct.currency;
    }
    return result;
  }
  return value;
}

async function resolveProduct(source: Record<string, unknown>, index: CatalogIndex): Promise<CatalogProduct | undefined> {
  const id = firstString(source.productId, source.product_id, source.id);
  const slug = firstString(source.slug, source.productSlug);
  const sku = firstString(source.sku, source.SKU);
  if (id && index.productIds.has(id)) return findCatalogProduct({ id });
  if (slug && index.slugs.has(slug.toLowerCase())) return findCatalogProduct({ slug });
  if (sku && index.skus.has(sku.toLowerCase())) return findCatalogProduct({ sku });
  return undefined;
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

export function isAllowedUrl(value: string, allowedHosts: string[]): boolean {
  const url = value.trim();
  if (url.startsWith("/")) return true; // internal route
  if (!/^https?:\/\//i.test(url)) return false;
  try {
    const parsed = new URL(url);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "https://homeino.ir";
    const hosts = [new URL(site).hostname, "images.pexels.com", "images.unsplash.com", "cdn.homeino.ir", ...allowedHosts];
    return hosts.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
}

/** Post-guard summary used in run logs. */
export function summarizeProductLists(output: Record<string, unknown>): { lists: Record<string, number>; empty: string[] } {
  const lists: Record<string, number> = {};
  const empty: string[] = [];
  const visit = (value: unknown, path: string, depth: number) => {
    if (depth > 4 || !value || typeof value !== "object") return;
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      if (Array.isArray(entry) && PRODUCT_LIST_KEYS.has(key)) {
        const products = entry.filter((item) => item && typeof item === "object");
        lists[`${path}.${key}`] = products.length;
        if (!products.length) empty.push(`${path}.${key}`);
      } else if (entry && typeof entry === "object") {
        visit(entry, `${path}.${key}`, depth + 1);
      }
    }
  };
  visit(output, "$", 0);
  return { lists, empty };
}

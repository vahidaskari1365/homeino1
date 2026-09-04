// ============================================================
// HOMEINO — PRODUCT MATCHING
//
// The bridge between agent output and the real catalog.
//   • SKU resolution is exact — an unknown SKU is reported as not found,
//     never replaced with a made-up product.
//   • Every match returned here is verified against the catalog index.
//   • Embeddings are computed for real catalog text (lexical by default,
//     model-based when Ollama / an OpenAI-compatible endpoint is configured).
// ============================================================
import {
  catalogIndex,
  catalogPool,
  catalogStores,
  findCatalogProduct,
  findCatalogProductBySku,
  searchCatalog,
  type CatalogProduct,
  type CatalogSearch,
} from "../agents/catalog";
import { embed, localEmbed, LOCAL_EMBED_MODEL, normalizeText } from "../agents/llmGateway";
import { rankProducts, type RankingContext, type RankingSignals, type ScoredProduct } from "./ranking";

export interface SkuResolution {
  status: "found" | "not_found" | "empty";
  sku: string;
  product?: CatalogProduct;
  /** Honest message the UI can show when the SKU does not exist. */
  message?: string;
}

/** Exact SKU lookup against the real catalog. */
export async function resolveSku(sku: string | null | undefined): Promise<SkuResolution> {
  const clean = String(sku ?? "").trim();
  if (!clean) return { status: "empty", sku: "" };
  const product = await findCatalogProductBySku(clean);
  if (!product) {
    return {
      status: "not_found",
      sku: clean,
      message: `کد محصول «${clean}» در کاتالوگ Homeino پیدا نشد. هیچ محصول جایگزینی ساخته نمی‌شود.`,
    };
  }
  return { status: "found", sku: clean, product };
}

/** Store ratings for the vendor-quality ranking factor (real store records). */
export async function storeRatings(): Promise<Map<string, number>> {
  const stores = await catalogStores();
  return new Map(stores.map((s) => [s.id, Number(s.rating ?? 0)]));
}

export function productEmbeddingText(product: CatalogProduct): string {
  return normalizeText(
    [product.name, product.brand, product.description ?? "", product.categorySlug ?? "", product.subCategorySlug ?? "", ...product.styleSlugs, ...product.colors, ...product.materials, ...product.rooms, ...product.tags]
      .filter(Boolean)
      .join(" "),
  );
}

let embeddingCache: { at: number; model: string; vectors: Map<string, number[]> } | null = null;
const EMBEDDING_TTL_MS = 10 * 60_000;

/**
 * Catalog embeddings. Uses a configured embedding model when available and
 * falls back to the deterministic local lexical embedder (still real text in,
 * real vector out — labelled with its model name).
 */
export async function buildCatalogEmbeddings(opts: { forceLocal?: boolean; limit?: number } = {}): Promise<{
  vectors: Map<string, number[]>;
  model: string;
  provider: string;
}> {
  const pool = await catalogPool();
  const items = pool.slice(0, opts.limit ?? 400);
  const cacheKey = opts.forceLocal ? LOCAL_EMBED_MODEL : "auto";
  if (embeddingCache && Date.now() - embeddingCache.at < EMBEDDING_TTL_MS && embeddingCache.model === cacheKey) {
    return { vectors: embeddingCache.vectors, model: embeddingCache.model === "auto" ? LOCAL_EMBED_MODEL : embeddingCache.model, provider: "cache" };
  }

  const texts = items.map(productEmbeddingText);
  let vectors: number[][];
  let model = LOCAL_EMBED_MODEL;
  let provider = "local-lexical";

  if (!opts.forceLocal) {
    const result = await embed(texts);
    vectors = result.vectors;
    model = result.model;
    provider = result.provider;
  } else {
    vectors = texts.map((t) => localEmbed(t));
  }

  const map = new Map<string, number[]>();
  items.forEach((product, index) => {
    const vector = vectors[index];
    if (vector?.length) map.set(product.id, vector);
  });
  embeddingCache = { at: Date.now(), model: cacheKey, vectors: map };
  return { vectors: map, model, provider };
}

export function resetEmbeddingCache() {
  embeddingCache = null;
}

export interface MatchOptions {
  limit?: number;
  signals?: Partial<RankingSignals>;
  useEmbeddings?: boolean;
}

/** Rank real catalog products against signals. Never returns invented rows. */
export async function matchRealProducts(signals: RankingSignals, options: MatchOptions = {}): Promise<ScoredProduct[]> {
  const limit = Math.min(Math.max(1, options.limit ?? 12), 60);
  const search: CatalogSearch = {
    q: signals.freeText,
    categorySlug: signals.categorySlug,
    subCategorySlug: signals.subCategorySlug,
    styleSlug: signals.styleSlugs?.[0],
    colors: signals.colors,
    materials: signals.materials,
    rooms: signals.rooms,
    minPrice: signals.budget?.min,
    maxPrice: signals.budget?.max,
    excludeIds: signals.excludeIds,
    limit: 200,
  };

  let candidates = await searchCatalog(search);

  // A strict filter can legitimately return nothing — widen step by step, but
  // only along dimensions the customer actually expressed.
  if (candidates.length < limit) {
    candidates = await searchCatalog({ ...search, colors: undefined, materials: undefined, rooms: undefined });
  }
  if (candidates.length < limit) {
    candidates = await searchCatalog({ ...search, styleSlug: undefined, colors: undefined, materials: undefined, rooms: undefined, minPrice: undefined, maxPrice: undefined });
  }
  if (candidates.length < limit) {
    const pool = await catalogPool();
    const seen = new Set(candidates.map((c) => c.id));
    candidates = [...candidates, ...pool.filter((p) => !seen.has(p.id))];
  }

  const ctx: RankingContext = { storeRatings: await storeRatings() };
  if (options.useEmbeddings !== false) {
    const { vectors } = await buildCatalogEmbeddings();
    if (vectors.size) {
      ctx.embeddings = vectors;
      const queryText = normalizeText(
        [signals.freeText ?? "", ...(signals.styleSlugs ?? []), ...(signals.colors ?? []), ...(signals.rooms ?? []), ...(signals.profile?.preferredStyles ?? []), ...(signals.profile?.preferredCategories ?? [])]
          .filter(Boolean)
          .join(" "),
      );
      if (queryText.trim()) ctx.profileEmbedding = localEmbed(queryText);
    }
  }

  return rankProducts(candidates, signals, ctx).slice(0, limit);
}

/** "مشابه این محصول" — seeded similarity over the real catalog. */
export async function findSimilarRealProducts(
  seed: CatalogProduct | string,
  options: MatchOptions & { profile?: RankingSignals["profile"] } = {},
): Promise<ScoredProduct[]> {
  const seedProduct = typeof seed === "string" ? await findCatalogProduct({ id: seed, slug: seed }) : seed;
  if (!seedProduct) return [];
  const limit = Math.min(Math.max(1, options.limit ?? 8), 40);
  const pool = await catalogPool();
  const candidates = pool.filter((p) => p.id !== seedProduct.id);
  const ctx: RankingContext = { storeRatings: await storeRatings() };
  if (options.useEmbeddings !== false) {
    const { vectors } = await buildCatalogEmbeddings();
    if (vectors.size) {
      ctx.embeddings = vectors;
      ctx.profileEmbedding = vectors.get(seedProduct.id) ?? localEmbed(productEmbeddingText(seedProduct));
    }
  }
  return rankProducts(
    candidates,
    {
      seed: seedProduct,
      profile: options.profile ?? null,
      excludeIds: [seedProduct.id, ...(options.signals?.excludeIds ?? [])],
      ...(options.signals ?? {}),
    },
    ctx,
  ).slice(0, limit);
}

// ------------------------------------------------------------
// Guard rails — used by the runtime to validate agent output
// ------------------------------------------------------------
export interface VerifiedItem {
  product: CatalogProduct;
  reasonCode?: string;
  reasonText?: string;
  score?: number;
  /** Optional caller-supplied position (1-based). */
  rank?: number;
  breakdown?: Record<string, number>;
}

/**
 * Drop anything that is not a real catalog product. Accepts ids, slugs, SKUs
 * or full objects — but only returns entries proven to exist.
 */
export async function verifyRealProducts(items: unknown[]): Promise<{ verified: VerifiedItem[]; rejected: { value: unknown; reason: string }[] }> {
  const index = await catalogIndex();
  const verified: VerifiedItem[] = [];
  const rejected: { value: unknown; reason: string }[] = [];
  const seen = new Set<string>();

  for (const item of items ?? []) {
    const candidate = (item ?? {}) as Record<string, unknown>;
    const id = firstString(candidate.productId, candidate.id, candidate.product_id);
    const slug = firstString(candidate.slug, candidate.productSlug);
    const sku = firstString(candidate.sku, candidate.SKU);

    let product: CatalogProduct | undefined;
    if (id && index.productIds.has(id)) product = await findCatalogProduct({ id });
    else if (slug && index.slugs.has(slug)) product = await findCatalogProduct({ slug });
    else if (sku && index.skus.has(sku.toLowerCase())) product = await findCatalogProductBySku(sku);

    if (!product) {
      rejected.push({ value: item, reason: "product not found in real catalog" });
      continue;
    }
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    verified.push({
      product,
      reasonCode: firstString(candidate.reasonCode, candidate.reason_code) ?? undefined,
      reasonText: firstString(candidate.reasonText, candidate.reason_text) ?? undefined,
      score: typeof candidate.score === "number" ? candidate.score : undefined,
      breakdown: (candidate.breakdown as Record<string, number> | undefined) ?? undefined,
    });
  }
  return { verified, rejected };
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return undefined;
}

/** Price sanity guard — a price may only come from the catalog row. */
export function catalogPriceOf(product: CatalogProduct): number {
  return Number.isFinite(product.price) ? product.price : 0;
}

import type { Product, StyleSlug } from "../types";
import {
  products as mockProducts, getProduct as mockBySlug, getProductById as mockById,
  getProductBySkuOrCode as mockBySku,
  productsByCategory as mockByCategory, productsByStyle as mockByStyle,
  similarProducts as mockSimilar, trendingProducts as mockTrending,
  getProductSalesCount as mockSales,
} from "../data/products";
import { normalizeCatalogRating } from "@/lib/rating";
import { scoreSimilarProducts } from "@/lib/similarProducts";
import { withDbFallback } from "./_fallback";

export interface ProductsRepository {
  list(): Promise<Product[]>; bySlug(slug: string): Promise<Product | undefined>;
  byId(id: string): Promise<Product | undefined>;
  bySku(sku: string): Promise<Product | undefined>;
  byCategory(slug: string): Promise<Product[]>;
  byStyle(slug: string): Promise<Product[]>; similar(productId: string, take?: number): Promise<Product[]>;
  trending(take?: number): Promise<Product[]>; salesCount(product: Product): Promise<number>;
}

async function remoteList(params: Record<string, string | number | boolean | undefined> = {}): Promise<Product[]> {
  const { listProducts } = await import("../services/catalogService");
  // 200 = the full catalog service ceiling — agents must see EVERY real row,
  // not a truncated first page (the old limit of 50 blinded them to the tail).
  const result = await listProducts({ ...params, limit: Number(params.limit ?? 200) });
  return result.items.map(toDomain);
}

function toDomain(value: Record<string, unknown>): Product {
  const vendor = value.vendor as { id?: string; name?: string } | undefined;
  const styleSlugs = (Array.isArray(value.styleSlugs) ? value.styleSlugs : []) as StyleSlug[];
  const categorySlugs = Array.isArray(value.categorySlugs) ? value.categorySlugs as string[] : [];
  const images = Array.isArray(value.images) ? value.images as string[] : [];
  const tags = Array.isArray(value.tags) ? value.tags as string[] : [];
  const color = typeof value.color === "string" ? value.color : undefined;
  const material = typeof value.material === "string" ? value.material : undefined;
  // Real per-color variants from the DB (name + hex) — the agent color tools
  // and PDP color advice read these; fallback to the single color column.
  const dtoColors = Array.isArray(value.colors)
    ? (value.colors as { name?: unknown; hex?: unknown }[])
    : [];
  const variantColors = dtoColors
    .map((c) => ({ name: String(c?.name ?? "").trim(), hex: String(c?.hex ?? "").trim() || "#cdbfa6" }))
    .filter((c) => c.name);
  return {
    id: String(value.id ?? ""),
    sku: typeof value.sku === "string" ? value.sku : undefined,
    slug: String(value.slug ?? ""),
    name: String(value.title ?? value.name ?? ""),
    brand: String(value.brand ?? vendor?.name ?? "هومینو"),
    storeId: String(vendor?.id ?? value.vendorId ?? ""),
    categorySlug: categorySlugs[0] ?? "furniture",
    subCategorySlug: typeof value.subCategorySlug === "string" ? value.subCategorySlug : undefined,
    styleSlugs,
    price: Number(value.price ?? 0),
    oldPrice: value.compareAtPrice != null ? Number(value.compareAtPrice) : undefined,
    currency: "تومان",
    rating: normalizeCatalogRating(value.rating),
    reviewsCount: Number(value.reviewsCount ?? 0),
    purchaseCount: Number(value.salesCount ?? 0),
    images,
    colors: variantColors.length ? variantColors : color ? [{ name: color, hex: "#cdbfa6" }] : [],
    materials: material ? [material] : [],
    dimensions: typeof value.dimensions === "string" ? value.dimensions : undefined,
    description: String(value.description ?? value.shortDescription ?? ""),
    specs: [],
    inStock: value.inStock !== false,
    stockCount: Number(value.availableQuantity ?? 0),
    trending: Number(value.salesCount ?? 0) > 100,
    tags,
    salesCount: Number(value.salesCount ?? 0),
  };
}

export const productsRepository: ProductsRepository = {
  list: async () => withDbFallback(mockProducts, () => remoteList()),
  bySlug: async (slug) => {
    if (!process.env.DATABASE_URL) return mockBySlug(slug);
    try {
      const { getProductBySlug } = await import("../services/catalogService");
      return toDomain(await getProductBySlug(slug) as unknown as Record<string, unknown>);
    } catch {
      return mockBySlug(slug);
    }
  },
  byId: async (id) => {
    const all = await withDbFallback(mockProducts, () => remoteList());
    return all.find(p => p.id === id) ?? mockById(id);
  },
  bySku: async (sku) => {
    const all = await withDbFallback(mockProducts, () => remoteList());
    const clean = sku.trim().toLowerCase();
    return all.find(p => (p.sku && p.sku.toLowerCase() === clean) || p.id.toLowerCase() === clean || p.slug.toLowerCase() === clean) || mockBySku(sku);
  },
  byCategory: async (slug) => withDbFallback(mockByCategory(slug), () => remoteList({ categorySlug: slug })),
  byStyle: async (slug) => withDbFallback(mockByStyle(slug), () => remoteList({ styleSlug: slug })),
  similar: async (id, take = 4) =>
    withDbFallback(mockSimilar(id, take), async () => {
      // Real style-overlap scoring over the live pool (shared styles × 2 +
      // same category + same store) — replaces the old "first N rows" stub
      // that had nothing to do with similarity.
      const all = await remoteList();
      const target = all.find((p) => p.id === id);
      if (!target) return [];
      return scoreSimilarProducts(target, all, take);
    }),
  trending: async (take = 12) => withDbFallback(mockTrending.slice(0, take), () => remoteList({ sort: "popular", limit: take })),
  salesCount: async (product) => {
    if (!process.env.DATABASE_URL) return mockSales(product);
    return product.salesCount ?? product.purchaseCount;
  },
};

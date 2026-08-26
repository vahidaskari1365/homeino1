import type { Product, StyleSlug } from "../types";
import {
  products as mockProducts, getProduct as mockBySlug, getProductById as mockById,
  getProductBySkuOrCode as mockBySku,
  productsByCategory as mockByCategory, productsByStyle as mockByStyle,
  similarProducts as mockSimilar, trendingProducts as mockTrending,
  getProductSalesCount as mockSales,
} from "../data/products";

export interface ProductsRepository {
  list(): Promise<Product[]>; bySlug(slug: string): Promise<Product | undefined>;
  byId(id: string): Promise<Product | undefined>;
  bySku(sku: string): Promise<Product | undefined>;
  byCategory(slug: string): Promise<Product[]>;
  byStyle(slug: string): Promise<Product[]>; similar(productId: string, take?: number): Promise<Product[]>;
  trending(take?: number): Promise<Product[]>; salesCount(product: Product): Promise<number>;
}

const hasDatabase = () => Boolean(process.env.DATABASE_URL);

async function remoteList(params: Record<string, string | number | boolean | undefined> = {}): Promise<Product[]> {
  const { listProducts } = await import("../services/catalogService");
  const result = await listProducts({ ...params, limit: Number(params.limit ?? 50) });
  return result.items.map(toDomain);
}

function toDomain(value: Record<string, any>): Product {
  return {
    id: value.id, sku: value.sku, slug: value.slug, name: value.title ?? value.name, brand: value.brand ?? value.vendor?.name ?? "هومینو",
    storeId: value.vendor?.id ?? value.vendorId ?? "", categorySlug: value.categorySlugs?.[0] ?? "furniture",
    styleSlugs: (value.styleSlugs ?? []) as StyleSlug[], price: value.price ?? 0,
    oldPrice: value.compareAtPrice ?? undefined, currency: "تومان", rating: Number(value.rating ?? 0) > 5 ? Number(value.rating) / 10 : Number(value.rating ?? 0),
    reviewsCount: value.reviewsCount ?? 0, purchaseCount: value.salesCount ?? 0, images: value.images ?? [],
    colors: value.color ? [{ name: value.color, hex: "#cdbfa6" }] : [], materials: value.material ? [value.material] : [],
    dimensions: typeof value.dimensions === "string" ? value.dimensions : undefined, description: value.description ?? value.shortDescription ?? "",
    specs: [], inStock: value.inStock ?? true, stockCount: value.availableQuantity ?? 0,
    trending: (value.salesCount ?? 0) > 100, tags: value.tags ?? [], salesCount: value.salesCount ?? 0,
  };
}

export const productsRepository: ProductsRepository = {
  list: async () => hasDatabase() ? remoteList() : mockProducts,
  bySlug: async (slug) => {
    if (!hasDatabase()) return mockBySlug(slug);
    const { getProductBySlug } = await import("../services/catalogService");
    try { return toDomain(await getProductBySlug(slug)); } catch { return undefined; }
  },
  byId: async (id) => hasDatabase() ? (await remoteList()).find(p => p.id === id) : mockById(id),
  bySku: async (sku) => {
    if (!hasDatabase()) return mockBySku(sku);
    // Production: EXACT lookup against the Supabase catalog — never a static
    // fallback and never an invented product.
    const clean = sku.trim().toLowerCase().replace(/\s+/g, " ");
    const { findProductByCode } = await import("../services/catalogService");
    const row = await findProductByCode(clean).catch(() => undefined);
    return row ? toDomain(row) : undefined;
  },
  byCategory: async (slug) => hasDatabase() ? remoteList({ categorySlug: slug }) : mockByCategory(slug),
  byStyle: async (slug) => hasDatabase() ? remoteList({ styleSlug: slug }) : mockByStyle(slug),
  similar: async (id, take = 4) => hasDatabase() ? (await remoteList()).filter(p => p.id !== id).slice(0, take) : mockSimilar(id, take),
  trending: async (take = 12) => hasDatabase() ? remoteList({ sort: "popular", limit: take }) : mockTrending.slice(0, take),
  salesCount: async (product) => hasDatabase() ? (product.salesCount ?? product.purchaseCount) : mockSales(product),
};

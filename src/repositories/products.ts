import type { Product, StyleSlug } from "../types";
import {
  products as mockProducts, getProduct as mockBySlug, getProductById as mockById,
  getProductBySkuOrCode as mockBySku,
  productsByCategory as mockByCategory, productsByStyle as mockByStyle,
  similarProducts as mockSimilar, trendingProducts as mockTrending,
  getProductSalesCount as mockSales,
} from "../data/products";
import { normalizeCatalogRating } from "@/lib/rating";
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
  const result = await listProducts({ ...params, limit: Number(params.limit ?? 50) });
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
  return {
    id: String(value.id ?? ""),
    sku: typeof value.sku === "string" ? value.sku : undefined,
    slug: String(value.slug ?? ""),
    name: String(value.title ?? value.name ?? ""),
    brand: String(value.brand ?? vendor?.name ?? "هومینو"),
    storeId: String(vendor?.id ?? value.vendorId ?? ""),
    categorySlug: categorySlugs[0] ?? "furniture",
    styleSlugs,
    price: Number(value.price ?? 0),
    oldPrice: value.compareAtPrice != null ? Number(value.compareAtPrice) : undefined,
    currency: "تومان",
    rating: normalizeCatalogRating(value.rating),
    reviewsCount: Number(value.reviewsCount ?? 0),
    purchaseCount: Number(value.salesCount ?? 0),
    images,
    colors: color ? [{ name: color, hex: "#cdbfa6" }] : [],
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
  similar: async (id, take = 4) => withDbFallback(mockSimilar(id, take), async () => (await remoteList()).filter(p => p.id !== id).slice(0, take)),
  trending: async (take = 12) => withDbFallback(mockTrending.slice(0, take), () => remoteList({ sort: "popular", limit: take })),
  salesCount: async (product) => {
    if (!process.env.DATABASE_URL) return mockSales(product);
    return product.salesCount ?? product.purchaseCount;
  },
};

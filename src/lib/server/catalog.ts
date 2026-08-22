import type { Product, Category, ProductSpec } from "@/types";
import { products as mockProducts } from "@/data/products";
import { listProducts, getCategoryTree } from "@/services/catalogService";

/**
 * Server-side catalog integration.
 *
 * This is the single seam between the (previously mock-only) frontend and the
 * real backend + database. Every page that needs marketplace data should read
 * through here instead of importing `@/data/*` directly.
 *
 * Behaviour:
 *   - When a real DATABASE_URL is configured, it reads live rows through the
 *     backend service and maps them to the frontend domain types.
 *   - When no database is reachable (build time, local dev without Postgres),
 *     it falls back to the shipped mock catalogs so the site never breaks.
 */

type SerializedProduct = {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  price: number | string;
  compareAtPrice: number | string | null;
  currency: string | null;
  rating: number | string | null;
  reviewsCount: number | null;
  salesCount: number | null;
  images: string[];
  styleSlugs: string[];
  tags: string[];
  shortDescription: string | null;
  inStock: boolean;
  categorySlugs: string[];
  vendor?: { id: string; slug: string; name: string; logo: string | null; verified: boolean; rating: number | string | null };
};

function mapSerialized(p: SerializedProduct): Product {
  const specs: ProductSpec[] = [];
  return {
    id: p.id,
    slug: p.slug,
    name: p.title,
    brand: p.brand ?? p.vendor?.name ?? "",
    storeId: p.vendor?.id ?? "",
    categorySlug: p.categorySlugs[0] ?? "",
    styleSlugs: p.styleSlugs as Product["styleSlugs"],
    price: Number(p.price),
    oldPrice: p.compareAtPrice != null ? Number(p.compareAtPrice) : undefined,
    currency: (p.currency as Product["currency"]) ?? "تومان",
    rating: Number(p.rating) / 10,
    reviewsCount: Number(p.reviewsCount ?? 0),
    purchaseCount: Number(p.salesCount ?? 0),
    images: p.images,
    colors: [],
    materials: [],
    description: p.shortDescription ?? "",
    specs,
    inStock: p.inStock,
    stockCount: 0,
    tags: p.tags ?? [],
  };
}

/** Live products for the marketplace grid + landing surfaces. */
export async function getProductsForSite(): Promise<Product[]> {
  try {
    const res = await listProducts({ limit: 100 });
    const items = res?.items ?? [];
    if (items.length) return items.map(mapSerialized);
    return mockProducts;
  } catch {
    return mockProducts;
  }
}

/** Categories tree for nav + category pages. */
export async function getCategoriesForSite(): Promise<Category[]> {
  try {
    const tree = await getCategoryTree();
    if (Array.isArray(tree) && tree.length) return tree as unknown as Category[];
    const { categories } = await import("@/data/categories");
    return categories;
  } catch {
    const { categories } = await import("@/data/categories");
    return categories;
  }
}

export { mockProducts };

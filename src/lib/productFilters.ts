import type { Product, StyleSlug } from "@/types";
import { isStyleSlug } from "@/data/styles";

export type AvailabilityFilter = "in-stock" | "out-of-stock";
export type ProductSort = "newest" | "price-asc" | "price-desc" | "rating" | "discount";

export interface ProductFilterState {
  styles: StyleSlug[];
  categories: string[];
  colors: string[];
  materials: string[];
  stores: string[];
  availability?: AvailabilityFilter;
  priceMax?: number;
  onlyDiscount: boolean;
  onlyAiRecommended: boolean;
  sort: ProductSort;
}

/** Query keys owned by the product-filter UI. Other keys (q, sub, etc.) stay intact. */
export const PRODUCT_FILTER_QUERY_KEYS = [
  "style",
  "category",
  "color",
  "material",
  "store",
  "availability",
  "priceMax",
  "discount",
  "ai",
  "sort",
] as const;

type SearchParamsReader = Pick<URLSearchParams, "get">;

const csv = (value: string | null): string[] =>
  value
    ? Array.from(new Set(value.split(",").map((part) => part.trim()).filter(Boolean)))
    : [];

const isAvailability = (value: string | null): value is AvailabilityFilter =>
  value === "in-stock" || value === "out-of-stock";

const SORT_VALUES: ProductSort[] = ["newest", "price-asc", "price-desc", "rating", "discount"];

/** Parse shareable product filters from a URL. Invalid values fail closed/are ignored. */
export function parseProductFilters(searchParams: SearchParamsReader): ProductFilterState {
  const availability = searchParams.get("availability");
  const rawPrice = Number(searchParams.get("priceMax"));
  const rawSort = searchParams.get("sort") as ProductSort | null;

  return {
    styles: csv(searchParams.get("style")).filter(isStyleSlug),
    categories: csv(searchParams.get("category")),
    colors: csv(searchParams.get("color")),
    materials: csv(searchParams.get("material")),
    stores: csv(searchParams.get("store")),
    availability: isAvailability(availability) ? availability : undefined,
    priceMax: Number.isFinite(rawPrice) && rawPrice > 0 ? rawPrice : undefined,
    onlyDiscount: searchParams.get("discount") === "true",
    onlyAiRecommended: searchParams.get("ai") === "true",
    sort: rawSort && SORT_VALUES.includes(rawSort) ? rawSort : "newest",
  };
}

/**
 * Facets are OR-ed inside one group and AND-ed across groups.
 * Example: (modern OR minimal) AND (furniture) AND (wood) AND in-stock.
 */
export function filterProducts(source: Product[], filters: ProductFilterState): Product[] {
  const filtered = source.filter((product) => {
    if (filters.styles.length && !product.styleSlugs.some((style) => filters.styles.includes(style))) return false;
    if (filters.categories.length && !filters.categories.includes(product.categorySlug)) return false;
    if (filters.colors.length && !product.colors.some((color) => filters.colors.includes(color.name))) return false;
    if (filters.materials.length && !product.materials.some((material) => filters.materials.includes(material))) return false;
    if (filters.stores.length && !filters.stores.includes(product.storeId)) return false;
    if (filters.availability === "in-stock" && !product.inStock) return false;
    if (filters.availability === "out-of-stock" && product.inStock) return false;
    if (filters.priceMax != null && product.price > filters.priceMax) return false;
    if (filters.onlyDiscount && !product.oldPrice) return false;
    if (filters.onlyAiRecommended && !product.aiRecommended) return false;
    return true;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sort === "price-asc") return a.price - b.price;
    if (filters.sort === "price-desc") return b.price - a.price;
    if (filters.sort === "rating") return b.rating - a.rating;
    if (filters.sort === "discount") {
      const discountA = a.oldPrice ? (a.oldPrice - a.price) / a.oldPrice : 0;
      const discountB = b.oldPrice ? (b.oldPrice - b.price) / b.oldPrice : 0;
      return discountB - discountA;
    }
    // Mock data order is the current catalogue's newest-first order.
    return 0;
  });
}

export function uniqueProductColors(source: Product[]): string[] {
  return Array.from(new Set(source.flatMap((product) => product.colors.map((color) => color.name))));
}

export function uniqueProductMaterials(source: Product[]): string[] {
  return Array.from(new Set(source.flatMap((product) => product.materials))).sort((a, b) => a.localeCompare(b, "fa"));
}

export function productPriceCeiling(source: Product[]): number {
  const highest = Math.max(0, ...source.map((product) => product.price));
  return Math.max(500_000, Math.ceil(highest / 500_000) * 500_000);
}

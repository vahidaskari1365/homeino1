import { describe, expect, it } from "vitest";
import { scoreSimilarProducts } from "./similarProducts";
import type { Product } from "@/types";

function product(partial: Partial<Product> & { id: string }): Product {
  return {
    slug: `slug-${partial.id}`,
    name: `محصول ${partial.id}`,
    brand: "برند",
    storeId: "s1",
    categorySlug: "furniture",
    styleSlugs: [],
    price: 1_000_000,
    currency: "تومان",
    rating: 4,
    reviewsCount: 10,
    purchaseCount: 5,
    images: [],
    colors: [],
    materials: [],
    description: "",
    specs: [],
    inStock: true,
    stockCount: 3,
    tags: [],
    ...partial,
  };
}

const target = product({ id: "t", styleSlugs: ["minimal", "modern"], categorySlug: "furniture", storeId: "s1" });

describe("scoreSimilarProducts (shared style-overlap scorer)", () => {
  it("scores shared styles ×2 + same category + same store, best first", () => {
    const pool = [
      product({ id: "a", styleSlugs: ["minimal", "modern"], categorySlug: "furniture", storeId: "s1" }), // 4+1+1=6
      product({ id: "b", styleSlugs: ["minimal"], categorySlug: "decor", storeId: "s2" }), // 2
      product({ id: "c", styleSlugs: ["boho"], categorySlug: "furniture", storeId: "s1" }), // 0+1+1=2
      product({ id: "d", styleSlugs: ["rustic"], categorySlug: "lighting", storeId: "s9" }), // 0 → filtered out
    ];
    const result = scoreSimilarProducts(target, pool, 4);
    expect(result.map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("never returns the target itself and respects the take limit", () => {
    const pool = [target, ...Array.from({ length: 8 }, (_, i) => product({ id: `x${i}`, styleSlugs: ["minimal"] }))];
    const result = scoreSimilarProducts(target, pool, 3);
    expect(result).toHaveLength(3);
    expect(result.some((p) => p.id === "t")).toBe(false);
  });

  it("keeps a deterministic tie-break by id", () => {
    const pool = [product({ id: "y", styleSlugs: ["minimal"] }), product({ id: "x", styleSlugs: ["minimal"] })];
    const result = scoreSimilarProducts(target, pool, 4);
    expect(result.map((p) => p.id)).toEqual(["x", "y"]);
  });
});

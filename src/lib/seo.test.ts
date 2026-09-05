import { describe, expect, it } from "vitest";
import { articleJsonLd, breadcrumbJsonLd, productJsonLd, projectJsonLd, websiteJsonLd } from "./seo";

describe("productJsonLd", () => {
  it("converts Toman prices to Rial (IRR) truthfully", () => {
    const json = productJsonLd({
      name: "مبل راحتی", slug: "sofa-1", brand: "نور", price: 8_500_000, oldPrice: 12_000_000,
      images: ["/a.jpg"], rating: 4.5, reviewsCount: 12, description: "تست", inStock: true,
      category: "مبلمان", colors: ["کرم", "سرمه‌ای"],
    }) as Record<string, unknown>;
    const offers = json.offers as Record<string, unknown>;
    expect(offers.priceCurrency).toBe("IRR");
    expect(offers.price).toBe(85_000_000);
    expect(offers.availability).toBe("https://schema.org/InStock");
  });

  it("marks out-of-stock products and keeps rating data", () => {
    const json = productJsonLd({
      name: "میز", slug: "table-1", brand: "نور", price: 1_000, images: [],
      rating: 4, reviewsCount: 3, description: "تست", inStock: false,
      category: "مبلمان", colors: [],
    }) as Record<string, unknown>;
    const offers = json.offers as Record<string, unknown>;
    expect(offers.availability).toBe("https://schema.org/OutOfStock");
    const rating = json.aggregateRating as Record<string, unknown>;
    expect(rating.ratingValue).toBe(4);
    expect(rating.reviewCount).toBe(3);
  });
});

describe("articleJsonLd", () => {
  it("normalises Persian date strings to ISO", () => {
    const json = articleJsonLd({
      title: "راهنمای مبل", excerpt: "خلاصه", author: "نگار", date: "۱۴۰۳/۰۸/۱۰",
      cover: "/c.jpg", slug: "sofa-guide",
    }) as Record<string, unknown>;
    expect(json.datePublished).toBe("1403-08-10");
    expect(json["@type"]).toBe("Article");
  });
});

describe("projectJsonLd", () => {
  it("builds a CreativeWork with cover + gallery and Persian keywords", () => {
    const json = projectJsonLd({
      title: "پروژه نشیمن", id: "pr1", description: "توضیح", cover: "/cover.jpg",
      gallery: ["/g1.jpg", "/g2.jpg"], style: "مینیمال", room: "نشیمن", client: "خانم مرادی",
    }) as Record<string, unknown>;
    expect(json["@type"]).toBe("CreativeWork");
    expect(json.image).toEqual(["/cover.jpg", "/g1.jpg", "/g2.jpg"]);
    expect(json.keywords).toBe("مینیمال، نشیمن");
    const creator = json.creator as Record<string, unknown>;
    expect(creator.name).toBe("Homeino");
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers positions from 1 and emits absolute URLs", () => {
    const json = breadcrumbJsonLd([
      { name: "خانه", url: "/" },
      { name: "محصولات", url: "/products" },
    ]) as Record<string, unknown>;
    const items = json.itemListElement as Record<string, unknown>[];
    expect(items[0].position).toBe(1);
    expect(items[1].position).toBe(2);
    expect(String(items[0].item)).toMatch(/\/$/);
    expect(String(items[1].item)).toContain("/products");
  });
});

describe("websiteJsonLd", () => {
  it("declares a SearchAction pointing at /search", () => {
    const json = websiteJsonLd() as Record<string, unknown>;
    const action = json.potentialAction as Record<string, unknown>;
    expect(json["@type"]).toBe("WebSite");
    expect(String(action.target)).toContain("/search?q={search_term_string}");
    expect(action["query-input"]).toBe("required name=search_term_string");
  });
});

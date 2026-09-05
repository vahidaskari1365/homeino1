import { describe, expect, it } from "vitest";
import { buildProductAdvice, detectAdviceTopic } from "./productAdvice";
import { products } from "@/data/products";
import { getStyle } from "@/data/styles";

const sofa = products.find((p) => p.styleSlugs.length > 0 && p.colors.length > 0)!;

describe("detectAdviceTopic", () => {
  it("routes the three exact PDP chip texts to distinct topics", () => {
    expect(detectAdviceTopic("با چه محصولاتی ست می‌شود؟")).toBe("pair");
    expect(detectAdviceTopic("چه رنگی کنار این مناسب است؟")).toBe("color");
    expect(detectAdviceTopic("برای چه سبکی مناسب است؟")).toBe("style");
  });

  it("keeps unrelated questions out of the advice path", () => {
    expect(detectAdviceTopic("هزینه ارسال چقدره؟")).toBeNull();
    expect(detectAdviceTopic("سلام")).toBeNull();
  });
});

describe("buildProductAdvice — style", () => {
  it("names the REAL style of the product and stays short", () => {
    const advice = buildProductAdvice("style", sofa.slug);
    expect(advice).not.toBeNull();
    const primary = getStyle(sofa.styleSlugs[0])!;
    expect(advice!.text).toContain(primary.name);
    expect(advice!.text.length).toBeLessThan(400);
  });
});

describe("buildProductAdvice — color", () => {
  it("grounded in the product's own colors + a style-palette companion", () => {
    const advice = buildProductAdvice("color", sofa.slug);
    expect(advice).not.toBeNull();
    const ownColor = sofa.colors[0].name;
    expect(advice!.text).toContain(ownColor);
    expect(advice!.text.length).toBeLessThan(400);
  });
});

describe("buildProductAdvice — pair", () => {
  it("returns 2–3 real complementary products, none from the same sub-category", () => {
    const advice = buildProductAdvice("pair", sofa.slug);
    expect(advice).not.toBeNull();
    expect(advice!.products!.length).toBeGreaterThanOrEqual(2);
    expect(advice!.products!.length).toBeLessThanOrEqual(3);
    for (const card of advice!.products!) {
      const p = products.find((x) => x.id === card.id)!;
      expect(p).toBeTruthy();
      expect(p.categorySlug !== sofa.categorySlug || (p.subCategorySlug ?? "-") !== (sofa.subCategorySlug ?? "-")).toBe(true);
      expect(card.url).toBe(`/products/${p.slug}`);
      expect(card.price).toBe(p.price);
      expect(card.image).toBeTruthy();
    }
    // Every cited name must appear in the answer text.
    for (const card of advice!.products!) expect(advice!.text).toContain(card.name);
  });
});

describe("buildProductAdvice — resilience", () => {
  it("returns null for unknown products so callers fall back", () => {
    expect(buildProductAdvice("pair", "no-such-product")).toBeNull();
    expect(buildProductAdvice("style", "no-such-product")).toBeNull();
  });

  it("also accepts a product id (API context path)", () => {
    expect(buildProductAdvice("style", sofa.id)).not.toBeNull();
  });
});

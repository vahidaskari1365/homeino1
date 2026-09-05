import { describe, expect, it } from "vitest";

// PDP quick questions must be answered from the LIVE catalog:
//   • without a Postgres DATABASE_URL the repositories fall back to the
//     shipped mock catalog — the advice engine must still work there;
//   • with one (regression gate) it must resolve DB rows by sku/id/slug.
const DB = process.env.DATABASE_URL ?? "";
const isPostgres = /^postgres(ql)?:\/\//i.test(DB);

import { resolveProductAdvice } from "./productAdviceServer";
import { buildProductAdvice } from "./productAdvice";
import { products } from "@/data/products";

const sofa = products.find((p) => p.styleSlugs.length > 0 && p.colors.length > 0)!;

describe("productAdviceServer — resolveProductAdvice (catalog fallback)", () => {
  it("answers a pair question for a real catalog product with companion cards", async () => {
    const advice = await resolveProductAdvice("pair", sofa.slug);
    expect(advice).not.toBeNull();
    expect(advice!.text).toContain("ستِ کامل");
    expect(advice!.products?.length).toBeGreaterThan(0);
    // Companion cards are REAL catalog rows with PDP URLs.
    for (const card of advice!.products ?? []) {
      expect(card.url).toMatch(/^\/products\//);
      expect(card.price).toBeGreaterThan(0);
    }
  });

  it("answers color and style questions", async () => {
    const color = await resolveProductAdvice("color", sofa.slug);
    expect(color?.text).toContain("پایه‌ی رنگی");
    const style = await resolveProductAdvice("style", sofa.slug);
    expect(style?.text).toContain("روح");
  });

  it("accepts the canonical chip topics and rejects unrelated ones", async () => {
    expect(await resolveProductAdvice("color", sofa.slug)).not.toBeNull();
    expect(await resolveProductAdvice("هزینه ارسال چقدره؟", sofa.slug)).toBeNull();
  });

  it("returns null for an unknown product (caller falls back)", async () => {
    expect(await resolveProductAdvice("pair", "not-a-real-product-xyz")).toBeNull();
  });

  // Parity with the static engine only holds when both read the SAME mock
  // catalog — with a live DB the server path may legitimately diverge.
  it.runIf(!isPostgres)("stays consistent with the static engine on the shared catalog", async () => {
    const server = await resolveProductAdvice("color", sofa.slug);
    const staticAdvice = buildProductAdvice("color", sofa.slug);
    expect(server?.text).toBe(staticAdvice?.text);
  });
});

describe.skipIf(!isPostgres)("productAdviceServer — live database", () => {
  it(
    "resolves a DB product by slug and grounds the answer in DB rows",
    async () => {
      const { productsRepository } = await import("@/repositories");
      const pool = await productsRepository.list();
      expect(pool.length).toBeGreaterThan(0);
      const target = pool.find((p) => p.styleSlugs.length > 0 && p.slug);
      expect(target).toBeDefined();

      const advice = await resolveProductAdvice("pair", target!.slug);
      expect(advice).not.toBeNull();
      expect(advice!.products?.length).toBeGreaterThan(0);
      // Every companion card id must exist in the live DB pool — never invented.
      const ids = new Set(pool.map((p) => p.id));
      for (const card of advice!.products ?? []) expect(ids.has(card.id)).toBe(true);
    },
    30_000,
  );

  it(
    "resolves a DB product by its DB sku as well",
    async () => {
      const { productsRepository } = await import("@/repositories");
      const pool = await productsRepository.list();
      const withSku = pool.find((p) => p.sku && p.styleSlugs.length > 0);
      expect(withSku).toBeDefined();
      const advice = await resolveProductAdvice("color", withSku!.sku!);
      expect(advice).not.toBeNull();
    },
    30_000,
  );
});

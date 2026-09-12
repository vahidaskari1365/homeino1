import { describe, it, expect } from "vitest";
import { trendBriefs, trendDates, briefsByDate, latestTrendBriefs, trendCategories, TREND_CATEGORY_META } from "./trends";

/**
 * قرارداد داده‌ی «ترندهای روز» — این تست‌ها هم داده‌ی دستی امروز و هم
 * خروجی روزانه‌ی scripts/magazine-daily.mjs را کنترل می‌کنند.
 */
describe("trends data", () => {
  it("has briefs", () => {
    expect(trendBriefs.length).toBeGreaterThan(0);
  });

  it("slugs are unique", () => {
    const slugs = trendBriefs.map((b) => b.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("dates are ISO yyyy-mm-dd and list is sorted newest-first", () => {
    for (const b of trendBriefs) expect(b.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (let i = 1; i < trendBriefs.length; i++) {
      expect(trendBriefs[i - 1].date >= trendBriefs[i].date).toBe(true);
    }
    expect(trendDates[0]).toBe(trendBriefs[0].date);
  });

  it("every brief has the required editorial shape", () => {
    for (const b of trendBriefs) {
      expect(b.title.length).toBeGreaterThan(10);
      expect(b.summary.length).toBeGreaterThan(150); // بازنویسی اختصاصی، نه یک‌خطی
      expect(b.takeaway.length).toBeGreaterThan(20);
      expect(b.dateFa).toMatch(/[\u06F0-\u06F9]{4}\//);
      expect(b.cover).toMatch(/^\/images\/(trends|product-pins|trend-covers)\/.+\.(png|jpg|jpeg|webp)$/);
      expect(b.source.url).toMatch(/^https:\/\//);
      expect(b.source.name.length).toBeGreaterThan(2);
      expect(b.readTime).toBeGreaterThan(0);
      expect(Array.isArray(b.tags)).toBe(true);
    }
  });

  it("groups by date consistently", () => {
    const first = trendBriefs[0].date;
    const day = briefsByDate(first);
    expect(day.length).toBeGreaterThan(0);
    expect(day.every((b) => b.date === first)).toBe(true);
    expect(latestTrendBriefs(3).length).toBeLessThanOrEqual(3);
  });

  it("categories are from the editorial list (aligned with site categories)", () => {
    // همان فهرست CONTENT_CATEGORIES در scripts/magazine-daily.mjs — هم‌راستا با دسته‌بندی‌های سایت
    const allowed = TREND_CATEGORY_META.map((m) => m.label);
    for (const c of trendCategories) expect(allowed).toContain(c);
  });

  it("every brief category has hub metadata (slug for /trends/category/…)", () => {
    for (const b of trendBriefs) {
      const meta = TREND_CATEGORY_META.find((m) => m.label === b.category);
      expect(meta).toBeDefined();
      expect(meta?.slug).toMatch(/^[a-z-]+$/);
    }
  });

  it("optional GEO fields (keywords / faq) have a valid shape", () => {
    for (const b of trendBriefs) {
      if (b.keywords) {
        expect(Array.isArray(b.keywords)).toBe(true);
        expect(b.keywords.length).toBeGreaterThan(0);
        for (const k of b.keywords) expect(typeof k).toBe("string");
      }
      if (b.faq) {
        expect(b.faq.length).toBeGreaterThan(0);
        for (const f of b.faq) {
          expect(f.q.length).toBeGreaterThan(5);
          expect(f.a.length).toBeGreaterThan(10);
        }
      }
    }
  });
});

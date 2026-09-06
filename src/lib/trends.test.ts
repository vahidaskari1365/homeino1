import { describe, it, expect } from "vitest";
import { trendBriefs, trendDates, briefsByDate, latestTrendBriefs, trendCategories } from "./trends";

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
      expect(b.cover).toMatch(/^\/images\/trends\/.+\.(png|jpg|jpeg|webp)$/);
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

  it("categories are from the editorial list", () => {
    const allowed = ["رنگ", "مبلمان", "آشپزخانه", "حمام", "متریال", "سبک زندگی", "سبک‌ها", "هوشمند"];
    for (const c of trendCategories) expect(allowed).toContain(c);
  });
});

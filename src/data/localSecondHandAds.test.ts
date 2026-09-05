import type { AdCondition } from "./localSecondHandAds";
import { describe, expect, it } from "vitest";
import {
  createSecondHandAd,
  listMySecondHandAds,
  listAllSecondHandAds,
  markSecondHandAdSold,
  removeSecondHandAd,
  mergedSecondHandFeed,
  toggleSavedAd,
  listSavedAdIds,
  adCategories,
  adCategoryLabel,
  MAX_IMAGE_BYTES,
} from "./localSecondHandAds";

const draft = {
  title: "کاناپه سه نفره طوسی",
  categorySlug: "furniture",
  price: 9_500_000,
  condition: "خوب" as const,
  city: "تهران",
  age: "۱ سال",
  reason: "اسباب‌کشی",
  description: "کاناپه سه نفره با پارچه مخمل طوسی، بدون لکه و آسیب، عالی برای پذیرایی.",
};

describe("second-hand ads", () => {
  it("creates a valid ad with a real catalog category label", () => {
    const result = createSecondHandAd(draft);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.ad.categoryLabel).toBe("مبلمان");
    expect(result.ad.status).toBe("active");
    expect(result.ad.mine).toBe(true);
    expect(result.ad.isoCreatedAt).toBeTruthy();
  });

  it("rejects invalid drafts with a Persian error", () => {
    expect(createSecondHandAd({ ...draft, title: "ک" }).ok).toBe(false);
    expect(createSecondHandAd({ ...draft, price: 0 }).ok).toBe(false);
    expect(createSecondHandAd({ ...draft, categorySlug: "nope" }).ok).toBe(false);
    expect(createSecondHandAd({ ...draft, description: "کم" }).ok).toBe(false);
    expect(createSecondHandAd({ ...draft, city: "  " }).ok).toBe(false);
    expect(createSecondHandAd({ ...draft, condition: "نوک" as unknown as AdCondition }).ok).toBe(false);
  });

  it("lists my ads newest-first and merges them with fixtures", () => {
    const first = createSecondHandAd(draft);
    const second = createSecondHandAd({ ...draft, title: "میز کنسول چوبی" });
    expect(first.ok && second.ok).toBe(true);

    const mine = listMySecondHandAds();
    expect(mine.length).toBeGreaterThanOrEqual(2);
    expect(mine[0].title).toBe("میز کنسول چوبی"); // newest first

    const feed = mergedSecondHandFeed();
    expect(first.ok && feed.some((item) => item.id === first.ad.id)).toBe(true);
    expect(feed.some((item) => item.id === "sh1")).toBe(true); // fixtures still present
  });

  it("marks sold and removes", () => {
    const result = createSecondHandAd(draft);
    if (!result.ok) throw new Error("setup failed");
    const sold = markSecondHandAdSold(result.ad.id);
    expect(sold?.status).toBe("sold");
    expect(listAllSecondHandAds().find((ad) => ad.id === result.ad.id)?.status).toBe("sold");
    expect(removeSecondHandAd(result.ad.id)).toBe(true);
    expect(listAllSecondHandAds().find((ad) => ad.id === result.ad.id)).toBeUndefined();
    expect(removeSecondHandAd("my-nope")).toBe(false);
  });

  it("saved-ids toggle is honest (no product-wishlist pollution)", () => {
    expect(toggleSavedAd("sh3")).toBe(true);
    expect(listSavedAdIds()).toContain("sh3");
    expect(toggleSavedAd("sh3")).toBe(false);
    expect(listSavedAdIds()).not.toContain("sh3");
  });

  it("category helpers come from the real catalog", () => {
    expect(adCategories().length).toBeGreaterThanOrEqual(9);
    expect(adCategoryLabel("rugs")).toBe("فرش و کف");
    expect(adCategoryLabel("unknown")).toBe("دسته‌بندی");
  });

  it("keeps uploaded images inside the storage quota", () => {
    expect(MAX_IMAGE_BYTES).toBeLessThan(1024 * 1024);
  });
});

import { and, desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { products as productsTable, profiles, reviews, users, vendorSettings, vendors } from "@/db/schema";
import { productsRepository } from "@/repositories/products";
import { productsByStore as mockProductsByStore } from "@/data/products";
import { getStorefrontProfile, reviewsForStore } from "@/data/storefronts";
import { getStore as mockGetStore } from "@/data/stores";
import type { Product, Store, StoreReview, StorefrontProfile } from "@/types";

// ============================================================
// HOMEINO — صفحهٔ فروشگاه واقعی (Task 60 — «اتصال /stores/[slug] به دیتابیس»)
//
// تا امروز صفحهٔ فروشگاه فقط از دادهٔ ثابت محلی می‌خواند؛ فروشگاه‌های
// تازه‌تأییدِ بک‌اند هیچ حضوری در storefront نداشتند. حالا منبع حقیقت
// دیتابیس است: فروشگاه فعالِ DB + کالاهای فعالِ همان vendor + نظرات
// واقعی تأییدشده. اگر DB نبود یا فروشگاه در DB نبود، صادقانه همان
// کاتالوگ دمو (fixtures) نمایش داده می‌شود — هیچ عدد فیک ساخته نمی‌شود.
// ============================================================

export interface StorePageData {
  store: Store;
  products: Product[];
  profile: StorefrontProfile | null;
  reviews: StoreReview[];
  /** db = دادهٔ واقعی سرور · demo = کاتالوگ نمونهٔ محلی (بدون DB یا فروشگاه دمو) */
  source: "db" | "demo";
}

function toFaDigits(n: number): string {
  return Number(n).toLocaleString("fa-IR");
}

/** پروفایل ویترین از vendor + vendor_settings واقعی (جای fixtures). */
function profileFromDb(
  vendor: typeof vendors.$inferSelect,
  settings: typeof vendorSettings.$inferSelect | undefined,
): StorefrontProfile {
  return {
    storeId: vendor.id,
    joinedAt: vendor.sinceYear ? toFaDigits(vendor.sinceYear) : "تازه",
    fulfilledOrders: vendor.salesCount,
    responseRate: 0, // در DB هنوز ثبت نمی‌شود — صفحه از این فیلد استفاده نمی‌کند
    responseTime: vendor.responseTime ?? "",
    dispatchTime: settings?.dispatchTime ?? "",
    shippingCoverage: settings?.shippingCoverage ?? "",
    shippingNote: settings?.shippingNote ?? "",
    returnDays: vendor.returnDays,
    returnNote: settings?.returnNote ?? "",
    authenticityNote:
      settings?.authenticityNote ??
      (vendor.verificationStatus === "verified" ? "هویت و اطلاعات فروشگاه توسط Homeino بررسی شده است." : ""),
  };
}

/** نظرات واقعی و تأییدشدهٔ کالاهای این فروشگاه (users join برای نام نویسنده). */
async function dbStoreReviews(vendorId: string): Promise<StoreReview[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      content: reviews.content,
      verifiedPurchase: reviews.verifiedPurchase,
      createdAt: reviews.createdAt,
      authorName: profiles.name,
      authorEmail: users.email,
    })
    .from(reviews)
    .innerJoin(productsTable, eq(productsTable.id, reviews.productId))
    .innerJoin(users, eq(users.id, reviews.userId))
    .leftJoin(profiles, eq(profiles.userId, reviews.userId))
    .where(and(eq(productsTable.vendorId, vendorId), eq(reviews.status, "approved")))
    .orderBy(desc(reviews.createdAt))
    .limit(8);

  return rows.map((r) => ({
    id: r.id,
    storeId: vendorId,
    author: r.authorName?.trim() || r.authorEmail.split("@")[0] || "کاربر هومینو",
    rating: r.rating,
    date: new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium" }).format(r.createdAt),
    comment: r.content?.trim() || r.title?.trim() || "",
    verifiedPurchase: r.verifiedPurchase,
  }));
}

/**
 * همهٔ دادهٔ صفحهٔ فروشگاه — DB-first با fallback صادقانه به دمو.
 * null یعنی نه در DB بود و نه در کاتالوگ دمو → صفحه 404.
 */
export async function getStorePageData(slug: string): Promise<StorePageData | null> {
  if (process.env.DATABASE_URL) {
    try {
      const db = getDb();
      const [vendor] = await db
        .select()
        .from(vendors)
        .where(and(eq(vendors.slug, slug), eq(vendors.status, "active")))
        .limit(1);

      if (vendor) {
        const [{ count: productCount }] = await db
          .select({ count: sql<number>`count(*)::int` })
          .from(productsTable)
          .where(and(eq(productsTable.vendorId, vendor.id), eq(productsTable.status, "active")));

        const [settings] = await db
          .select()
          .from(vendorSettings)
          .where(eq(vendorSettings.vendorId, vendor.id))
          .limit(1);

        const store: Store = {
          id: vendor.id,
          slug: vendor.slug,
          name: vendor.name,
          logo: vendor.logo ?? vendor.name.slice(0, 1),
          logoColor: String(vendor.metadata?.logoColor ?? "#c2703f"),
          cover: vendor.cover ?? "",
          description: vendor.description ?? "",
          rating: Number(vendor.rating),
          reviewsCount: vendor.reviewsCount,
          productCount: Number(productCount ?? 0),
          city: vendor.city ?? "",
          verified: vendor.verificationStatus === "verified",
          trending: vendor.salesCount > 1000,
          isNew: false,
          categorySlugs: [],
          salesCount: vendor.salesCount,
          followersCount: vendor.followersCount,
          sinceYear: vendor.sinceYear ?? 1400,
          responseTime: vendor.responseTime ?? "",
          badges: vendor.badges ?? [],
          shippingPolicy: vendor.shippingPolicy ?? "",
          returnPolicy: vendor.returnPolicy ?? "",
        };

        const [products, storeReviews] = await Promise.all([
          productsRepository.byStore(slug, () => []),
          dbStoreReviews(vendor.id),
        ]);

        return {
          store,
          products,
          profile: profileFromDb(vendor, settings),
          reviews: storeReviews,
          source: "db",
        };
      }
    } catch {
      // DB نبود یا خطا → مسیر دمو (honest degradation)
    }
  }

  // مسیر دمو: همان fixtures محلی (فروشگاه‌های st1..st10) — مثل قبل.
  // (storesRepository.bySlug هم DB را می‌گردد؛ اما تا اینجا فقط وقتی
  // می‌رسیم که vendor فعالِ DB برای این slug وجود نداشته باشد.)
  const store = mockGetStore(slug);
  if (!store) return null;
  return {
    store,
    products: mockProductsByStore(store.id),
    profile: getStorefrontProfile(store.id) ?? null,
    reviews: reviewsForStore(store.id),
    source: "demo",
  };
}

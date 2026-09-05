// ============================================================
// PLATFORM CLAIMS — central source of truth for all marketing
// and trust claims. Every number/policy displayed to users
// comes from here, so it can be swapped to backend API later.
//
// Rule: NEVER hardcode a claim in a component.
//       ALWAYS import from here.
// ============================================================

export const PLATFORM = {
  brand: "Homeino",
  domain: "homeino.ir",

  // ---- Policies (platform-defined, not per-product) ----
  policies: {
    freeShippingThreshold: 5_000_000,   // تومان
    returnDays: 7,
    securePayment: true,
    authenticityGuarantee: true,
  },

  // ---- AI ----
  ai: {
    startingCredits: 120,
    isPreviewMode: process.env.NODE_ENV !== "production" || !process.env.GEMINI_API_KEY,
  },

  // ---- Social proof config ----
  // In production, these come from /api/stats (backend). For now,
  // they are computed dynamically from mock data — never fake.
  socialProof: {
    showTestimonials: process.env.NODE_ENV !== "production",
    showRating: false, // until real aggregate rating exists
  },

  // ---- Growth / Referral ----
  // UI-ready for referral program. Backend will handle actual tracking.
  referral: {
    enabled: false,
    inviterBonus: 50,        // credits for inviting someone
    inviteeBonus: 30,        // credits for the invited person
    inviteeMinSpend: 1,      // minimum purchase to trigger bonus (0 = on signup)
    shareMessage: "با کد دعوت من ثبت‌نام کن و ۳۰ اعتبار هوش مصنوعی رایگان بگیر!",
  },

  // ---- Vendor marketplace economics (display-only until real settlement exists) ----
  // Single source for every commission/settlement figure shown in the demo.
  // Rule: the vendor panels NEVER hardcode these numbers — import them here.
  vendor: {
    commissionRatePercent: 8,   // کمیسیون پلتفرم از هر فروش
    demoStoreId: "st1",         // فروشگاه نمونهٔ پنل فروشنده
    demo: {
      enabled: true,
      label: "حالت دمو — این پنل با دادهٔ آزمایشی و بدون اتصال به پایگاه‌داده اجرا می‌شود.",
    },
  },
} as const;

// ---- Dynamic stats (from real data files) ----
export async function getPlatformStats() {
  // In production: fetch("/api/stats") → { products, stores, ... }
  // Today: compute from mock data
  const { products } = await import("@/data/products");
  const { stores } = await import("@/data/stores");
  return {
    productCount: products.length,
    storeCount: stores.length,
    // These are 0 until backend exists — never fake
    userCount: 0,
    reviewCount: 0,
    avgRating: 0,
  };
}

// ---- Helpers ----
export const formatThreshold = (t: number) => new Intl.NumberFormat("fa-IR").format(t);

// ============================================================
// HOMEINO — VISUAL SCAN & DECOR PLAN — SHARED WIRE TYPES
//
// Contract shared between the server services (visualScan.ts /
// decorPlan.ts — server-only) and the client UI. Pure types, no
// imports — so they can safely appear in both bundles.
// ============================================================

/** What the vision model understood from the uploaded item photo. */
export interface ScanIdentification {
  /** Short Persian label, e.g. «کاناپه سه‌نفره مخمل». null → not a decor item. */
  label: string | null;
  categorySlug: string;
  subCategory?: string;
  styleSlugs: string[];
  colors: string[];
  materials: string[];
  room?: string;
  confidence: number;
}

/** One matched site product — always a REAL catalog id, never invented. */
export interface ScanMatch {
  id: string;
  slug: string;
  name: string;
  brand: string;
  price: number;
  currency: string;
  image: string;
  categorySlug: string;
  score: number;
  /** One short Persian sentence — why this product matches the photo. */
  reason: string;
  inStock: boolean;
}

export interface VisualScanResult {
  /** False → no vision engine answered; matches are honest popularity picks. */
  visionAvailable: boolean;
  identified: ScanIdentification | null;
  matches: ScanMatch[];
  /** Honest note for the UI when vision was unavailable. */
  notice?: string;
}

/** Category label in Persian for chips/badges (catalog vocabulary). */
export interface DecorSuggestionPlan {
  id: string;
  title: string;
  desc: string;
  impact: "low" | "medium" | "high";
  /** Catalog category slug used for product matching (carpet, lighting…). */
  category: string;
  /** Up to 3 REAL catalog products that fulfil this suggestion. */
  products: ScanMatch[];
}

export interface DecorPlanResult {
  visionAvailable: boolean;
  /** Compact room summary for the UI header. */
  roomType: string;
  style: string;
  palette: string[];
  mood: string;
  /** 3–4 actionable suggestions, each grounded in real products. */
  suggestions: DecorSuggestionPlan[];
  /** Overall best products for this room (category-diverse, max 6). */
  topProducts: ScanMatch[];
  notice?: string;
}

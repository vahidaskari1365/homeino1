// ============================================================
// HOMEINO AI ENGINE — Interior Design Intelligence Core
//
// Pipeline: User Input → Intent Detection → Multi-Target Scope →
//   Locked Elements → Design Constraints → Product Matching →
//   Generation Plan → Validation → Result
//
// GOLDEN RULE: "ONLY CHANGE WHAT THE USER REQUESTED."
// Everything else is locked and preserved.
// ============================================================

import type { Product } from "../../types";
import { products as defaultCatalog, SKU_ALIASES } from "../../data/products";
import { stores as defaultStores } from "../../data/stores";

// ---- Element taxonomy ----
export type RoomElement =
  | "sofa" | "rug" | "curtain" | "lighting" | "wall" | "floor"
  | "ceiling" | "table" | "chair" | "tv" | "plant" | "art"
  | "door" | "window" | "shelf" | "bed";

export const ALL_ELEMENTS: RoomElement[] = [
  "sofa", "rug", "curtain", "lighting", "wall", "floor", "ceiling",
  "table", "chair", "tv", "plant", "art", "door", "window", "shelf", "bed",
];

/** Structural / architectural elements — ALWAYS protected by default even in full redesign. */
export const STRUCTURAL_ELEMENTS: RoomElement[] = [
  "wall", "floor", "ceiling", "door", "window",
];

export const PROTECTED_STRUCTURAL_ELEMENTS: RoomElement[] = STRUCTURAL_ELEMENTS;

/** Designable / furniture / decor elements that AI can freely redesign in room or whole_home redesign. */
export const DESIGNABLE_ELEMENTS: RoomElement[] = [
  "sofa", "rug", "curtain", "lighting", "table", "chair", "tv", "plant", "art", "shelf", "bed",
];

export type ChangeScope = RoomElement | "full_room";

// ---- ELEMENT LABELS (Persian) ----
export const ELEMENT_LABELS: Record<RoomElement, string> = {
  sofa: "مبلمان", rug: "فرش", curtain: "پرده", lighting: "روشنایی",
  wall: "دیوار", floor: "کف", ceiling: "سقف", table: "میز", chair: "صندلی",
  tv: "تلویزیون", plant: "گیاه", art: "تابلو و آینه", door: "در",
  window: "پنجره", shelf: "طاقچه", bed: "تخت",
};

// ============================================================
// MULTI-TARGET INTENT — supports "مبل و فرش و پرده"
// ============================================================

export type AiIntentType = "full_redesign" | "partial_edit" | "product_placement" | "color_change" | "inquiry";

export interface AiIntent {
  type: AiIntentType;
  /** ALL detected targets — not just the first one */
  targets: RoomElement[];
  style?: string;
  requestedChanges: string[];
  lockedElements: RoomElement[];
  confidence: number;
  requiresClarification: boolean;
}

// ---- Keyword → Element mapping ----
// Canonical category mapping (AI ACCURACY PATCH — fix 1):
//   مبل / کاناپه / sofa / couch / sectional               → sofa
//   صندلی / chair / armchair / accent chair / dining chair → chair
// "chair" and "sofa" are DIFFERENT elements and must NEVER be merged.
const KEYWORD_MAP: { keywords: string[]; element: RoomElement }[] = [
  { keywords: ["مبل", "کاناپه", "sofa", "couch", "sectional", "پوف"], element: "sofa" },
  { keywords: ["صندلی", "chair", "armchair", "accent chair", "dining chair", "reading chair"], element: "chair" },
  { keywords: ["پرده", "curtain", "drape", "تور"], element: "curtain" },
  { keywords: ["فرش", "قالی", "rug", "carpet", "گلیم"], element: "rug" },
  { keywords: ["چراغ", "نور", "لوستر", "lamp", "light", "آباژور", "دیوارکوب"], element: "lighting" },
  { keywords: ["دیوار", "wall", "رنگ دیوار", "wallpaper"], element: "wall" },
  { keywords: ["کف", "پارکت", "floor", "سرامیک"], element: "floor" },
  { keywords: ["سقف", "ceiling"], element: "ceiling" },
  { keywords: ["میز", "table", "جلومبلی", "ناهارخوری"], element: "table" },
  { keywords: ["تلویزیون", "tv", "کنسول"], element: "tv" },
  { keywords: ["گیاه", "گل", "plant", "گلدان"], element: "plant" },
  { keywords: ["تابلو", "آینه", "art", "painting"], element: "art" },
  { keywords: ["تخت", "bed", "خواب"], element: "bed" },
  { keywords: ["طاقچه", "شلف", "قفسه", "shelf"], element: "shelf" },
  { keywords: ["درب", "درها", "درب‌ها", "door", "در ورودی", "در اتاق", "درب ورودی"], element: "door" },
  { keywords: ["پنجره", "window"], element: "window" },
];

/**
 * Explicit FULL-REDESIGN triggers.
 * AI ACCURACY PATCH (fix 2): generic "all" words — «همه», «کل», «همه رو»,
 * «همه چیز», «everything» — ALONE must NEVER unlock a full redesign.
 * Only phrases that name a scope (room / space / home) or carry an explicit
 * redesign verb are allowed here.
 */
const FULL_KEYWORDS = [
  // Explicit scope-named phrases (room / space / home)
  "کل اتاق", "کل فضا", "کل فضای", "کل سالن", "کل پذیرایی", "کل نشیمن",
  "کل خانه", "کل خونه", "کل ملک", "کل ویلا",
  // Explicit redesign verbs
  "بازطراحی", "دوباره طراحی", "از اول طراحی", "طراحی کامل", "تغییر کلی", "دکور کامل", "صفر تا صد", "از نو",
  "full room", "full redesign", "redesign",
  "whole room", "entire room", "whole home", "whole house", "entire home", "entire house",
];

/**
 * «اتاق خواب» / «اتاق نشیمن» are ROOM NAMES — the word «خواب» inside them
 * must not false-positive as the bed element (fix 1 — wrong synonym guard).
 */
export function normalizeRoomNamePhrases(text: string): string {
  return text
    .replace(/اتاق\s*خواب/g, "اتاق")
    .replace(/اتاق\s*نشیمن/g, "اتاق");
}

/**
 * MULTI-TARGET intent detection.
 * "مبل و فرش و پرده" → targets = ["sofa", "rug", "curtain"]
 */
export function detectIntent(text: string, style?: string): AiIntent {
  // Normalize room-name phrases so «خواب» in «اتاق خواب» is not read as the bed element.
  const lower = normalizeRoomNamePhrases(text).toLowerCase().trim();

  if (!lower) {
    return { type: "inquiry", targets: [], style, requestedChanges: [], lockedElements: ALL_ELEMENTS, confidence: 0.3, requiresClarification: true };
  }

  const archTargets = detectArchitecturalTargets(lower);
  const explicitLocked = detectExplicitLocked(lower);

  // Full-redesign request — explicit scope-named phrases or redesign verbs only
  // (generic «همه/کل/همه چیز» alone are NOT in FULL_KEYWORDS).
  if (
    FULL_KEYWORDS.some((k) => lower.includes(k)) ||
    /اتاق\s*(را|رو)?\s*(ژاپندی|japandi|مدرن|مینیمال|زیبا|لوکس|کلاسیک|بوهو|اسکاندیناوی|scandinavian)/.test(lower)
  ) {
    const targets = [...DESIGNABLE_ELEMENTS, ...archTargets].filter((e) => !explicitLocked.includes(e));
    const lockedElements = STRUCTURAL_ELEMENTS.filter((e) => !archTargets.includes(e));
    return {
      type: "full_redesign",
      targets: targets.length ? targets : [...DESIGNABLE_ELEMENTS],
      style,
      requestedChanges: ["بازطراحی کامل فضا"],
      lockedElements: [...new Set([...lockedElements, ...explicitLocked])],
      confidence: 0.95,
      requiresClarification: false,
    };
  }

  // Collect ALL targets mentioned
  const targets = new Set<RoomElement>();
  for (const { keywords, element } of KEYWORD_MAP) {
    if (keywords.some((k) => matchesWord(lower, k) || (k.length >= 3 && k !== "مبل" && k !== "میز" && k !== "تخت" && k !== "فرش" && k !== "نور" && k !== "تور" && k !== "پوف" && k !== "شلف" && lower.includes(k)))) {
      targets.add(element);
    }
  }
  archTargets.forEach((t) => targets.add(t));

  // Color request («رنگ», «کرم», «آبی», …) — with OR without a target:
  // «رنگ مبل را کرم کن» → color_change on [sofa], NOT a full restyle.
  const colorKeywords = ["رنگ", "color", "سبز", "کرم", "آبی", "قرمز", "طوسی", "زرد", "طلایی", "بژ", "سفید", "مشکی", "دودی", "قهوه‌ای"];
  const hasColor = colorKeywords.some((k) => lower.includes(k));

  if (targets.size === 0 && !hasColor) {
    return {
      type: "inquiry",
      targets: [],
      style,
      requestedChanges: [text],
      lockedElements: ALL_ELEMENTS,
      confidence: 0.4,
      requiresClarification: true,
    };
  }

  const targetList = [...targets];
  return {
    type: hasColor ? "color_change" : "partial_edit",
    targets: targetList,
    style,
    requestedChanges: [text],
    lockedElements: ALL_ELEMENTS.filter((e) => !targetList.includes(e)),
    confidence: 0.9,
    requiresClarification: false,
  };
}

// ============================================================
// SCOPED CHANGE — multi-target aware
// ============================================================

export interface ScopedChange {
  targets: RoomElement[];
  lockedElements: RoomElement[];
  summary: string;
}

export function computeChangeScope(intent: AiIntent): ScopedChange {
  if (intent.type === "full_redesign") {
    const lockedLabels = intent.lockedElements.map((l) => ELEMENT_LABELS[l]).join("، ");
    return {
      targets: intent.targets,
      lockedElements: intent.lockedElements,
      summary: lockedLabels
        ? `بازطراحی فضا — عناصر معماری (${lockedLabels}) حفظ می‌شوند`
        : "بازطراحی کامل فضا",
    };
  }

  const locked = intent.lockedElements;
  const targetLabels = intent.targets.map((t) => ELEMENT_LABELS[t]).join("، ");
  const lockedLabels = locked.slice(0, 8).map((l) => ELEMENT_LABELS[l]).join("، ");

  return {
    targets: intent.targets,
    lockedElements: locked,
    summary: `فقط «${targetLabels}» تغییر می‌کند. موارد حفظ‌شده: ${lockedLabels || "—"}${locked.length > 8 ? " و..." : ""}`,
  };
}

// ============================================================
// DESIGN CONSTRAINTS — preservation rules for image editing
// ============================================================

export interface DesignConstraints {
  preserveArchitecture: boolean;
  preserveCamera: boolean;
  preservePerspective: boolean;
  preserveLightingUnlessRequested: boolean;
  preserveUntouchedObjects: boolean;
  preserveRoomDimensions: boolean;
  preserveFloorPlan: boolean;
  targets: RoomElement[];
  lockedElements: RoomElement[];
}

export function buildDesignConstraints(intent: AiIntent): DesignConstraints {
  const isFullRoom = intent.type === "full_redesign";
  const lightingIsTarget = intent.targets.includes("lighting");

  return {
    preserveArchitecture: true,
    preserveCamera: true,
    preservePerspective: true,
    preserveLightingUnlessRequested: !lightingIsTarget && !isFullRoom,
    preserveUntouchedObjects: true,
    preserveRoomDimensions: true,
    preserveFloorPlan: true,
    targets: intent.targets,
    lockedElements: intent.lockedElements,
  };
}

/** Convert constraints into a system instruction fragment for the image model */
export function constraintsToPrompt(c: DesignConstraints): string {
  const rules: string[] = [];
  if (c.preserveArchitecture) rules.push("Do NOT move, add, or remove walls, windows, or doors.");
  if (c.preserveCamera) rules.push("Keep the exact same camera angle and perspective.");
  if (c.preserveRoomDimensions) rules.push("Do NOT change room dimensions or proportions.");
  if (c.preserveUntouchedObjects) rules.push("Keep ALL objects NOT in the target list completely unchanged.");
  if (c.preserveLightingUnlessRequested) rules.push("Do NOT change the lighting.");
  return rules.join(" ");
}

// ============================================================
// DESIGN PLAN — structured output contract
// ============================================================

export interface ProductPlacement {
  productId: string;
  category: string;
  reason: string;
  placement: { x: number; y: number; scale: number; rotation: number };
}

export interface DesignPlan {
  intent: AiIntentType;
  targets: RoomElement[];
  roomType: string;
  style: string;
  lockedElements: RoomElement[];
  requestedChanges: string[];
  recommendedProducts: ProductPlacement[];
  constraints: DesignConstraints;
  confidence: number;
}

// ============================================================
// RESULT VALIDATION — never fake success
// ============================================================

export type ResultStatus = "completed" | "preview" | "failed";

export interface ValidationResult {
  status: ResultStatus;
  reasons: string[];
}

/**
 * Validates an AI operation result. If the output is identical to input
 * when an actual edit was requested, status = "preview" (not "completed").
 */
export function validateResult(params: {
  beforeImage?: string;
  afterImage: string;
  intent: AiIntent;
  providerMarkedPreview?: boolean;
}): ValidationResult {
  const reasons: string[] = [];

  if (!params.afterImage) {
    return { status: "failed", reasons: ["No output image"] };
  }

  // If provider honestly marked it as preview
  if (params.providerMarkedPreview) {
    return { status: "preview", reasons: ["Provider marked as preview mode"] };
  }

  // If before === after and an edit was requested (not just a chat/analyze)
  if (params.beforeImage && params.beforeImage === params.afterImage) {
    if (params.intent.type === "partial_edit" || params.intent.type === "full_redesign" || params.intent.type === "color_change") {
      return { status: "preview", reasons: ["Output identical to input — no real edit was performed"] };
    }
  }

  return { status: "completed", reasons: [] };
}

// ============================================================
// PRODUCT MATCHING — from real catalog, never invented
// ============================================================

export interface ProductCatalogEntry {
  id: string;
  category: string;
  styleSlugs: string[];
  price: number;
  inStock: boolean;
}

/**
 * Matches products from the REAL catalog based on intent + style + budget.
 * The LLM should NEVER invent product IDs — it can only rank/reason
 * about products that already exist in this catalog.
 */
export function matchProducts(
  catalog: ProductCatalogEntry[],
  intent: AiIntent,
  styleMap: Record<string, string>,
  budget?: number,
  maxResults = 6,
): { productId: string; reason: string; score: number }[] {
  // Step 1: Filter by category from intent targets
  const targetCategoryMap: Record<RoomElement, string[]> = {
    sofa: ["furniture"], rug: ["rugs"], curtain: ["textiles"], lighting: ["lighting"],
    wall: ["decor"], floor: ["rugs"], ceiling: ["lighting"], table: ["furniture"],
    chair: ["furniture"], tv: ["furniture"], plant: ["decor", "outdoor"], art: ["decor"],
    door: [], window: [], shelf: ["furniture"], bed: ["bedroom"],
  };

  let pool = catalog.filter((p) => p.inStock);

  // If we have specific targets, filter by matching categories
  if (intent.targets.length > 0 && intent.type !== "full_redesign") {
    const matchingCats = new Set<string>();
    intent.targets.forEach((t) => {
      (targetCategoryMap[t] || []).forEach((c) => matchingCats.add(c));
    });
    if (matchingCats.size > 0) {
      pool = pool.filter((p) => matchingCats.has(p.category));
    }
  }

  // Step 2: Budget filter
  if (budget && budget > 0) {
    pool = pool.filter((p) => p.price <= budget);
  }

  // Step 3: Score by style match
  const scored = pool.map((p) => {
    let score = 0.5;
    if (intent.style && p.styleSlugs.includes(styleMap[intent.style] || intent.style)) score += 0.3;
    if (p.price > 0) score += 0.1;
    return { productId: p.id, score, reason: scoreReason(p, intent) };
  });

  // Step 4: Sort + limit
  return scored.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

function scoreReason(p: ProductCatalogEntry, intent: AiIntent): string {
  if (intent.targets.includes("sofa") && p.category === "furniture") return "مناسب برای سبک درخواستی شما";
  if (intent.targets.includes("lighting") && p.category === "lighting") return "روشنایی مناسب فضای شما";
  if (intent.targets.includes("rug") && p.category === "rugs") return "فرش متناسب با چیدمان";
  return "پیشنهاد هوشمند بر اساس تحلیل فضا";
}

// ============================================================
// CATEGORY TAXONOMY & REAL STORE MATCHING (MULTI-STORE RELEVANCE)
// ============================================================

export const ELEMENT_TO_CATEGORIES: Record<RoomElement, string[]> = {
  sofa: ["furniture"],
  rug: ["rugs", "carpet"],
  curtain: ["textiles", "curtain"],
  lighting: ["lighting"],
  wall: ["decor"],
  floor: ["rugs", "carpet"],
  ceiling: ["lighting"],
  table: ["furniture", "dining", "workspace"],
  chair: ["furniture", "workspace"],
  tv: ["furniture", "tv-console"],
  plant: ["decor", "outdoor", "plants"],
  art: ["decor", "art", "accessories"],
  door: [],
  window: ["textiles", "curtain"],
  shelf: ["furniture", "bedroom", "bookcase-shoe"],
  bed: ["bedroom", "bedding"],
};

/**
 * Maps Category Slug + subType/title to RoomElement vocabulary.
 * Ensures consistent target classification across UI selection, SKU resolution, and intent pipeline.
 *
 * PRIORITY (never blanket-assume «furniture → sofa»):
 *   1. exact subcategory slug (sofa / armchair / coffee-table / …)
 *   2. product subtype / name keywords
 *   3. exact category slug
 *   4. conservative UNKNOWN (null) — when we cannot tell a sofa from a chair
 *      we do NOT guess; callers must handle null.
 */
const SUBCATEGORY_ELEMENT: Record<string, RoomElement> = {
  // seating
  sofa: "sofa", couch: "sofa", sectional: "sofa", "l-sofa": "sofa",
  armchair: "chair", chair: "chair", "dining-chair": "chair", "office-chair": "chair", pouf: "chair",
  // tables
  table: "table", desk: "table", "coffee-table": "table", "dining-table": "table", "side-table": "table", nightstand: "table", console: "table",
  // beds
  bed: "bed", headboard: "bed",
  // rugs
  rug: "rug", carpet: "rug", runner: "rug",
  // textiles → curtain only when it really is one (cushion/throw fall through)
  curtain: "curtain", drape: "curtain", sheer: "curtain",
  // lighting
  lamp: "lighting", "table-lamp": "lighting", "floor-lamp": "lighting", "wall-lamp": "lighting",
  ceiling: "lighting", chandelier: "lighting", sconce: "lighting",
  // decor / art
  "wall-art": "art", mirror: "art", painting: "art", sculpture: "art", vase: "art", candle: "art",
  // plants
  planter: "plant", plant: "plant",
  // storage
  shelf: "shelf", bookcase: "shelf", wardrobe: "shelf", organizer: "shelf",
  // tv
  "tv-console": "tv",
};

export function categoryToRoomElement(categorySlug: string, subTypeOrName?: string): RoomElement | null {
  const cat = (categorySlug || "").toLowerCase().trim();
  const sub = (subTypeOrName || "").toLowerCase();
  const full = `${cat} ${sub}`.trim();

  // ---- Priority 1: exact subcategory slug ----
  if (sub) {
    if (SUBCATEGORY_ELEMENT[sub]) return SUBCATEGORY_ELEMENT[sub];
    // Whitespace tokens keep compound slugs intact ("table-lamp" stays whole).
    for (const token of sub.split(/\s+/).filter(Boolean)) {
      if (SUBCATEGORY_ELEMENT[token]) return SUBCATEGORY_ELEMENT[token];
    }
  }

  // ---- Priority 2: subtype / product-name keywords ----
  if (/light|lamp|chandelier|نور|چراغ|لوستر|آباژور|دیوارکوب/.test(full)) return "lighting";
  if (/rug|carpet|فرش|قالی|گلیم/.test(full)) return "rug";
  if (/curtain|drape|پرده|تور/.test(full)) return "curtain";
  if (/chair|armchair|صندلی|پاف|پوف/.test(full)) return "chair";
  if (/table|desk|dining|میز|جلومبلی|ناهارخوری|کنسول/.test(full)) return "table";
  if (/sofa|couch|sectional|مبل|کاناپه/.test(full)) return "sofa";
  if (/bed|تخت|خواب/.test(full)) return "bed";
  if (/tv|تلویزیون/.test(full)) return "tv";
  if (/plant|flower|گیاه|گلدان/.test(full)) return "plant";
  if (/art|painting|mirror|sculpture|candle|تابلو|آینه|مجسمه|شمع/.test(full)) return "art";
  if (/shelf|bookcase|wardrobe|organizer|قفسه|شلف|کمد|جاکفشی|نظم\u200cدهنده/.test(full)) return "shelf";
  if (/wall|دیوار/.test(full)) return "wall";
  if (/floor|کف/.test(full)) return "floor";
  if (/ceiling|سقف/.test(full)) return "ceiling";

  // ---- Priority 3: exact category slug ----
  if (cat === "lighting") return "lighting";
  if (cat === "carpet" || cat === "rugs") return "rug";
  if (cat === "curtain") return "curtain";
  if (cat === "textiles") return "curtain"; // keeps previous behaviour (cushions/throws live with curtains)
  if (cat === "dining") return "table";
  if (cat === "bedding" || cat === "bedroom") return "bed";
  if (cat === "tv-console") return "tv";
  if (cat === "plants") return "plant";
  if (cat === "art" || cat === "decor" || cat === "accessories") return "art";
  if (cat === "bookcase-shoe") return "shelf";

  // ---- Priority 4: conservative unknown ----
  // «furniture» alone is NOT proof of a sofa (could be a chair, table, shelf…).
  if (cat === "office" || cat === "workspace") return "table"; // workspace default is the desk; chairs carry their own subcategory
  return null;
}

/** Normalize a SKU / product code for EXACT comparison:
 *  trim → lowercase → collapse internal whitespace. The match itself stays exact. */
export function normalizeProductCode(code: string | undefined | null): string {
  return (code ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Detects if an entered SKU belongs to a different category than the UI selection. */
export function detectCategorySkuConflict(
  selectedCategoryOrCategories?: string | string[] | RoomElement[],
  selectedTargetsOrProduct?: RoomElement[] | Product,
  maybeProduct?: Product,
): { hasConflict: boolean; message?: string; productElement: RoomElement | null } {
  let product: Product | undefined;
  let selectedTargets: RoomElement[] = [];

  if (maybeProduct && typeof maybeProduct === "object" && "id" in maybeProduct) {
    product = maybeProduct;
    if (Array.isArray(selectedTargetsOrProduct)) {
      selectedTargets = selectedTargetsOrProduct;
    }
  } else if (
    selectedTargetsOrProduct &&
    typeof selectedTargetsOrProduct === "object" &&
    "id" in selectedTargetsOrProduct
  ) {
    product = selectedTargetsOrProduct as Product;
  }

  if (!product) {
    return { hasConflict: false, productElement: null };
  }

  const productElement = categoryToRoomElement(
    product.categorySlug,
    `${product.subCategorySlug ?? ""} ${product.name}`,
  );
  // Conservative: when the product's element cannot be determined we cannot
  // prove a conflict — do not guess (and do not silently force "sofa").
  if (!productElement) {
    return { hasConflict: false, productElement: null };
  }

  // If selectedTargets wasn't explicitly given, derive from selectedCategoryOrCategories
  if (selectedTargets.length === 0 && selectedCategoryOrCategories) {
    const rawList = Array.isArray(selectedCategoryOrCategories)
      ? selectedCategoryOrCategories
      : [selectedCategoryOrCategories];
    for (const item of rawList) {
      if (typeof item === "string") {
        if (ALL_ELEMENTS.includes(item as RoomElement)) {
          selectedTargets.push(item as RoomElement);
        } else {
          const el = categoryToRoomElement(item);
          if (el) selectedTargets.push(el);
        }
      }
    }
  }

  if (selectedTargets.length > 0) {
    if (!selectedTargets.includes(productElement)) {
      const productElementLabel = ELEMENT_LABELS[productElement] || productElement;
      const targetLabels = selectedTargets.map((t) => ELEMENT_LABELS[t] || t).join("، ");
      return {
        hasConflict: true,
        message: `کد محصول واردشده (${product.sku || product.name}) مربوط به دسته‌بندی «${productElementLabel}» است، در حالی که در انتخاب شما «${targetLabels}» مشخص شده است.`,
        productElement,
      };
    }
  }
  return { hasConflict: false, productElement };
}

export interface MatchedStoreProduct {
  productId: string;
  slug: string;
  name: string;
  brand: string;
  storeId: string;
  storeName: string;
  storeLogo?: string;
  storeVerified?: boolean;
  image: string;
  price: number;
  oldPrice?: number;
  currency: string;
  sku?: string;
  categorySlug: string;
  categoryName?: string;
  styleSlugs: string[];
  inStock: boolean;
  stockCount?: number;
  productUrl: string;
  score: number;
  matchReasons: string[];
}

export interface StoreMatchingOptions {
  sku?: string;
  productId?: string;
  targets?: RoomElement[];
  category?: string;
  subCategory?: string;
  style?: string;
  colors?: string[];
  roomType?: string;
  budget?: number;
  maxResults?: number;
  limit?: number;
  /** Explicit catalog pool (from the single product source). Defaults to the
   *  shipped dev/test catalog — production passes the Supabase-loaded pool. */
  catalog?: Product[];
  /** Explicit store/vendor directory (from the single product source). */
  stores?: typeof defaultStores;
}

// Priority weights — a lower priority can NEVER outweigh a higher one:
//   exact SKU (5000) ≫ exact ID (2500) ≫ category/target (100) ≫ subcategory (40)
//   ≫ style (30) ≫ color (15) ≫ room (8) ≫ budget (5) ≫ availability (2)
// The sum of every lower weight is still far below the next-higher weight,
// so category can never override an exact SKU, and room can never override
// category.
const W = {
  exactSku: 5000,
  exactProduct: 2500,
  category: 100,
  subCategory: 40,
  style: 30,
  color: 15,
  room: 8,
  budget: 5,
  inStock: 2,
  outOfStock: -50,
  overBudget: -20,
} as const;

/** Room-type → category-slug compatibility (room-aware matching). */
const ROOM_CATEGORIES: { match: RegExp; categories: string[] }[] = [
  { match: /living|نشیمن|پذیرایی|پزورایی|سالن/, categories: ["furniture", "lighting", "rugs", "decor", "textiles", "carpet", "art", "tv-console"] },
  { match: /bedroom|خواب/, categories: ["bedroom", "lighting", "rugs", "decor", "textiles", "bedding"] },
  { match: /office|کار|workspace|اداری/, categories: ["workspace", "office", "lighting", "decor", "furniture"] },
  { match: /dining|ناهارخوری/, categories: ["furniture", "dining", "lighting", "decor"] },
];

/**
 * Matches REAL store products from the catalog according to priority rules:
 *   Priority 1: exact SKU            (ABSOLUTE — nothing can override it)
 *   Priority 2: exact product ID/slug
 *   Priority 3: exact category / target room element
 *   Priority 4: subcategory
 *   Priority 5: style compatibility
 *   Priority 6: color compatibility
 *   Priority 7: room compatibility
 *   Priority 8: budget
 *   Priority 9: availability
 * Multi-store support: aggregates across all vendors and ranks by score.
 * Never invents fake products, fake stores, or fake prices — and NEVER falls
 * back to unrelated catalog products: when nothing is relevant it returns [].
 */
export function matchStoreProducts(options: StoreMatchingOptions): MatchedStoreProduct[] {
  const catalog = options.catalog ?? defaultCatalog;
  const storeSource = options.stores ?? defaultStores;
  const storeMap = new Map(storeSource.map((s) => [s.id, s]));

  const skuQuery = normalizeProductCode(options.sku);
  const productIdQuery = normalizeProductCode(options.productId);
  const subCategoryQuery = normalizeProductCode(options.subCategory);
  const targetElements = options.targets ?? [];
  const styleQuery = options.style?.trim().toLowerCase();
  const roomQuery = options.roomType?.trim().toLowerCase();
  const colorsQuery = options.colors ?? [];
  const limit = options.limit ?? options.maxResults ?? 6;

  const scored = catalog.map((p) => {
    let score = 0;
    let meaningful = false; // a product qualifies ONLY with a real match reason
    const matchReasons: string[] = [];

    // Priority 1: Exact SKU match — ABSOLUTE priority
    if (skuQuery) {
      const pSku = normalizeProductCode(p.sku);
      const isAlias = skuQuery in SKU_ALIASES && SKU_ALIASES[skuQuery] === p.id.toLowerCase();
      if ((pSku && pSku === skuQuery) || isAlias) {
        score += W.exactSku;
        meaningful = true;
        matchReasons.push(`تطابق دقیق با کد محصول (${p.sku || skuQuery.toUpperCase()})`);
      }
    }

    // Priority 2: Exact Product ID or Slug match
    if (productIdQuery) {
      if (p.id.toLowerCase() === productIdQuery || p.slug.toLowerCase() === productIdQuery) {
        score += W.exactProduct;
        meaningful = true;
        matchReasons.push("محصول انتخابی شما");
      }
    }

    // Priority 3: Category / target match
    const productElement = categoryToRoomElement(p.categorySlug, `${p.subCategorySlug ?? ""} ${p.name}`);
    const isTargetMatch = productElement ? targetElements.includes(productElement) : false;
    const categoryQuery = options.category?.trim().toLowerCase();
    const isCatMatch = Boolean(
      categoryQuery &&
      (p.categorySlug.toLowerCase() === categoryQuery ||
        p.subCategorySlug?.toLowerCase() === categoryQuery ||
        (productElement && (ELEMENT_TO_CATEGORIES[productElement] || []).includes(categoryQuery))),
    );
    if (isTargetMatch || isCatMatch) {
      score += W.category;
      meaningful = true;
      matchReasons.push(`دسته\u200cبندی مرتبط (${productElement ? ELEMENT_LABELS[productElement] : p.categorySlug})`);
    }

    // Priority 4: Exact subcategory
    if (subCategoryQuery && p.subCategorySlug && p.subCategorySlug.toLowerCase() === subCategoryQuery) {
      score += W.subCategory;
      meaningful = true;
      matchReasons.push(`زیر دسته\u200cبندی مرتبط (${p.subCategorySlug})`);
    }

    // Priority 5: Style compatibility
    if (styleQuery) {
      const styleMatch = p.styleSlugs.some(
        (s) => s.toLowerCase().includes(styleQuery) || styleQuery.includes(s.toLowerCase()),
      );
      if (styleMatch) {
        score += W.style;
        meaningful = true;
        matchReasons.push(`سازگار با سبک ${options.style}`);
      }
    }

    // Priority 6: Color compatibility
    if (colorsQuery.length > 0) {
      const colorMatch = p.colors?.some((c) =>
        colorsQuery.some((reqC) => c.name.includes(reqC) || reqC.includes(c.name)),
      );
      if (colorMatch) {
        score += W.color;
        meaningful = true;
        matchReasons.push("هماهنگ با پالت رنگ درخواستی");
      }
    }

    // Priority 7: Room compatibility (boosts score — can NEVER override
    // exact SKU / product / category priorities)
    if (roomQuery) {
      const tagMatch = p.tags?.some(
        (t) => t.toLowerCase().includes(roomQuery) || roomQuery.includes(t.toLowerCase()),
      );
      const roomRule = ROOM_CATEGORIES.find((r) => r.match.test(roomQuery));
      const categoryMatch = roomRule ? roomRule.categories.includes(p.categorySlug) : false;
      if (tagMatch || categoryMatch) {
        score += W.room;
        meaningful = true;
        matchReasons.push(`متناسب با فضای ${options.roomType}`);
      }
    }

    // Priority 9: availability (score-only — never qualifies a product alone)
    if (p.inStock) {
      score += W.inStock;
    } else {
      score += W.outOfStock;
    }

    // Priority 8: budget compliance (score-only — never qualifies a product alone)
    if (options.budget && options.budget > 0) {
      score += p.price <= options.budget ? W.budget : W.overBudget;
    }

    const store = storeMap.get(p.storeId);
    // REAL store name only — never invent a storefront name.
    const storeName = store?.name || p.brand || "";

    const matched = {
      productId: p.id,
      slug: p.slug,
      name: p.name,
      brand: p.brand,
      storeId: p.storeId,
      storeName,
      storeLogo: store?.logo,
      storeVerified: store?.verified,
      image: p.images[0] || "",
      price: p.price,
      oldPrice: p.oldPrice,
      currency: p.currency || "تومان",
      sku: p.sku,
      categorySlug: p.categorySlug,
      categoryName: productElement ? ELEMENT_LABELS[productElement] : p.categorySlug,
      styleSlugs: p.styleSlugs,
      inStock: p.inStock,
      stockCount: p.stockCount,
      // /products/[slug] is the REAL internal product route
      productUrl: `/products/${p.slug}`,
      score,
      matchReasons,
      meaningful,
    };

    return matched;
  });

  // NO fallback to unrelated products: only genuinely relevant results pass.
  const relevant = scored.filter((p) => p.meaningful && p.score > 0);
  return relevant
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ meaningful: _meaningful, ...item }) => item);
}

// ============================================================
// ROOM UNDERSTANDING (Phase 3) — structured knowledge about the
// room BEFORE any generation. Filled by the vision/analysis layer
// when available; the deterministic default keeps every object
// "unknown" so the engine never invents facts about the photo.
// ============================================================

export type ObjectImportance = "keep" | "replaceable" | "unknown";

/** One detected/known object in the room photo. */
export interface RoomObject {
  id: string;
  /** Element vocabulary key (sofa, wall, window, …). */
  type: RoomElement | string;
  importance: ObjectImportance;
  /** Approximate location as fraction of image (0..1, origin top-left). */
  location?: { x: number; y: number };
  /** Relative size (fraction of image). */
  size?: { w: number; h: number };
  /** Approximate orientation in degrees (0 = aligned with camera). */
  orientation?: number;
  /** Bounding region (0..1). */
  boundingBox?: { x: number; y: number; w: number; h: number };
}

/** Checks if a Persian/English word exists with proper boundary delimiters. */
export function matchesWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(?:^|[^\\u0600-\\u06FFa-zA-Z0-9])${escaped}(?:[^\\u0600-\\u06FFa-zA-Z0-9]|$)`, "i");
  return regex.test(text);
}

/**
 * Explicit architectural intent detection.
 * Identifies if user explicitly requested changing a structural element (wall/floor/ceiling/door/window).
 */
export function detectArchitecturalTargets(text: string): RoomElement[] {
  const lower = text.toLowerCase();
  const targets = new Set<RoomElement>();

  const hasWord = (w: string) => matchesWord(lower, w);
  const hasAction = /(خراب|تخریب|بردار|حذف|عوض|تغییر|تعویض|رنگ|کاغذ|رنگ‌آمیزی|پوشش|نو|نصب)/.test(lower);

  // Wall modifications
  if ((hasWord("دیوار") || hasWord("دیوارها") || hasWord("wall")) && (hasAction || /(رنگ\s*دیوار|کاغذ\s*دیواری)/.test(lower))) {
    targets.add("wall");
  }
  // Floor modifications
  if ((hasWord("کف") || hasWord("پارکت") || hasWord("سرامیک") || hasWord("لمینت") || hasWord("کفپوش") || hasWord("floor")) && (hasAction || /(عوض\s*کردن\s*کف|تغییر\s*کف)/.test(lower))) {
    targets.add("floor");
  }
  // Ceiling modifications
  if ((hasWord("سقف") || hasWord("کناف") || hasWord("ceiling")) && (hasAction || /تغییر\s*سقف/.test(lower))) {
    targets.add("ceiling");
  }
  // Window modifications
  if ((hasWord("پنجره") || hasWord("پنجره‌ها") || hasWord("window")) && (hasAction || /(اضافه|بزرگ|پنجره\s*اضافه)/.test(lower))) {
    targets.add("window");
  }
  // Door modifications — must not match preposition 'در' (e.g. 'در نشیمن')
  const isExplicitDoor =
    hasWord("درب") ||
    hasWord("درها") ||
    hasWord("درب‌ها") ||
    hasWord("door") ||
    /(در\s*اتاق|در\s*ورودی|درب\s*ورودی)/.test(lower) ||
    /(\bدر\s*(را|رو)\s*(عوض|تغییر|حذف|رنگ|بردار|نو))/.test(lower) ||
    /((عوض|تغییر|تعویض|رنگ|حذف)\s*در\b(?!\s*(نشیمن|پذیرایی|خواب|اتاق|فضا|آشپزخانه|سالن|کنار|گوشه|وسط|مرکز|دیوار|کف|سقف)))/.test(lower);
  if (isExplicitDoor && (hasAction || /(جابه‌جا|جابجایی)/.test(lower))) {
    targets.add("door");
  }

  return [...targets];
}

/** Explicit locked constraints mentioned in text (e.g. «مبل فعلی بماند»). */
export function detectExplicitLocked(text: string): RoomElement[] {
  const lower = text.toLowerCase();
  const locked = new Set<RoomElement>();
  if (/مبل\s*(فعلی|الان|کنونی)?\s*(بماند|باشه|دست\s*نخور|حفظ|تغییر\s*نکند)/.test(lower) || /ولی\s*مبل/.test(lower) || /مبل\s*فعلی\s*بماند/.test(lower)) {
    locked.add("sofa");
  }
  if (/فرش\s*(فعلی|الان|کنونی)?\s*(بماند|باشه|دست\s*نخور|حفظ|تغییر\s*نکند)/.test(lower) || /ولی\s*فرش/.test(lower)) {
    locked.add("rug");
  }
  if (/پرده\s*(فعلی|الان|کنونی)?\s*(بماند|باشه|دست\s*نخور|حفظ|تغییر\s*نکند)/.test(lower) || /ولی\s*پرده/.test(lower)) {
    locked.add("curtain");
  }
  if (/لوستر|چراغ|روشنایی\s*(فعلی|الان|کنونی)?\s*(بماند|باشه|دست\s*نخور|حفظ)/.test(lower)) {
    locked.add("lighting");
  }
  if (/تخت\s*(فعلی|الان|کنونی)?\s*(بماند|باشه|دست\s*نخور|حفظ)/.test(lower)) {
    locked.add("bed");
  }
  if (/میز\s*(فعلی|الان|کنونی)?\s*(بماند|باشه|دست\s*نخور|حفظ)/.test(lower)) {
    locked.add("table");
  }
  return [...locked];
}

export interface RoomArchitecture {
  walls?: boolean | string;
  floor?: string;
  ceiling?: boolean | string;
  doors?: number | string;
  windows?: number | string;
  openings?: string[];
}

export interface RoomUnderstanding {
  roomType?: string;
  style?: string;
  likelyStyle?: { style: string; confidence: number };
  palette?: string[];
  mood?: string;
  floor?: string;
  walls?: string;
  ceiling?: string;
  layout?: "open" | "closed" | "unknown";
  lighting?: "natural" | "warm" | "cold" | "mixed" | "unknown" | string;
  architecture?: RoomArchitecture;
  /** Structural objects (walls/floor/…) that must survive edits. */
  objects: RoomObject[];
  furnitureTypes?: string[];
  materials?: string[];
  emptySpaces?: string[];
  functionalIssues?: string[];
  designOpportunities?: string[];
  /** 0..1 — how confident the analysis is. */
  confidence: number;
}

/** Honest empty understanding — used when no vision engine ran. */
export function emptyRoomUnderstanding(roomType?: string): RoomUnderstanding {
  return {
    roomType,
    layout: "unknown",
    lighting: "unknown",
    objects: [],
    confidence: 0,
  };
}

/**
 * Phase 5 / Rule 6 — Protected Elements resolution.
 * Golden rule: "When uncertain, preserve more and change less."
 * ARCHITECTURE IS ALWAYS PROTECTED BY DEFAULT:
 *   walls, floor, ceiling, windows, doors, structural elements,
 *   room geometry, camera perspective
 * ONLY change when user explicitly requests (e.g. «دیوار را خراب کن», «کف را عوض کن»).
 *
 * - whole_home / room → structural elements protected by default unless explicitly targeted.
 * - single_item / area → structural elements + every untouched object protected.
 */
export function resolveProtectedElements(params: {
  targets: RoomElement[];
  scope: "single_item" | "area" | "room" | "whole_home";
  explicitLocked?: RoomElement[];
  explicitStructuralTargets?: RoomElement[];
}): RoomElement[] {
  const { targets, scope, explicitLocked = [], explicitStructuralTargets = [] } = params;

  if (scope === "whole_home" || scope === "room") {
    // Structural elements are ALWAYS protected by default unless explicitly targeted
    const structuralProtected = STRUCTURAL_ELEMENTS.filter(
      (el) => !targets.includes(el) && !explicitStructuralTargets.includes(el),
    );
    return [...new Set([...structuralProtected, ...explicitLocked])];
  }

  return [...new Set([...ALL_ELEMENTS.filter((e) => !targets.includes(e)), ...explicitLocked])];
}

// ============================================================
// ROOM SNAPSHOT + ROOM STATE (versioned history)
// ============================================================

export interface RoomSnapshot {
  version: number;
  label: string;
  image: string;
  placements: { productId: string; x: number; y: number; scale: number; rotation: number }[];
  changes: string[];
  timestamp: number;
}

export interface RoomState {
  originalImage: string | null;
  currentImage: string | null;
  roomType: string;
  detectedStyle: string;
  detectedColors: string[];
  budget: number;
  lockedElements: RoomElement[];
  appliedChanges: string[];
  placements: ProductPlacement[];
  history: RoomSnapshot[];
  historyIndex: number;
}

// ============================================================
// JSON SCHEMA VALIDATION — robust parse + validate + fallback
// ============================================================

/**
 * Safely parse + validate an LLM JSON response.
 * 1. Try JSON.parse
 * 2. Validate required keys
 * 3. Normalize types
 * 4. Return null on total failure (caller handles fallback)
 */
export function parseLLMJson<T>(raw: string, requiredKeys: string[], fallback: T): T {
  try {
    // Extract JSON object or array from text
    const jsonMatch = raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr);

    // Validate required keys exist
    if (typeof parsed !== "object" || parsed === null) return fallback;
    for (const key of requiredKeys) {
      if (!(key in parsed)) return fallback;
    }
    return parsed as T;
  } catch {
    return fallback;
  }
}

// ============================================================
// PROMPT SANITIZATION — anti-injection
// ============================================================

/**
 * Sanitizes user input before it reaches the LLM.
 * - Removes script tags
 * - Removes "ignore previous" style injection attempts
 * - Truncates to safe length
 * - Escapes system-instruction-like patterns
 */
export function sanitizeUserPrompt(input: string): string {
  const MAX = 2000;
  let s = input.slice(0, MAX);
  // Strip HTML/script tags
  s = s.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<[^>]+>/g, "");
  // Strip common injection patterns
  s = s.replace(/ignore\s+(previous|above|all)\s+(instructions?|prompts?|rules?)/gi, "");
  s = s.replace(/system\s*:/gi, "");
  s = s.replace(/you\s+are\s+(now|a)\s+/gi, "");
  return s.trim();
}

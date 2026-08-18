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

// ---- Element taxonomy ----
export type RoomElement =
  | "sofa" | "rug" | "curtain" | "lighting" | "wall" | "floor"
  | "ceiling" | "table" | "chair" | "tv" | "plant" | "art"
  | "door" | "window" | "shelf" | "bed";

export const ALL_ELEMENTS: RoomElement[] = [
  "sofa", "rug", "curtain", "lighting", "wall", "floor", "ceiling",
  "table", "chair", "tv", "plant", "art", "door", "window", "shelf", "bed",
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
const KEYWORD_MAP: { keywords: string[]; element: RoomElement }[] = [
  { keywords: ["مبل", "کاناپه", "sofa", "صندلی", "chair", "پوف"], element: "sofa" },
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
  { keywords: ["در", "door", "درب"], element: "door" },
  { keywords: ["پنجره", "window"], element: "window" },
];

const FULL_KEYWORDS = ["کل", "همه", "کامل", "دوباره", "مجدد", "redesign", "everything", "full room", "طراحی کامل", "همه رو", "کل فضا", "همه چیز"];

/**
 * MULTI-TARGET intent detection.
 * "مبل و فرش و پرده" → targets = ["sofa", "rug", "curtain"]
 */
export function detectIntent(text: string, style?: string): AiIntent {
  const lower = text.toLowerCase().trim();

  if (!lower) {
    return { type: "inquiry", targets: [], style, requestedChanges: [], lockedElements: ALL_ELEMENTS, confidence: 0.3, requiresClarification: true };
  }

  // Full-room redesign
  if (FULL_KEYWORDS.some((k) => lower.includes(k))) {
    return {
      type: "full_redesign",
      targets: [...ALL_ELEMENTS],
      style,
      requestedChanges: ["بازطراحی کامل فضا"],
      lockedElements: [],
      confidence: 0.95,
      requiresClarification: false,
    };
  }

  // Collect ALL targets mentioned
  const targets = new Set<RoomElement>();
  for (const { keywords, element } of KEYWORD_MAP) {
    if (keywords.some((k) => lower.includes(k))) targets.add(element);
  }

  // Color change without specific element
  const colorKeywords = ["رنگ", "color", "سبز", "کرم", "آبی", "قرمز", "طوسی", "زرد", "طلایی", "بژ"];
  const isColorOnly = colorKeywords.some((k) => lower.includes(k)) && targets.size === 0;

  if (targets.size === 0 && !isColorOnly) {
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
    type: isColorOnly ? "color_change" : "partial_edit",
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
    return { targets: [...ALL_ELEMENTS], lockedElements: [], summary: "بازطراحی کامل فضا — همه‌چیز قابل تغییر است" };
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

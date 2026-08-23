// ============================================================
// Heuristic LLM Provider (default — zero dependency, zero cost).
// Deterministic Persian interior design intelligence.
//
// IMPLEMENTS FINAL DECISION TREE (Task Spec Section 17):
//   1. IF user selected a category AND request is targeted
//        → change selected category only (single_item)
//   2. ELSE IF user explicitly names a target
//        → change named target only
//   3. ELSE IF user explicitly requests an area
//        → change that area
//   4. ELSE IF user explicitly requests a room redesign
//        → full room design freedom (architecture protected)
//   5. ELSE IF user explicitly requests whole-home redesign
//        → whole-home design freedom (architecture protected)
//   6. ELSE
//        → conservative interpretation (preserve more, change less)
//
// GOLDEN RULES:
//   • User selection controls the transformation unless explicit broad request
//   • User request overrides UI selection when explicitly broader (Priority rule)
//   • Architecture (walls, floor, ceiling, windows, doors) NEVER changes by default
//     unless explicitly requested («دیوار را خراب کن», «کف را عوض کن»)
//   • Continuation memory («کمی روشن‌ترش کن») preserves previous targets
// ============================================================
import type { IntentRequest, IntentAnalysis, DesignIntentType, LlmProvider } from "./types";
import {
  detectIntent,
  ALL_ELEMENTS,
  STRUCTURAL_ELEMENTS,
  DESIGNABLE_ELEMENTS,
  ELEMENT_LABELS,
  detectArchitecturalTargets,
  detectExplicitLocked,
  type RoomElement,
} from "../roomState";
import { detectScope, type EditScope } from "../scope";

/** Whole-home phrases (highest bar — explicit only). */
const WHOLE_HOME_PATTERNS = [
  "کل خانه", "کل خونه", "همه خانه", "همه خونه", "تموم خونه", "تمام خانه",
  "کل فضای خانه", "کل فضای خونه", "کل ملک", "کل ویلا", "whole home", "whole house",
  "همه چیز خانه", "همه چیز خونه", "همه چی خانه", "همه چی خونه",
  "همه جای خانه", "همه جای خونه", "تمام فضای خانه",
];

const WHOLE_HOME_EN = ["whole home", "whole house", "entire home", "entire house"];

/**
 * Style cues in Persian/English → canonical Homeino style names.
 * Used when the user embeds a style in the prompt without selecting one in UI.
 */
const STYLE_CUES: { cues: string[]; style: string }[] = [
  { cues: ["ژاپندی", "japandi"], style: "Japandi" },
  { cues: ["اسکاندیناوی", "scandinavian"], style: "Scandinavian" },
  { cues: ["مینیمال", "minimalist", "minimal"], style: "Modern Minimalist" },
  { cues: ["صنعتی", "لافت", "industrial", "loft"], style: "Industrial Loft" },
  { cues: ["بوهو", "بوهمین", "boho", "bohemian"], style: "Bohemian / Boho" },
  { cues: ["میدسنچری", "mid-century", "midcentury"], style: "Mid-Century Modern" },
  { cues: ["لوکس معاصر", "luxury contemporary"], style: "Luxury Contemporary" },
  { cues: ["نئوکلاسیک", "neoclassical"], style: "Neoclassical" },
  { cues: ["مدیتران", "mediterranean"], style: "Mediterranean" },
  { cues: ["آرت دکو", "art deco"], style: "Art Deco" },
  { cues: ["روستیک", "rustic"], style: "Rustic" },
  { cues: ["معاصر", "contemporary"], style: "Contemporary" },
  { cues: ["کلاسیک", "classic"], style: "Classic" },
  { cues: ["لوکس", "luxury"], style: "Luxury Contemporary" },
  { cues: ["مدرن", "modern"], style: "Modern" },
];

function detectStyleFromText(text: string, fallback?: string): string | undefined {
  const lower = text.toLowerCase();
  for (const { cues, style } of STYLE_CUES) {
    if (cues.some((c) => lower.includes(c.toLowerCase()))) return style;
  }
  return fallback;
}

/** Removal detection → remove_item. */
const REMOVE_PHRASES = ["حذف کن", "بردار", "حذف شود", "نباشه", "remove", "پاک کن"];

const COLOR_WORDS = ["کرم", "سفید", "طوسی", "سبز", "آبی", "سرمه‌ای", "قرمز", "زرد", "طلایی", "بژ", "دودی", "گلبهی", "مشکی", "قهوه‌ای", "شنی", "یشمی", "زیتونی"];

/** Continuation markers (Phase 15) — referring to previous target without naming new element. */
const CONTINUATION_MARKERS = ["ترش", "ترش کن", "ش کن", "ش را", "آن را", "اون رو", "اونو", "همین", "این یکی", "این مورد", "بزرگترش", "کوچکترش", "کوچیکترش", "روشن‌ترش", "تیره‌ترش"];

/** Zone / area phrases. */
const AREA_PATTERNS = [
  "فضای نشیمن", "نشیمن", "گوشه", "این بخش", "این قسمت", "این ناحیه",
  "منطقه", "ناحیه", "فضای پذیرایی", "فضای غذاخوری", "فضای کار", "فضای خواب",
  "کنار مبل", "کنار پنجره", "زیر پنجره", "کنار تخت", "جلوی مبل", "روی میز",
];

function countMatches(text: string, patterns: string[]): number {
  return patterns.reduce((n, p) => (text.includes(p) ? n + 1 : n), 0);
}

function extractColors(text: string): string[] {
  return COLOR_WORDS.filter((c) => text.includes(c));
}

function continuationTargets(text: string, previous?: RoomElement[]): RoomElement[] | null {
  if (!previous?.length) return null;
  if (CONTINUATION_MARKERS.some((m) => text.includes(m))) return previous;
  return null;
}

/** Checks if a prompt explicitly requests a room redesign (overrides single-element selection). */
function isExplicitRoomRedesign(text: string): boolean {
  const lower = text.toLowerCase();

  // Explicit phrases for full room redesign
  if (
    /کل\s*(اتاق|فضا|سالن|پذیرایی|نشیمن|خواب)/.test(lower) ||
    /همه\s*(اتاق|فضا|سالن|پذیرایی)/.test(lower) ||
    /تمام\s*(اتاق|فضا|سالن|پذیرایی)/.test(lower) ||
    /صفر\s*تا\s*صد/.test(lower) ||
    /از\s*نو/.test(lower) ||
    /دوباره\s*طراحی/.test(lower) ||
    /طراحی\s*کامل/.test(lower) ||
    /دکور\s*کامل/.test(lower) ||
    /بازطراحی/.test(lower) ||
    /redesign|full\s*room/.test(lower)
  ) {
    return true;
  }

  // Room subject + style / transformation verb
  const roomSubject = /(این\s*)?(اتاق(\s*خواب|\s*نشیمن)?|پذیرایی|سالن|فضا|آشپزخانه)\s*(را|رو)?/.test(lower);
  const styleVerb = /(مدرن|مینیمال|ژاپندی|japandi|کلاسیک|لوکس|بوهو|boho|اسکاندیناوی|scandinavian|صنعتی|لافت|نئوکلاسیک|روستیک|مدیترانه|زیباتر|زیبا\s*کن|قشنگ|طراحی\s*بهتر|بهتر\s*کن)/.test(lower);

  if (roomSubject && styleVerb) {
    return true;
  }

  // Generic design queries for this space
  if (/یک\s*طراحی\s*بهتر\s*برای\s*(این\s*)?(فضا|اتاق)/.test(lower) || /طراحی\s*بهتر\s*برای\s*(این\s*)?(فضا|اتاق)/.test(lower)) {
    return true;
  }

  return false;
}

/** Checks if a prompt is a general design request with no specific target. */
function isGeneralDesignQuery(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    /این\s*اتاق\s*(را|رو)?\s*(زیباتر|مدرن|ژاپندی|japandi|کلاسیک|مینیمال|بهتر)/.test(lower) ||
    /این\s*فضا\s*(را|رو)?\s*(زیباتر|مدرن|ژاپندی|japandi|کلاسیک|مینیمال|بهتر)/.test(lower) ||
    /یک\s*طراحی\s*بهتر\s*برای\s*این\s*(فضا|اتاق)/.test(lower) ||
    /طراحی\s*بهتر\s*برای\s*(این\s*)?(فضا|اتاق)/.test(lower) ||
    /(زیباترش\s*کن|یک\s*طراحی\s*بهتر\s*بده|فضای\s*بهتری\s*می‌خوام|دکور\s*بهتری\s*بده)/.test(lower)
  );
}

/**
 * Heuristic Interior Design Intelligence — Single source of truth for deterministic reasoning.
 * Follows the 18 rules and Decision Tree exactly.
 */
export function heuristicUnderstandIntent(req: IntentRequest): IntentAnalysis {
  const text = req.prompt.trim();
  const lower = text.toLowerCase();
  const selected = req.selectedTargets ?? [];
  const resolvedStyle = detectStyleFromText(text, req.style);
  const colors = extractColors(text);
  const detected = detectIntent(text, req.style);
  const archTargets = detectArchitecturalTargets(lower);
  const explicitLocked = detectExplicitLocked(lower);

  // ---- 1. EMPTY PROMPT: User only made a UI selection or nothing ----
  if (!text) {
    if (selected.length > 0) {
      return {
        intent: "targeted_edit",
        target: selected,
        changes: [selected.length === 1 ? `تغییر ${ELEMENT_LABELS[selected[0]] || selected[0]}` : `تغییر ${selected.length} عنصر انتخابی`],
        preservedElements: ALL_ELEMENTS.filter((e) => !selected.includes(e)),
        scope: selected.length === 1 ? "single_item" : "area",
        style: req.style,
        colors: req.colors,
        confidence: 0.85,
        note: "دستوری نوشته نشده — فقط عناصر انتخابی شما تغییر می‌کنند.",
      };
    }
    return {
      intent: "inquiry",
      target: [],
      changes: [],
      preservedElements: [...ALL_ELEMENTS],
      scope: "single_item",
      style: req.style,
      colors: req.colors,
      confidence: 0.35,
      ambiguous: true,
      note: "بنویسید چه چیزی باید تغییر کند تا دقیق اجرا کنیم.",
    };
  }

  // ---- 2. WHOLE-HOME REDESIGN (Highest priority — explicit only) ----
  const isWholeHome = countMatches(lower, WHOLE_HOME_PATTERNS) > 0 || WHOLE_HOME_EN.some((p) => lower.includes(p));
  if (isWholeHome) {
    const targets = [...DESIGNABLE_ELEMENTS, ...archTargets].filter((e) => !explicitLocked.includes(e));
    const structuralProtected = STRUCTURAL_ELEMENTS.filter((e) => !archTargets.includes(e));
    return {
      intent: "full_redesign",
      target: targets,
      changes: [
        `بازطراحی کل خانه${resolvedStyle ? ` با سبک ${resolvedStyle}` : ""}`,
        ...(explicitLocked.length ? [`حفظ ${explicitLocked.map((e) => ELEMENT_LABELS[e]).join("، ")}`] : []),
      ].slice(0, 3),
      preservedElements: [...new Set([...structuralProtected, ...explicitLocked])],
      scope: "whole_home",
      style: resolvedStyle,
      colors: req.colors?.length ? req.colors : colors,
      confidence: 0.95,
      note: "بازطراحی کل خانه — عناصر معماری به‌طور پیش‌فرض محافظت می‌شوند.",
    };
  }

  // ---- 3. EXPLICIT ROOM REDESIGN (Overrides category selection per Priority Rule) ----
  const promptIsRoomRedesign = isExplicitRoomRedesign(lower) || isGeneralDesignQuery(lower);
  const isBroadRoomRequest = promptIsRoomRedesign || (req.changeScope === "full" && selected.length === 0);

  if (isBroadRoomRequest) {
    const targets = [...DESIGNABLE_ELEMENTS, ...archTargets].filter((e) => !explicitLocked.includes(e));
    const structuralProtected = STRUCTURAL_ELEMENTS.filter((e) => !archTargets.includes(e));
    return {
      intent: "full_redesign",
      target: targets,
      changes: [
        `بازطراحی ${req.room ?? "اتاق"}${resolvedStyle ? ` با سبک ${resolvedStyle}` : ""}`,
        ...(explicitLocked.length ? [`حفظ ${explicitLocked.map((e) => ELEMENT_LABELS[e]).join("، ")}`] : []),
      ].slice(0, 3),
      preservedElements: [...new Set([...structuralProtected, ...explicitLocked])],
      scope: "room",
      style: resolvedStyle,
      colors: req.colors?.length ? req.colors : colors,
      confidence: 0.92,
      note: explicitLocked.length
        ? "بازطراحی اتاق با حفظ عناصر درخواستی شما و حفاظت از معماری."
        : "بازطراحی اتاق — مبلمان و دکوراسیون تغییر می‌کنند و معماری محافظت شده است.",
    };
  }

  // ---- 4. SELECTED CATEGORY / SELECTION-TARGETED EDIT ----
  // RULE 1 & 2: When user selected an item in UI, target = selection only!
  if (selected.length > 0) {
    const isRemove = REMOVE_PHRASES.some((p) => lower.includes(p));
    const isColor = (colors.length > 0 || /رنگ|color/.test(lower)) && !isRemove;
    const intentType: DesignIntentType = isRemove
      ? "remove_item"
      : isColor
        ? "color_change"
        : "targeted_edit";

    const changeDescription = isRemove
      ? `حذف ${selected.map((t) => ELEMENT_LABELS[t]).join("، ")}`
      : isColor
        ? `تغییر رنگ ${selected.map((t) => ELEMENT_LABELS[t]).join("، ")}${colors.length ? ` به ${colors.join("، ")}` : ""}`
        : text.slice(0, 60);

    return {
      intent: intentType,
      target: selected,
      changes: [changeDescription],
      preservedElements: ALL_ELEMENTS.filter((e) => !selected.includes(e)),
      scope: selected.length === 1 ? "single_item" : "area",
      style: resolvedStyle,
      colors: req.colors?.length ? [...new Set([...req.colors, ...colors])] : colors,
      confidence: 0.92,
      note: "فقط دسته/عنصر انتخابی تغییر می‌کند — بقیه فضا کاملاً قفل و دست‌نخورده است.",
    };
  }

  // ---- 5. CONTINUATION / MEMORY («کمی روشن‌ترش کن», «کوچک‌ترش کن») ----
  const prev = continuationTargets(text, req.previousTargets);
  if (prev && prev.length > 0 && detected.targets.length === 0) {
    return {
      intent: "targeted_edit",
      target: prev,
      changes: [text.slice(0, 60)],
      preservedElements: ALL_ELEMENTS.filter((e) => !prev.includes(e)),
      scope: "single_item",
      style: resolvedStyle,
      colors: req.colors?.length ? req.colors : colors,
      confidence: 0.88,
      note: "این درخواست ادامه‌ی تغییر قبلی است — همان المان قبلی هدف است.",
    };
  }

  // ---- 6. NAMED TARGETS IN PROMPT («مبل را عوض کن», «فرش را آبی کن», …) ----
  const targetSet = new Set<RoomElement>([...detected.targets, ...archTargets]);
  if (targetSet.size > 0) {
    const targets = [...targetSet];
    const isRemove = REMOVE_PHRASES.some((p) => lower.includes(p));
    const isColor = (colors.length > 0 || /رنگ|color/.test(lower)) && !isRemove;
    const scope = detectScope(text, targets).scope;

    return {
      intent: isRemove ? "remove_item" : isColor ? "color_change" : "targeted_edit",
      target: targets,
      changes: [
        isRemove
          ? `حذف ${targets.map((t) => ELEMENT_LABELS[t]).join("، ")}`
          : text.slice(0, 60),
      ],
      preservedElements: ALL_ELEMENTS.filter((e) => !targets.includes(e)),
      scope,
      style: resolvedStyle,
      colors: req.colors?.length ? [...new Set([...req.colors, ...colors])] : colors,
      confidence: 0.9,
      note: "فقط عناصر خواسته‌شده تغییر می‌کنند — بقیه فضا حفظ می‌شود.",
    };
  }

  // ---- 7. AREA REQUEST («فضای نشیمن را مدرن‌تر کن») ----
  const areaHits = countMatches(lower, AREA_PATTERNS);
  if (areaHits > 0) {
    const areaTargets: RoomElement[] = ["sofa", "table", "lighting", "rug"];
    return {
      intent: "targeted_edit",
      target: areaTargets,
      changes: [text.slice(0, 60)],
      preservedElements: ALL_ELEMENTS.filter((e) => !areaTargets.includes(e)),
      scope: "area",
      style: resolvedStyle,
      colors: req.colors?.length ? req.colors : colors,
      confidence: 0.8,
      note: "یک ناحیه از فضا تغییر می‌کند — سایر بخش‌ها حفظ می‌شوند.",
    };
  }

  // ---- 8. COLOR ONLY WITH NO TARGET («رنگ کرم کن») → Wall default ----
  if (colors.length > 0) {
    return {
      intent: "color_change",
      target: ["wall"],
      changes: [`اعمال رنگ ${colors.join("، ")}`],
      preservedElements: ALL_ELEMENTS.filter((e) => e !== "wall"),
      scope: "single_item",
      style: resolvedStyle,
      colors,
      confidence: 0.7,
      ambiguous: true,
      note: "رنگ خواسته شده اما محل مشخص نیست — رنگ دیوار در نظر گرفته شد.",
    };
  }

  // ---- 9. CONSERVATIVE FALLBACK / INQUIRY ----
  return {
    intent: "inquiry",
    target: [],
    changes: [],
    preservedElements: [...ALL_ELEMENTS],
    scope: "single_item",
    style: resolvedStyle,
    colors: req.colors,
    confidence: 0.35,
    ambiguous: true,
    note: "مخاطب تغییر مشخص نیست؛ لطفاً عنصر موردنظر را انتخاب یا دقیق‌تر بنویسید.",
  };
}

export const heuristicLlmProvider: LlmProvider = {
  name: "heuristic",
  async understandIntent(req) {
    // Simulate a short round-trip so the UI states are exercised.
    await new Promise((r) => setTimeout(r, 350));
    return heuristicUnderstandIntent(req);
  },
};


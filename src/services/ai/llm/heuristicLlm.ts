// ============================================================
// Heuristic LLM Provider (default — zero dependency, zero cost).
// Deterministic Persian interior design intelligence.
//
// IMPLEMENTS THE CANONICAL DECISION TREE — single source of truth:
//   scope.ts → resolveScope()
//   1. Explicit user target (named element)     → single_item
//   2. Explicit UI selection + targeted request → selected category
//   3. Explicit area                            → area
//   4. Explicit whole-home redesign             → whole_home
//   5. Explicit one-room redesign               → room
//   6. Continuation of previous target          → previous target
//   7. Conservative fallback                    → preserve more, change less
//
// GOLDEN RULES:
//   • User selection controls the transformation unless the request is
//     explicitly broader (room / whole-home) — Priority rule
//   • Generic «همه/کل/همه چیز» ALONE never widens the scope
//   • Architecture (walls, floor, ceiling, windows, doors, geometry,
//     camera) NEVER changes unless explicitly requested
//   • Continuation memory («کمی روشن‌ترش کن») preserves previous targets
// ============================================================
import type { IntentRequest, IntentAnalysis, DesignIntentType, LlmProvider } from "./types";
import {
  ALL_ELEMENTS,
  ELEMENT_LABELS,
  detectExplicitLocked,
  resolveProtectedElements,
  type RoomElement,
} from "../roomState";
import { resolveScope, type EditScope, type ScopeSource } from "../scope";

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

function extractColors(text: string): string[] {
  return COLOR_WORDS.filter((c) => text.includes(c));
}

const NOTES: Record<ScopeSource, string> = {
  explicit_target: "فقط عناصر خواسته‌شده تغییر می‌کنند — بقیه فضا حفظ می‌شود.",
  ui_selection: "فقط دسته/عنصر انتخابی تغییر می‌کند — بقیه فضا کاملاً قفل و دست‌نخورده است.",
  area: "یک ناحیه از فضا تغییر می‌کند — سایر بخش‌ها حفظ می‌شوند.",
  whole_home: "بازطراحی کل خانه — عناصر معماری به‌طور پیش‌فرض محافظت می‌شوند.",
  room: "بازطراحی اتاق — مبلمان و دکوراسیون تغییر می‌کنند و معماری محافظت شده است.",
  continuation: "این درخواست ادامه‌ی تغییر قبلی است — همان المان قبلی هدف است.",
  conservative: "مخاطب تغییر مشخص نیست؛ لطفاً عنصر موردنظر را انتخاب یا دقیق‌تر بنویسید.",
};

/**
 * Heuristic Interior Design Intelligence — deterministic reasoning.
 *
 * Scope & target resolution is DELEGATED to the canonical decision tree
 * (scope.ts / resolveScope) — this provider only derives the intent type,
 * style, colors and human-readable phrases on top of it. It never
 * re-decides scope by its own rules (fix 3 — single source of truth).
 */
export function heuristicUnderstandIntent(req: IntentRequest): IntentAnalysis {
  const text = req.prompt.trim();
  const lower = text.toLowerCase();
  const selected = req.selectedTargets ?? [];
  const resolvedStyle = detectStyleFromText(text, req.style);
  const colors = extractColors(text);
  const explicitLocked = detectExplicitLocked(lower);

  // ---- 1. EMPTY PROMPT: User only made a UI selection or nothing ----
  if (!text) {
    if (selected.length > 0) {
      const scope: EditScope = selected.length === 1 ? "single_item" : "area";
      return {
        intent: "targeted_edit",
        target: selected,
        changes: [selected.length === 1 ? `تغییر ${ELEMENT_LABELS[selected[0]] || selected[0]}` : `تغییر ${selected.length} عنصر انتخابی`],
        preservedElements: resolveProtectedElements({ targets: selected, scope, explicitLocked }),
        scope,
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

  // ---- 2. CANONICAL DECISION TREE (single source of truth: scope.ts) ----
  const resolution = resolveScope({
    text,
    selectedTargets: selected,
    uiScope: req.changeScope,
    previousTargets: req.previousTargets,
    previousScope: req.previousScope,
  });

  let targets = [...resolution.targets];
  let scope: EditScope = resolution.scope;
  let source = resolution.source;
  let wallDefault = false;

  // ---- 3. COLOR ONLY WITH NO TARGET («رنگ کرم کن») → Wall default ----
  if (source === "conservative" && targets.length === 0 && colors.length > 0) {
    targets = ["wall"];
    scope = "single_item";
    wallDefault = true;
  }

  const isFull = scope === "room" || scope === "whole_home";
  const isRemove = REMOVE_PHRASES.some((p) => lower.includes(p));
  const isColor = (colors.length > 0 || /رنگ|color/.test(lower)) && !isRemove && targets.length > 0;

  let intent: DesignIntentType;
  if (isFull) intent = "full_redesign";
  else if (targets.length === 0) intent = "inquiry";
  else intent = isRemove ? "remove_item" : isColor ? "color_change" : "targeted_edit";

  const preservedElements = resolveProtectedElements({ targets, scope, explicitLocked });

  const labels = (ts: RoomElement[]) => ts.map((t) => ELEMENT_LABELS[t] || t).join("، ");
  let changeDescription = "";
  if (isFull) {
    changeDescription = `بازطراحی ${scope === "whole_home" ? "کل خانه" : req.room ?? "اتاق"}${resolvedStyle ? ` با سبک ${resolvedStyle}` : ""}`;
  } else if (intent === "remove_item") {
    changeDescription = `حذف ${labels(targets)}`;
  } else if (intent === "color_change") {
    changeDescription = `تغییر رنگ ${labels(targets)}${colors.length ? ` به ${colors.join("، ")}` : ""}`;
  } else if (intent !== "inquiry") {
    changeDescription = text.slice(0, 60);
  }

  const note =
    isFull && explicitLocked.length > 0
      ? "بازطراحی با حفظ عناصر درخواستی شما و حفاظت از معماری."
      : NOTES[source];

  return {
    intent,
    target: targets,
    changes: changeDescription
      ? [changeDescription, ...(explicitLocked.length ? [`حفظ ${labels(explicitLocked)}`] : [])].slice(0, 3)
      : [],
    preservedElements,
    scope,
    style: resolvedStyle,
    colors: req.colors?.length ? [...new Set([...req.colors, ...colors])] : colors,
    confidence: wallDefault ? 0.7 : intent === "inquiry" ? Math.min(resolution.confidence, 0.4) : resolution.confidence,
    ambiguous: intent === "inquiry" || wallDefault ? true : undefined,
    note,
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

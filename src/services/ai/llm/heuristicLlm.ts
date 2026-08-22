// ============================================================
// Heuristic LLM Provider (default — zero dependency, zero cost).
// Deterministic Persian keyword understanding built on the same
// roomState engine used for scoped changes. Always available so
// intent understanding NEVER fails, even with no API key.
//
// Also implements:
//   • Change-scope detection (Phase 4): single_item / area / room / whole_home
//   • Design memory / continuation (Phase 15): «کمی روشن‌ترش کن»
//     reuses the previous request's targets.
// ============================================================
import type { IntentRequest, IntentAnalysis, DesignIntentType, LlmProvider } from "./types";
import { detectIntent, ALL_ELEMENTS, type RoomElement } from "../roomState";
import { detectScope, type EditScope } from "../scope";

/** Broad-change phrases: only these unlock a full-room redesign.
 *  «مبل را عوض کن» must NEVER match here. */
const BROAD_PHRASES = [
  "مدرن کن", "مدرنش کن", "کلاسیک کن", "لوکس کن", "مینیمال کن", "بازطراحی",
  "طراحی کامل", "تغییر کلی", "همه رو", "همه را", "کل اتاق", "کل فضا",
  "کل خانه", "همه چیز", "از نو", "صفر تا صد", "دکور کامل", "full room", "redesign",
];

/** Removal detection → remove_item. */
const REMOVE_PHRASES = ["حذف کن", "بردار", "حذف شود", "نباشه", "remove"];

const COLOR_WORDS = ["کرم", "سفید", "طوسی", "سبز", "آبی", "سرمه‌ای", "قرمز", "زرد", "طلایی", "بژ", "دودی", "گلبهی", "مشکی", "قهوه‌ای"];

/** Continuation markers (Phase 15) — the prompt refers to the previous target
 *  without naming a new element: «کمی روشن‌ترش کن»، «آن را کوچک‌تر کن». */
const CONTINUATION_MARKERS = ["ترش", "ترش کن", "ش کن", "ش را", "آن را", "اون رو", "اونو", "همین", "این یکی", "این مورد", "بزرگترش", "کوچکترش", "روشن‌ترش", "تیره‌ترش"];

function extractColors(text: string): string[] {
  return COLOR_WORDS.filter((c) => text.includes(c));
}

/** Detect continuation references to a previous request's targets. */
function continuationTargets(text: string, previous?: RoomElement[]): RoomElement[] | null {
  if (!previous?.length) return null;
  if (CONTINUATION_MARKERS.some((m) => text.includes(m))) return previous;
  return null;
}

/** Resolve the change scope for a heuristic reading. */
export function resolveScopeFor(text: string, targets: RoomElement[], uiScope?: "targeted" | "full"): EditScope {
  return detectScope(text, targets, uiScope).scope;
}

export function heuristicUnderstandIntent(req: IntentRequest): IntentAnalysis {
  const text = req.prompt.trim();
  const lower = text.toLowerCase();
  const detected = detectIntent(text, req.style);
  const selected = req.selectedTargets ?? [];
  const scopeOf = (t: RoomElement[]) => resolveScopeFor(text, t, req.changeScope);

  // ---- No actionable text: whatever the user picked manually wins ----
  if (!text) {
    if (selected.length > 0) {
      const targets = selected;
      return {
        intent: "targeted_edit",
        target: targets,
        changes: [targets.length === 1 ? "تغییر عنصر انتخابی" : `تغییر ${targets.length} عنصر انتخابی`],
        preservedElements: ALL_ELEMENTS.filter((e) => !targets.includes(e)),
        scope: "single_item",
        style: req.style,
        colors: req.colors,
        confidence: 0.75,
        note: "دستوری نوشته نشده — فقط عناصر انتخابی‌ات تغییر می‌کنند.",
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
      confidence: 0.3,
      ambiguous: true,
      note: "بنویس چه چیزی باید تغییر کند تا دقیق اجرا کنیم.",
    };
  }

  const isBroad = BROAD_PHRASES.some((p) => lower.includes(p));
  const isRemove = REMOVE_PHRASES.some((p) => lower.includes(p));
  const colors = extractColors(text);

  // ---- FULL REDESIGN: only on explicit broad request ----
  if (isBroad || req.changeScope === "full") {
    const scope = resolveScopeFor(text, [...ALL_ELEMENTS], req.changeScope);
    return {
      intent: "full_redesign",
      target: [...ALL_ELEMENTS],
      changes: [`بازطراحی ${req.room ?? "فضا"}${req.style ? ` با سبک ${req.style}` : ""}`],
      preservedElements: [],
      scope,
      style: req.style,
      colors: req.colors?.length ? req.colors : colors,
      confidence: 0.92,
      note: "درخواست گسترده است — اجازه تغییر کل فضا داده شد.",
    };
  }

  // ---- TARGETED: union of detected + user-selected, never wider ----
  const targetSet = new Set<RoomElement>([...detected.targets, ...selected]);

  // ---- CONTINUATION (Phase 15): «کمی روشن‌ترش کن» → previous target ----
  if (targetSet.size === 0) {
    const prev = continuationTargets(text, req.previousTargets);
    if (prev && prev.length > 0) {
      return {
        intent: "targeted_edit",
        target: prev,
        changes: [text.slice(0, 60)],
        preservedElements: ALL_ELEMENTS.filter((e) => !prev.includes(e)),
        scope: "single_item",
        style: req.style,
        colors: req.colors?.length ? req.colors : colors,
        confidence: 0.85,
        note: "این درخواست ادامه‌ی تغییر قبلی است — همان المان قبلی هدف است.",
      };
    }
  }

  const targets = [...targetSet];
  const scope = scopeOf(targets);

  if (targets.length === 0) {
    // Color-only request without a specific element
    if (colors.length > 0) {
      return {
        intent: "color_change",
        target: ["wall"],
        changes: [`اعمال رنگ ${colors.join("، ")}`],
        preservedElements: ALL_ELEMENTS.filter((e) => e !== "wall"),
        scope: "single_item",
        style: req.style,
        colors,
        confidence: 0.7,
        ambiguous: true,
        note: "رنگ خواسته شده اما محل مشخص نیست — رنگ دیوار در نظر گرفته شد.",
      };
    }
    return {
      intent: "inquiry",
      target: [],
      changes: [],
      preservedElements: [...ALL_ELEMENTS],
      scope,
      style: req.style,
      colors: req.colors,
      confidence: 0.4,
      ambiguous: true,
      note: "مخاطب تغییر مشخص نیست؛ عنصر موردنظر را انتخاب کن یا دقیق‌تر بنویس.",
    };
  }

  const hasColor = colors.length > 0;
  // «مبل را کرم کن» → color_change on the sofa (only its color changes).
  // Surfaces (wall/floor/ceiling) allow color_change even for multiple targets.
  const isColorIntent = hasColor && (targets.length === 1 || targets.every((t) => t === "wall" || t === "floor" || t === "ceiling"));

  return {
    intent: isRemove ? "remove_item" : isColorIntent ? "color_change" : "targeted_edit",
    target: targets,
    changes: [
      isRemove
        ? `حذف ${targets.length === 1 ? "عنصر خواسته‌شده" : `${targets.length} عنصر`}`
        : `${text.slice(0, 60)}`,
    ],
    preservedElements: ALL_ELEMENTS.filter((e) => !targets.includes(e)),
    scope,
    style: req.style,
    colors: req.colors?.length ? [...new Set([...req.colors, ...colors])] : colors,
    confidence: detected.requiresClarification ? 0.6 : 0.9,
    note: "فقط عناصر خواسته‌شده تغییر می‌کنند — بقیه فضا قفل است.",
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

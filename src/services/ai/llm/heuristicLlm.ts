// ============================================================
// Heuristic LLM Provider (default — zero dependency, zero cost).
// Deterministic Persian keyword understanding built on the same
// roomState engine used for scoped changes. Always available so
// intent understanding NEVER fails, even with no API key.
// ============================================================
import type { IntentRequest, IntentAnalysis, DesignIntentType, LlmProvider } from "./types";
import { detectIntent, ALL_ELEMENTS, type RoomElement } from "../roomState";

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

function extractColors(text: string): string[] {
  return COLOR_WORDS.filter((c) => text.includes(c));
}

export function heuristicUnderstandIntent(req: IntentRequest): IntentAnalysis {
  const text = req.prompt.trim();
  const lower = text.toLowerCase();
  const detected = detectIntent(text, req.style);
  const selected = req.selectedTargets ?? [];

  // ---- No actionable text: whatever the user picked manually wins ----
  if (!text) {
    if (selected.length > 0) {
      return {
        intent: "targeted_edit",
        target: selected,
        changes: [selected.length === 1 ? "تغییر عنصر انتخابی" : `تغییر ${selected.length} عنصر انتخابی`],
        preservedElements: ALL_ELEMENTS.filter((e) => !selected.includes(e)),
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
    return {
      intent: "full_redesign",
      target: [...ALL_ELEMENTS],
      changes: [`بازطراحی ${req.room ?? "فضا"}${req.style ? ` با سبک ${req.style}` : ""}`],
      preservedElements: [],
      style: req.style,
      colors: req.colors?.length ? req.colors : colors,
      confidence: 0.92,
      note: "درخواست گسترده است — اجازه تغییر کل فضا داده شد.",
    };
  }

  // ---- TARGETED: union of detected + user-selected, never wider ----
  const targetSet = new Set<RoomElement>([...detected.targets, ...selected]);
  const targets = [...targetSet];

  if (targets.length === 0) {
    // Color-only request without a specific element
    if (colors.length > 0) {
      return {
        intent: "color_change",
        target: ["wall"],
        changes: [`اعمال رنگ ${colors.join("، ")}`],
        preservedElements: ALL_ELEMENTS.filter((e) => e !== "wall"),
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
      style: req.style,
      colors: req.colors,
      confidence: 0.4,
      ambiguous: true,
      note: "مخاطب تغییر مشخص نیست؛ عنصر موردنظر را انتخاب کن یا دقیق‌تر بنویس.",
    };
  }

  const hasColor = colors.length > 0;
  const isColorIntent = hasColor && targets.every((t) => t === "wall" || t === "floor" || t === "ceiling");

  return {
    intent: isRemove ? "remove_item" : isColorIntent ? "color_change" : "targeted_edit",
    target: targets,
    changes: [
      isRemove
        ? `حذف ${targets.length === 1 ? "عنصر خواسته‌شده" : `${targets.length} عنصر`}`
        : `${text.slice(0, 60)}`,
    ],
    preservedElements: ALL_ELEMENTS.filter((e) => !targets.includes(e)),
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

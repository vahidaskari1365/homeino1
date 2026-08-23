// ============================================================
// HOMEINO AI — CHANGE SCOPE ENGINE  (Phase 4 / golden rule)
//
// Every request is classified into ONE of four scopes:
//
//   single_item  → «مبل را عوض کن»            — only that object changes
//   area         → «فضای نشیمن را مدرن‌تر کن»  — one zone of the room
//   room         → «کل اتاق را ژاپندی کن»      — full redesign of the room
//   whole_home   → «کل خانه را از اول طراحی کن» — whole-home transformation
//
// RULE: scope is never widened implicitly. "When uncertain,
// preserve more and change less."
// ============================================================

import type { RoomElement } from "./roomState";

export type EditScope = "single_item" | "area" | "room" | "whole_home";

export interface ScopeDecision {
  scope: EditScope;
  /** 0..1 — how sure we are about the scope. */
  confidence: number;
  /** Short Persian explanation shown in the intent summary. */
  reason: string;
}

export const EDIT_SCOPES: readonly EditScope[] = ["single_item", "area", "room", "whole_home"];

export const EDIT_SCOPE_LABELS: Record<EditScope, string> = {
  single_item: "فقط یک المان",
  area: "یک ناحیه از فضا",
  room: "کل اتاق",
  whole_home: "کل خانه",
};

// ---- Explicit broad-scope phrases (must never match «مبل را عوض کن») ----

/** Only these unlock WHOLE-HOME transformation. */
const WHOLE_HOME_PATTERNS = [
  "کل خانه", "کل خونه", "همه خانه", "همه خونه", "تموم خونه", "تمام خانه",
  "کل فضای خانه", "کل فضای خونه", "کل ملک", "کل ویلا", "whole home", "whole house",
  "کل خونواده", // rare typo of خونه — keep, harmless
  "همه چیز خانه", "همه چیز خونه", "همه چی خانه", "همه چی خونه",
  "همه جای خانه", "همه جای خونه", "تمام فضای خانه",
];

/** Room-level redesign phrases. NOTE: bare «اتاق» is NOT enough —
 *  «میز اتاق خواب را عوض کن» must stay single_item. */
const ROOM_PATTERNS = [
  "کل اتاق", "همه اتاق", "تموم اتاق", "تمام اتاق", "اتاق رو", "اتاق را",
  "این اتاق", "اتاق کامل", "کامل اتاق", "کل فضا", "کل فضای", "کل سالن",
  "کل پذیرایی", "کل نشیمن", "کل خواب", "redesign", "بازطراحی", "از نو",
  "صفر تا صد", "دوباره طراحی", "طراحی کامل", "تغییر کلی", "دکور کامل",
  // Named rooms as the redesign subject (style/verb applied to the room itself).
  // Keep these specific; do NOT match «میز اتاق خواب» location phrases alone.
  "اتاق خواب را", "اتاق خواب رو", "اتاق نشیمن را", "اتاق نشیمن رو",
  "پذیرایی را", "پذیرایی رو", "آشپزخانه را", "آشپزخانه رو",
  "سالن را", "سالن رو",
  // «همه چیز را عوض کن» → the current space (room), never wider without «خانه».
  "همه چیز", "همه چی", "everything",
];

/** Style/redesign verbs that turn a named room into room scope
 *  e.g. «اتاق خواب را ژاپندی کن» — but not «میز اتاق خواب را عوض کن». */
const ROOM_STYLE_VERBS = [
  "مدرن", "مینیمال", "ژاپندی", "japandi", "کلاسیک", "لوکس", "بوهو", "boho",
  "اسکاندیناوی", "scandinavian", "صنعتی", "لافت", "industrial", "روستیک",
  "نئوکلاسیک", "مدیترانه", "بازطراحی", "طراحی", "دکور", "بهتر", "زیبا",
];

/** Zone / area-level phrases. */
const AREA_PATTERNS = [
  "فضای نشیمن", "نشیمن", "گوشه", "این بخش", "این قسمت", "این ناحیه",
  "منطقه", "ناحیه", "فضای پذیرایی", "فضای غذاخوری", "فضای کار", "فضای خواب",
  "کنار مبل", "کنار پنجره", "زیر پنجره", "کنار تخت", "جلوی مبل", "روی میز",
];

const SINGLE_ITEM_PATTERNS = ["فقط", "تنها", "همین", "فقط همین", "تنها همین"];

/** English keyword hints (lower-cased input). */
const WHOLE_HOME_EN = ["whole home", "whole house", "entire home", "entire house"];
const ROOM_EN = ["the room", "whole room", "entire room", "full room", "this room", "redesign", "re-design"];
const AREA_EN = ["corner", "area", "zone", "section", "nook"];

function countMatches(text: string, patterns: string[]): number {
  return patterns.reduce((n, p) => (text.includes(p) ? n + 1 : n), 0);
}

/**
 * Detect the change scope of a Persian/English interior request.
 *
 * @param text      raw user prompt
 * @param targets   elements already detected in the prompt (sofa, rug, …)
 * @param uiScope   optional scope hint from the caller ("targeted" | "full")
 */
export function detectScope(text: string, targets: RoomElement[] = [], uiScope?: "targeted" | "full"): ScopeDecision {
  const lower = text.trim().toLowerCase();

  // 1) WHOLE HOME — highest bar, explicit only.
  if (countMatches(lower, WHOLE_HOME_PATTERNS) > 0 || WHOLE_HOME_EN.some((p) => lower.includes(p))) {
    return { scope: "whole_home", confidence: 0.95, reason: "درخواست «کل خانه» است — کل فضا قابل تغییر است." };
  }

  // 2) ROOM — explicit room-level phrase, or the UI asked for a full redesign.
  const roomHits = countMatches(lower, ROOM_PATTERNS) + (ROOM_EN.some((p) => lower.includes(p)) ? 1 : 0);
  // «اتاق خواب را ژاپندی کن» / «اتاق را مدرن کن» — room + style verb, even if
  // keyword map leaked a furniture target (e.g. «خواب» → bed).
  const roomSubjectStyle =
    /(این\s*)?(اتاق(\s*خواب|\s*نشیمن)?|پذیرایی|آشپزخانه|سالن|فضا)\s*(را|رو)/.test(lower) &&
    ROOM_STYLE_VERBS.some((v) => lower.includes(v));
  if (roomHits > 0 || uiScope === "full" || roomSubjectStyle) {
    // «فقط مبل اتاق رو عوض کن» → single item wins despite «اتاق رو».
    if (targets.length > 0 && SINGLE_ITEM_PATTERNS.some((p) => lower.includes(p))) {
      return { scope: "single_item", confidence: 0.9, reason: "با وجود اشاره به اتاق، «فقط» یعنی فقط همان المان تغییر کند." };
    }
    // «میز اتاق خواب را عوض کن» — furniture object + location, not room redesign.
    // If targets name a non-structural object and there is NO style/redesign verb, keep single_item.
    const furnitureTargets = targets.filter((t) => !["wall", "floor", "ceiling", "door", "window"].includes(t));
    if (
      furnitureTargets.length > 0 &&
      !roomSubjectStyle &&
      !uiScope &&
      roomHits > 0 &&
      !ROOM_STYLE_VERBS.some((v) => lower.includes(v)) &&
      /(عوض|تغییر|حذف|بردار)/.test(lower)
    ) {
      return { scope: "single_item", confidence: 0.85, reason: "اشاره به اتاق فقط مکان است — فقط همان المان تغییر می‌کند." };
    }
    return { scope: "room", confidence: uiScope === "full" ? 0.85 : 0.8, reason: "درخواست بازطراحی کل اتاق است." };
  }

  // 3) AREA — one zone of the room.
  const areaHits = countMatches(lower, AREA_PATTERNS) + (AREA_EN.some((p) => lower.includes(p)) ? 1 : 0);
  if (areaHits > 0) {
    return { scope: "area", confidence: 0.8, reason: "فقط یک ناحیه از فضا هدف است." };
  }

  // 4) Multiple explicit targets → area (several items together).
  if (targets.length > 1) {
    return { scope: "area", confidence: 0.75, reason: "چند المان با هم تغییر می‌کنند — بقیه فضا قفل است." };
  }

  // 5) Default — the safest scope: change the least.
  if (targets.length === 1) {
    return { scope: "single_item", confidence: 0.9, reason: "فقط همان المان درخواست‌شده تغییر می‌کند." };
  }
  return { scope: "single_item", confidence: 0.5, reason: "مخاطب تغییر مشخص نیست — حداقل تغییر اعمال می‌شود." };
}

/** Image-edit strength (artistic freedom) for a scope. */
export function scopeToEditStrength(scope: EditScope): number {
  switch (scope) {
    case "single_item": return 0.45;
    case "area": return 0.55;
    case "room": return 0.7;
    case "whole_home": return 0.85;
  }
}

/** Map a scope onto the intent type used by the LLM contract. */
export function scopeToIntentType(scope: EditScope): "targeted_edit" | "full_redesign" {
  return scope === "room" || scope === "whole_home" ? "full_redesign" : "targeted_edit";
}

/** True when the scope allows full-room regeneration (not just targeted edit). */
export function isFullScope(scope: EditScope): boolean {
  return scope === "room" || scope === "whole_home";
}

/** Persian human label for scope reasons / summaries. */
export function scopeSummary(scope: EditScope, targets: RoomElement[], labels: Record<RoomElement, string>): string {
  if (scope === "whole_home") return "کل خانه تغییر می‌کند — همه‌چیز قابل تغییر است.";
  if (scope === "room") return "کل اتاق بازطراحی می‌شود.";
  if (scope === "area") return `ناحیه‌ی ${targets.map((t) => labels[t]).join("، ")} تغییر می‌کند — بقیه فضا حفظ می‌شود.`;
  return `فقط «${targets.map((t) => labels[t]).join("، ")}» تغییر می‌کند — بقیه فضا حفظ می‌شود.`;
}

// ============================================================
// HOMEINO AI — CHANGE SCOPE ENGINE  (SINGLE SOURCE OF TRUTH)
//
// Every request is classified into ONE of four scopes:
//
//   single_item  → «مبل را عوض کن»            — only that object changes
//   area         → «فضای نشیمن را مدرن‌تر کن»  — one zone of the room
//   room         → «کل اتاق را ژاپندی کن»      — full redesign of the room
//   whole_home   → «کل خانه را از اول طراحی کن» — whole-home transformation
//
// CANONICAL DECISION TREE (AI ACCURACY PATCH — fix 3):
//   NO other module (roomState / heuristicLlm / openaiCompatLlm /
//   pipeline) may resolve scope by its own rules. They ALL route
//   through resolveScope() below:
//
//   1. Explicit user target (named element)     → single_item (area when several)
//   2. Explicit UI selection + targeted request → selected category
//   3. Explicit area                            → area
//   4. Explicit whole-home redesign             → whole_home
//   5. Explicit one-room redesign (or UI "full"
//      mode with no category selection)         → room
//   6. Continuation of previous target          → previous target
//   7. Conservative fallback                    → preserve more, change less
//
// RULES:
//   • scope is never widened implicitly — generic «همه/کل/همه چیز/everything»
//     ALONE never produces room / whole_home / full_redesign (fix 2)
//   • structural elements (wall, floor, ceiling, window, door, geometry,
//     camera) stay protected by default; only an explicit user request
//     targets them (fix 4)
//   • sofa ≠ chair — two distinct categories, never merged (fix 1)
// ============================================================

import type { RoomElement } from "./roomState";
import {
  DESIGNABLE_ELEMENTS,
  STRUCTURAL_ELEMENTS,
  detectIntent,
  detectArchitecturalTargets,
  detectExplicitLocked,
} from "./roomState";

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

// ============================================================
// CANONICAL PHRASE PATTERNS — single source of truth.
// heuristicLlm.ts / openaiCompatLlm.ts / pipeline.ts MUST import
// these — re-declaring them anywhere else is forbidden.
// ============================================================

/** Only these unlock WHOLE-HOME transformation — an explicit home reference. */
export const WHOLE_HOME_PATTERNS = [
  "کل خانه", "کل خونه", "همه خانه", "همه خونه", "تموم خونه", "تمام خانه",
  "کل فضای خانه", "کل فضای خونه", "کل ملک", "کل ویلا",
  "همه چیز خانه", "همه چیز خونه", "همه چی خانه", "همه چی خونه",
  "همه جای خانه", "همه جای خونه", "تمام فضای خانه",
  "اتاق‌های خانه", "اتاق های خانه", "اتاق‌های خونه", "اتاق های خونه",
  "کل اتاق‌های خانه", "کل اتاق های خانه",
  "خانه را از اول", "خونه رو از اول", "خانه از اول", "خونه از اول",
];

export const WHOLE_HOME_EN = ["whole home", "whole house", "entire home", "entire house"];

/**
 * Explicit room-level redesign phrases.
 * NOTE: bare «اتاق» is NOT enough — «میز اتاق خواب را عوض کن» must stay
 * single_item. Generic «all» words (همه/کل/همه چیز/everything) alone are
 * NOT room scope (fix 2).
 */
export const ROOM_PATTERNS = [
  "کل اتاق", "همه اتاق", "تموم اتاق", "تمام اتاق", "اتاق کامل", "کامل اتاق",
  "کل فضا", "کل فضای", "کل سالن", "کل پذیرایی", "کل نشیمن", "کل خواب",
  "این اتاق", "اتاق رو", "اتاق را",
  "پذیرایی را", "پذیرایی رو", "آشپزخانه را", "آشپزخانه رو",
  "سالن را", "سالن رو", "این فضا را", "این فضا رو", "این فضا",
  "بازطراحی", "از نو", "صفر تا صد", "دوباره طراحی", "طراحی کامل", "تغییر کلی", "دکور کامل",
  "redesign", "re-design", "full room",
];

export const ROOM_EN = ["the room", "whole room", "entire room", "full room", "this room"];

/** Style/redesign verbs that turn a room phrase into a room redesign
 *  e.g. «اتاق خواب را ژاپندی کن» — but not «میز اتاق خواب را عوض کن». */
export const ROOM_STYLE_VERBS = [
  "مدرن", "مینیمال", "ژاپندی", "japandi", "کلاسیک", "لوکس", "بوهو", "boho",
  "اسکاندیناوی", "scandinavian", "صنعتی", "لافت", "industrial", "loft",
  "روستیک", "نئوکلاسیک", "مدیترانه", "mediterranean", "آرت دکو", "art deco",
  "میدسنچری", "mid-century", "معاصر", "contemporary",
  "بازطراحی", "طراحی", "دکور", "بهتر", "زیبا", "زیباتر", "قشنگ", "قشنگتر",
];

/** Zone / area-level phrases. */
export const AREA_PATTERNS = [
  "فضای نشیمن", "نشیمن", "گوشه", "این بخش", "این قسمت", "این ناحیه",
  "منطقه", "ناحیه", "فضای پذیرایی", "فضای غذاخوری", "فضای کار", "فضای خواب",
  "کنار مبل", "کنار پنجره", "زیر پنجره", "کنار تخت", "جلوی مبل", "روی میز",
];

const AREA_EN = ["corner", "nook", "zone"];

const ROOM_SUBJECT_RE = /(این\s*)?(اتاق(\s*خواب|\s*نشیمن)?|پذیرایی|سالن|فضا|آشپزخانه)\s*(را|رو)?/;
const ROOM_EN_VERB_RE = /(redesign|re-design|make|create|design|style|improve|better)/;

export function isWholeHomeRequest(text: string): boolean {
  const lower = String(text ?? "").toLowerCase();
  return (
    WHOLE_HOME_PATTERNS.some((p) => lower.includes(p)) ||
    WHOLE_HOME_EN.some((p) => lower.includes(p))
  );
}

export function isRoomRedesignRequest(text: string): boolean {
  const lower = String(text ?? "").toLowerCase();
  // A whole-home request is NOT a one-room request — never narrow it down.
  if (isWholeHomeRequest(lower)) return false;
  if (ROOM_PATTERNS.some((p) => lower.includes(p))) return true;
  if (ROOM_SUBJECT_RE.test(lower) && ROOM_STYLE_VERBS.some((v) => lower.includes(v))) return true;
  if (
    /یک\s*طراحی\s*بهتر\s*برای\s*(این\s*)?(فضا|اتاق)/.test(lower) ||
    /طراحی\s*بهتر\s*برای\s*(این\s*)?(فضا|اتاق)/.test(lower)
  ) {
    return true;
  }
  if (ROOM_EN.some((p) => lower.includes(p)) && ROOM_EN_VERB_RE.test(lower)) return true;
  return false;
}

export function isAreaRequest(text: string): boolean {
  const lower = String(text ?? "").toLowerCase();
  // «اتاق نشیمن» / «اتاق خواب» are ROOM NAMES — the zone word inside them is
  // not an area request. «sectional» is a SOFA, never an area keyword.
  const masked = lower
    .replace(/اتاق\s*(نشیمن|خواب)/g, "اتاق")
    .replace(/sectional/g, " ");
  return AREA_PATTERNS.some((p) => masked.includes(p)) || AREA_EN.some((p) => masked.includes(p));
}

// ============================================================
// CONTINUATION (Phase 15) — canonical markers, shared by every layer.
// ============================================================

/** Continuation markers — referring to the previous target without naming a new element. */
export const CONTINUATION_MARKERS = [
  "ترش", "ش کن", "آن را", "اون رو", "اونو", "همین", "این یکی", "این مورد",
  "بزرگترش", "کوچکترش", "کوچیکترش", "روشن‌ترش", "تیره‌ترش",
];

/** Returns the previous targets when the prompt is a continuation of them. */
export function continuationTargets(text: string, previous?: RoomElement[]): RoomElement[] | null {
  if (!previous?.length) return null;
  const lower = String(text ?? "").toLowerCase();
  if (!lower) return null;
  if (CONTINUATION_MARKERS.some((m) => lower.includes(m))) return previous;
  return null;
}

// ============================================================
// THE CANONICAL SCOPE DECISION TREE
// ============================================================

export type ScopeSource =
  | "explicit_target"
  | "ui_selection"
  | "area"
  | "whole_home"
  | "room"
  | "continuation"
  | "conservative";

export interface ScopeResolution {
  scope: EditScope;
  targets: RoomElement[];
  source: ScopeSource;
  confidence: number;
  reason: string;
}

export interface ResolveScopeParams {
  /** Raw user prompt. */
  text: string;
  /** Elements the user explicitly picked in the UI (designer selection). */
  selectedTargets?: RoomElement[];
  /** UI redesign-mode hint ("targeted" | "full"). */
  uiScope?: "targeted" | "full";
  /** Explicitly locked elements (defaults: detected from the text). */
  explicitLocked?: RoomElement[];
  /** Continuation memory (Phase 15). */
  previousTargets?: RoomElement[];
  /** Scope of the previous request (continuation fidelity). */
  previousScope?: EditScope;
  /** Elements already detected in the prompt by the caller (optional override). */
  promptTargets?: RoomElement[];
}

/** Default elements an area-level request restyles (the zone's furniture & decor). */
export const AREA_DEFAULT_TARGETS: RoomElement[] = ["sofa", "table", "lighting", "rug"];

/**
 * CANONICAL SCOPE DECISION TREE — the single source of truth (fix 3).
 *
 * Every layer (heuristic LLM, LLM normalization, pipeline) must route
 * scope/target resolution through here. No other module may override it.
 * normalize → resolve → validate produces exactly ONE final scope.
 */
export function resolveScope(params: ResolveScopeParams): ScopeResolution {
  const text = String(params.text ?? "").trim();
  const lower = text.toLowerCase();
  const selected = (params.selectedTargets ?? []).filter(Boolean);
  const explicitLocked = params.explicitLocked ?? (text ? detectExplicitLocked(lower) : []);
  const wholeHome = isWholeHomeRequest(lower);
  const room = isRoomRedesignRequest(lower);
  const area = isAreaRequest(lower);

  // Named targets — explicit elements in the prompt. detectIntent() normalizes
  // room-name phrases («اتاق خواب») so «خواب» never false-positives as bed.
  let detected: RoomElement[];
  if (params.promptTargets) {
    detected = params.promptTargets;
  } else {
    const intent = text ? detectIntent(text) : null;
    // A full-redesign phrase in the prompt is NOT a named item target.
    detected = intent && intent.type === "full_redesign" ? [] : intent ? intent.targets : [];
  }
  const namedAll = [...new Set([...detected, ...detectArchitecturalTargets(lower)])].filter(
    (t) => !explicitLocked.includes(t),
  );

  // 1) Explicit user target — highest priority (fix 1: «صندلی» → chair, never sofa).
  // EXCEPTION: if the prompt ALSO carries an explicit room/whole-home redesign
  // AND the named targets are purely structural («دیوار را خراب کن و اتاق را
  // مدرن کن»), the broader redesign wins — the structural element is then
  // explicitly targeted within it (fix 4). Named furniture always wins.
  const broadRequest = room || wholeHome;
  const namedOnlyStructural = namedAll.every((t) => STRUCTURAL_ELEMENTS.includes(t));
  if (namedAll.length > 0 && !(broadRequest && namedOnlyStructural)) {
    return {
      scope: namedAll.length === 1 ? "single_item" : "area",
      targets: namedAll,
      source: "explicit_target",
      confidence: 0.9,
      reason: "عنصر(های) مشخص‌شده در متن درخواست هدف تغییر است.",
    };
  }

  // 2) Explicit UI selection (fix 5) — the selection controls the transformation
  //    UNLESS the request explicitly asks for something broader (room / home).
  if (selected.length > 0 && !room && !wholeHome) {
    return {
      scope: selected.length === 1 ? "single_item" : "area",
      targets: selected,
      source: "ui_selection",
      confidence: 0.92,
      reason: "فقط دسته/عنصر انتخابی تغییر می‌کند.",
    };
  }

  // 3) Explicit area — one zone of the room.
  if (area) {
    return {
      scope: "area",
      targets: [...AREA_DEFAULT_TARGETS],
      source: "area",
      confidence: 0.8,
      reason: "فقط یک ناحیه از فضا هدف است.",
    };
  }

  // 4) Explicit whole-home redesign — the highest bar, explicit home phrase only
  //    (fix 2: generic «همه/کل» alone never gets here). Checked before the
  //    UI "full" trigger so a home request is never narrowed to one room.
  if (wholeHome) {
    return {
      scope: "whole_home",
      targets: fullScopeTargets(lower, explicitLocked),
      source: "whole_home",
      confidence: 0.95,
      reason: "درخواست «کل خانه» است — کل فضا قابل تغییر است.",
    };
  }

  // 5) Explicit one-room redesign — or the UI explicitly asked for a full
  //    redesign without any category selection.
  if (room || (params.uiScope === "full" && selected.length === 0)) {
    return {
      scope: "room",
      targets: fullScopeTargets(lower, explicitLocked),
      source: "room",
      confidence: room ? 0.88 : 0.85,
      reason: "درخواست بازطراحی کل اتاق است.",
    };
  }

  // 6) Continuation of the previous target (Phase 15 — behavior preserved).
  const previous = continuationTargets(lower, params.previousTargets);
  if (previous) {
    const prevScope =
      params.previousScope && (EDIT_SCOPES as readonly string[]).includes(params.previousScope)
        ? params.previousScope
        : undefined;
    return {
      scope: prevScope ?? (previous.length === 1 ? "single_item" : "area"),
      targets: previous,
      source: "continuation",
      confidence: 0.88,
      reason: "ادامه‌ی تغییر قبلی — همان المان قبلی هدف است.",
    };
  }

  // 7) Conservative fallback — preserve more, change less.
  return {
    scope: "single_item",
    targets: [],
    source: "conservative",
    confidence: 0.4,
    reason: "مخاطب تغییر مشخص نیست — حداقل تغییر اعمال می‌شود.",
  };
}

/**
 * Full-scope targets (fix 4): ALL DESIGNABLE elements are permitted —
 * structural elements (wall/floor/ceiling/window/door) join the targets
 * ONLY when the user explicitly requested them.
 */
function fullScopeTargets(lower: string, explicitLocked: RoomElement[]): RoomElement[] {
  const explicitStructural = detectArchitecturalTargets(lower);
  return [...DESIGNABLE_ELEMENTS, ...explicitStructural].filter((e) => !explicitLocked.includes(e));
}

// ============================================================
// COMPATIBILITY + HELPERS
// ============================================================

/**
 * Detect the change scope of a Persian/English interior request.
 * Thin compatibility wrapper around the canonical decision tree
 * (resolveScope) — kept so existing callers keep working unchanged.
 *
 * @param text            raw user prompt
 * @param targets         elements already detected in the prompt (optional)
 * @param uiScope         optional scope hint from the caller ("targeted" | "full")
 * @param selectedTargets elements explicitly chosen in UI (e.g. ["sofa"])
 */
export function detectScope(
  text: string,
  targets: RoomElement[] = [],
  uiScope?: "targeted" | "full",
  selectedTargets: RoomElement[] = [],
): ScopeDecision {
  const resolution = resolveScope({
    text,
    uiScope,
    selectedTargets,
    promptTargets: targets.length ? targets : undefined,
  });
  return { scope: resolution.scope, confidence: resolution.confidence, reason: resolution.reason };
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
  if (scope === "whole_home") return "کل خانه بازطراحی می‌شود — معماری ساختاری حفظ می‌شود.";
  if (scope === "room") return "کل اتاق بازطراحی می‌شود — معماری ساختاری حفظ می‌شود.";
  if (scope === "area") return `ناحیه‌ی ${targets.map((t) => labels[t]).join("، ")} تغییر می‌کند — بقیه فضا حفظ می‌شود.`;
  return `فقط «${targets.map((t) => labels[t]).join("، ")}» تغییر می‌کند — بقیه فضا حفظ می‌شود.`;
}

// ============================================================
// LLM LAYER — TYPES (client-safe, pure types only).
//
// Architecture contract:
//   UI (AI Designer) → /api/ai → LLM Service → LLM Provider
//
// The provider is NEVER hard-coded in the UI. The LLM Service
// resolves the active provider server-side (heuristic by default,
// any OpenAI-compatible endpoint when configured). Swapping the
// provider requires zero UI changes.
//
// GOLDEN RULE FOR LLM OUTPUT:
//   Intent analysis is ALWAYS structured JSON — never prose.
//   The LLM's job is UNDERSTANDING the request, not chatting.
//   Hard cap: ≤ 220 completion tokens per intent call.
// ============================================================
import type { RoomElement } from "../roomState";
import type { EditScope } from "../scope";

/** What kind of design request the user made. */
export type DesignIntentType =
  | "targeted_edit"   // «مبل را عوض کن» — only the target changes
  | "full_redesign"   // «این اتاق را مدرن کن» — broad changes allowed
  | "color_change"    // «رنگ دیوار را کرم کن» — color only
  | "add_item"        // «یک فرش اضافه کن»
  | "remove_item"     // «مبل را حذف کن»
  | "inquiry";        // no actionable design request

/** Input for intent understanding. Cheap, no image generation. */
export interface IntentRequest {
  prompt: string;
  style?: string;
  room?: string;
  colors?: string[];
  /** Scope chosen in the designer UI. The LLM may never widen a
   *  targeted scope into a full redesign without an explicit
   *  broad request in the prompt itself. */
  changeScope?: "targeted" | "full";
  /** Elements the user explicitly picked as "change these". */
  selectedTargets?: RoomElement[];
  // ---- Design memory (Phase 15) — compact continuation context ----
  /** Targets of the previous request, e.g. ["sofa"] so that
   *  «کمی روشن‌ترش کن» still points at the same sofa. */
  previousTargets?: RoomElement[];
  /** Short phrases of what was changed last time. */
  previousChanges?: string[];
  /** Compact structured room context (see services/ai/context.ts). */
  roomContext?: string;
  budget?: { min?: number; max?: number; currency?: string };
}

/**
 * STRUCTURED INTENT — the exact contract every provider must return:
 *   { intent, target, changes, preservedElements, style, colors, confidence }
 * No long text. No chat. One short optional note at most.
 */
export interface IntentAnalysis {
  intent: DesignIntentType;
  /** ALL elements the user wants changed — nothing more. */
  target: RoomElement[];
  /** Human-readable list of requested changes (short phrases). */
  changes: string[];
  /** Elements that MUST stay untouched. */
  preservedElements: RoomElement[];
  /** Change scope (Phase 4) — computed server-side when absent. */
  scope?: EditScope;
  /** Extra protected elements beyond preservedElements (Phase 5). */
  protectedElements?: RoomElement[];
  style?: string;
  colors?: string[];
  /** 0..1 — how sure the model is about the intent. */
  confidence: number;
  /** True when the request is unclear and needs user confirmation. */
  ambiguous?: boolean;
  /** At most ONE short sentence (Persian) explaining the reading. */
  note?: string;
}

/** The pluggable LLM contract. */
export interface LlmProvider {
  readonly name: string;
  understandIntent(req: IntentRequest): Promise<IntentAnalysis>;
}

export const INTENT_LABELS: Record<DesignIntentType, string> = {
  targeted_edit: "تغییر هدفمند",
  full_redesign: "بازطراحی کامل",
  color_change: "تغییر رنگ",
  add_item: "افزودن عنصر",
  remove_item: "حذف عنصر",
  inquiry: "درخواست نامشخص",
};

// ============================================================
// AI SERVICE — the SINGLE entry point the UI uses for all AI.
// Client-safe: it only talks to the server route /api/ai. The actual
// provider (Mock by default, Gemini-ready, FreeLLMAPI optional) is
// resolved server-side in services/ai/provider.ts — the UI never
// imports a provider or a key. Swap the backend without touching UI.
// ============================================================
import type {
  GenerateDesignInput, GeneratedDesign,
  ChatReplyInput, ChatReply, DecorSuggestion, RoomAnalysis, RecommendedProduct,
} from "./types";
import type { IntentRequest, IntentAnalysis } from "./llm/types";
import type { PipelineInput, PipelineResult } from "./pipeline";
import { AI_MODES } from "./types";
import { CREDIT_CONFIG, costForMode } from "./credits";

export type { AiProvider, GenerateDesignInput, GeneratedDesign, ChatReplyInput, ChatReply, DecorSuggestion, RoomAnalysis, RecommendedProduct } from "./types";
export { AI_MODES, CREDIT_CONFIG, costForMode };

// ---- Pipeline / LLM / Orali contracts the UI consumes ----
// Architecture: AI Designer (UI) → /api/ai → Pipeline → { LLM Service, Orali, Base Provider }
export type { IntentRequest, IntentAnalysis, DesignIntentType, LlmProvider } from "./llm/types";
export { INTENT_LABELS } from "./llm/types";
export type { OverlayRegion, OverlayBox, OraliEditRequest, OraliEditResult, OraliClient } from "./orali/types";
export type { PipelineInput, DesignInstruction, PipelineResult, PipelineOutcome, ChangeScope } from "./pipeline";
export { AI_PHASE_LABEL, AI_WAIT_TIPS, PIPELINE_STEPS, isBusyPhase, stepIndexForPhase } from "./states";
export type { AiPhase, PipelineStepKey } from "./states";

// ---- AI Engine core (Phases 2–15) — pure, client-safe ----
export { detectScope, scopeToEditStrength, scopeToIntentType, isFullScope, scopeSummary, EDIT_SCOPE_LABELS } from "./scope";
export type { EditScope, ScopeDecision } from "./scope";
export { buildAIContext, compactContextForLlm, contextSummary, CONTEXT_STRUCTURAL_HINTS } from "./context";
export type { AIContext, ContextProduct, BuildContextInput } from "./context";
export { planProductPlacement, productPlacementPrompt } from "./placement";
export type { PlacementProduct, ProductPlacementPlan } from "./placement";
export { extractJsonPayload, validateIntentPayload, withBoundedRetry } from "./validation";
export type { RetryResult } from "./validation";
export { AiError, classifyAiError, toPublicAiError, AI_ERROR_MESSAGE } from "./errors";
export type { AiErrorCode, PublicAiError } from "./errors";

/** Low-level server call. Identity is resolved SERVER-side from the httpOnly
 *  Supabase session cookie — the client never sends (or fakes) a user id. */
export async function callAiServer<T>(action: string, payload: unknown): Promise<T> {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    // پیام صادقانه به‌جای «AI service unavailable» مبهم: بدنهٔ JSON خطای
    // سرور (UNAUTHORIZED / RATE_LIMIT / پیام فارسی) حفظ می‌شود تا UI
    // بتواند ۴۰۱ را به ورود هدایت کند. صفحات HTML خطا (۵۰۰) هم safe.
    let message = "سرویس هوش مصنوعی در دسترس نیست";
    let code = "";
    try {
      const j = (await res.json()) as { error?: string; code?: string };
      if (j?.error) message = j.error;
      if (j?.code) code = j.code;
    } catch { /* HTML error page — keep the default message */ }
    const err = new Error(message) as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = code;
    throw err;
  }
  return res.json() as Promise<T>;
}

/** Grounded multi-turn chat result — real products are always catalog-verified. */
export interface AgentChatResult {
  content: string;
  products?: unknown[];
  routedTo?: string;
  intent?: string;
  dataState?: string;
  agentOk?: boolean;
}

/** The ONLY AI surface the UI should import. */
export const aiService = {
  generate: (input: GenerateDesignInput) => callAiServer<GeneratedDesign>("generate", input),
  edit: (input: GenerateDesignInput) => callAiServer<GeneratedDesign>("edit", input),
  inpaint: (input: GenerateDesignInput) => callAiServer<GeneratedDesign>("inpaint", input),
  analyze: (input: GenerateDesignInput) => callAiServer<RoomAnalysis>("analyze", input),
  recommend: (input: GenerateDesignInput) => callAiServer<RecommendedProduct[]>("recommend", input),
  chat: (input: ChatReplyInput) => callAiServer<ChatReply>("chat", input),
  /** Grounded chat: /api/ai action=agent → real catalog + output-guarded answers. */
  agentChat: (input: ChatReplyInput & { sessionId?: string }) => callAiServer<AgentChatResult>("agent", input),
  /** DB-backed PDP quick questions: /api/ai action=advice → grounded pair/color/style
   *  answer from the LIVE catalog (null → caller falls back to the static engine). */
  productAdvice: (input: { topic: string; slug: string }) =>
    callAiServer<{ advice: { text: string; products?: unknown[] } | null }>("advice", input),
  suggest: (input: { room: string; style: string; budget?: string }) => callAiServer<DecorSuggestion>("suggest", input),
  /** LLM intent understanding — structured JSON, free (0 credits). */
  understand: (input: IntentRequest) => callAiServer<IntentAnalysis>("understand", input),
  /** Full design pipeline: understand → instruct → generate → validate. */
  pipeline: (input: PipelineInput) => callAiServer<PipelineResult>("pipeline", input),
  /** Vision: where does each counterpart ACTUALLY sit in the room photo?
   * Returns [] when the key is absent / detection fails — planner falls back. */
  detectObjects: (input: { referenceImage: string; categories: string[] }) =>
    callAiServer<{ objects: { type: string; region: { x: number; y: number; w: number; h: number } }[] }>("detect-objects", input),
  /** Task 42 — عکس‌های واقعی گوگل (serper.dev) هم‌راستای دکوراسیون:
   *  سرور کوئری را ترجمه + گارد دامنه می‌کند و کش ۶ساعته دارد. */
  searchImages: (input: { query: string; num?: number }) =>
    callAiServer<{ images: { imageUrl: string; title: string; source: string; link?: string; width?: number; height?: number }[]; configured: boolean }>("search-images", input),
};


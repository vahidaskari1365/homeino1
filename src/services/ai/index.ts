// ============================================================
// AI SERVICE — the SINGLE entry point the UI uses for all AI.
// Client-safe: it only talks to the server route /api/ai. The actual
// provider (Mock by default, Gemini-ready, FreeLLMAPI optional) is
// resolved server-side in services/ai/provider.ts — the UI never
// imports a provider or a key. Swap the backend without touching UI.
// ============================================================
import type {
  AiProvider, GenerateDesignInput, GeneratedDesign,
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

/** Low-level server call. Automatically attaches userId from localStorage
 *  (optimistic — backend will use the authenticated session instead). */
export async function callAiServer<T>(action: string, payload: unknown): Promise<T> {
  // Read userId from persisted auth (non-reactive, safe for non-component use)
  let userHash: string | null = null;
  try {
    const raw = localStorage.getItem("homeino-auth");
    if (raw) {
      const parsed = JSON.parse(raw);
      const email = parsed?.state?.user?.email;
      if (email) {
        let h = 0;
        for (let i = 0; i < email.length; i++) { h = (h << 5) - h + email.charCodeAt(i); h |= 0; }
        userHash = `u_${Math.abs(h).toString(36)}`;
      }
    }
  } catch { /* ignore */ }

  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, payload, _userHash: userHash }),
  });
  if (!res.ok) throw new Error("AI service unavailable");
  return res.json() as Promise<T>;
}

/** The ONLY AI surface the UI should import. */
export const aiService = {
  generate: (input: GenerateDesignInput) => callAiServer<GeneratedDesign>("generate", input),
  edit: (input: GenerateDesignInput) => callAiServer<GeneratedDesign>("edit", input),
  inpaint: (input: GenerateDesignInput) => callAiServer<GeneratedDesign>("inpaint", input),
  analyze: (input: GenerateDesignInput) => callAiServer<RoomAnalysis>("analyze", input),
  recommend: (input: GenerateDesignInput) => callAiServer<RecommendedProduct[]>("recommend", input),
  chat: (input: ChatReplyInput) => callAiServer<ChatReply>("chat", input),
  suggest: (input: { room: string; style: string; budget?: string }) => callAiServer<DecorSuggestion>("suggest", input),
  /** LLM intent understanding — structured JSON, free (0 credits). */
  understand: (input: IntentRequest) => callAiServer<IntentAnalysis>("understand", input),
  /** Full design pipeline: understand → instruct → generate → validate. */
  pipeline: (input: PipelineInput) => callAiServer<PipelineResult>("pipeline", input),
};

// type re-export for convenience (unused import suppression)
export type { AiProvider as _AiProvider } from "./types";

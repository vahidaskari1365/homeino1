// ============================================================
// LLM SERVICE — the single facade the AI pipeline and /api/ai
// use for intent understanding.
//
//   resolveLlm() order:
//     1. OpenAI-compatible endpoint → LLM_API_BASE_URL + LLM_API_KEY
//     2. Heuristic engine (always available, deterministic)
//
// The service NEVER throws: remote failures degrade to the
// heuristic provider so the pipeline can always proceed.
// ============================================================
import type { IntentRequest, IntentAnalysis, LlmProvider } from "./types";
import { heuristicLlmProvider, heuristicUnderstandIntent } from "./heuristicLlm";
import { openAiCompatLlmProvider, isOpenAiCompatConfigured, normalizeIntentAnalysis } from "./openaiCompatLlm";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "./systemPrompt";

export type { IntentRequest, IntentAnalysis, LlmProvider, DesignIntentType } from "./types";
export { INTENT_LABELS } from "./types";
export { heuristicUnderstandIntent, heuristicLlmProvider, openAiCompatLlmProvider };
export { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT };

export interface ResolvedLlm {
  llm: LlmProvider;
  /** "openai-compat" = real remote LLM · "heuristic" = built-in engine */
  source: "openai-compat" | "heuristic";
}

export async function resolveLlm(): Promise<ResolvedLlm> {
  if (isOpenAiCompatConfigured()) {
    try {
      const m = await import("./openaiCompatLlm");
      return { llm: m.openAiCompatLlmProvider, source: "openai-compat" };
    } catch { /* fall through */ }
  }
  return { llm: heuristicLlmProvider, source: "heuristic" };
}

export interface UnderstandingResult {
  analysis: IntentAnalysis;
  source: ResolvedLlm["source"];
  /** True when the remote LLM failed and we fell back locally. */
  degraded: boolean;
}

/** Never-throws intent understanding. */
export async function understandIntent(req: IntentRequest): Promise<UnderstandingResult> {
  const { llm, source } = await resolveLlm();
  if (source === "heuristic") {
    return { analysis: await llm.understandIntent(req), source, degraded: false };
  }
  try {
    const raw = await llm.understandIntent(req);
    // Re-validate even on success — cheap insurance against drift.
    return { analysis: normalizeIntentAnalysis(raw, req), source, degraded: false };
  } catch {
    return { analysis: heuristicUnderstandIntent(req), source: "heuristic", degraded: true };
  }
}

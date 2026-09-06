// ============================================================
// ZAI LLM Provider — SERVER-ONLY intent understanding through
// the self-hosted engine's OpenAI-compatible /chat/completions
// (GLM). Activates when the engine is configured via env OR
// `.z-ai-config` file — no extra keys.
//
// Same output contract as openaiCompatLlm: tiny structured JSON,
// schema-validated, bounded retry, heuristic fallback.
// ============================================================
import type { IntentRequest, IntentAnalysis, LlmProvider } from "./types";
import { heuristicUnderstandIntent } from "./heuristicLlm";
import { extractJsonPayload, validateIntentPayload, withBoundedRetry } from "../validation";
import { normalizeIntentAnalysis } from "./openaiCompatLlm";
import { engineChat } from "../orali/oraliClient";
import { isZEngineConfigured } from "../engineConfig";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "./systemPrompt";

/** Serialize the user turn — mirrors openaiCompatLlm.buildUserMessage. */
function buildUserMessage(req: IntentRequest): string {
  const core: Record<string, unknown> = { prompt: req.prompt };
  if (req.style) core.style = req.style;
  if (req.room) core.room = req.room;
  if (req.colors?.length) core.colors = req.colors;
  if (req.changeScope) core.changeScope = req.changeScope;
  if (req.selectedTargets?.length) core.selectedTargets = req.selectedTargets;
  if (req.previousTargets?.length) core.previousTargets = req.previousTargets;
  if (req.previousChanges?.length) core.previousChanges = req.previousChanges.slice(0, 2);
  if (req.roomContext) core.roomContext = req.roomContext;
  if (req.budget) core.budget = req.budget;
  return JSON.stringify(core);
}

async function callEngine(req: IntentRequest): Promise<IntentAnalysis> {
  const result = await withBoundedRetry(
    async (attempt) => {
      let userContent = buildUserMessage(req);
      if (attempt > 0) userContent += `\n\n${HOMEINO_RETRY_HINT}`;
      const raw = await engineChat(
        [
          { role: "system", content: HOMEINO_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
        { temperature: 0.2 },
      );
      const parsed = extractJsonPayload(raw);
      if (parsed === null) throw new Error("llm_no_json");
      const problems = validateIntentPayload(parsed);
      if (problems.length > 0) throw new Error(`llm_invalid_schema:${problems.join(",")}`);
      return normalizeIntentAnalysis(parsed, req);
    },
    {
      attempts: 3,
      shouldRetry: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        return /llm_no_json|llm_invalid_schema/.test(msg);
      },
      delayMs: (attempt) => 300 * (attempt + 1),
    },
  );

  if (!result.ok) {
    const err = result.error;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "llm_no_json" || msg.startsWith("llm_invalid_schema")) {
      const fb = heuristicUnderstandIntent(req);
      return { ...fb, confidence: Math.min(fb.confidence, 0.55), ambiguous: true, note: "مدل خارجی پاسخ نامعتبر داد — از موتور داخلی استفاده شد." };
    }
    throw err;
  }
  return result.value as IntentAnalysis;
}

export const zaiLlmProvider: LlmProvider = {
  name: "zai-engine",
  async understandIntent(req) {
    if (!isZEngineConfigured()) throw new Error("llm_not_configured");
    return callEngine(req);
  },
};

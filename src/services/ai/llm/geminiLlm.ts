// ============================================================
// Gemini LLM Provider (SERVER-ONLY) — تحلیل قصد/متن از گوگل.
// همان قرارداد openaiCompatLlm را رعایت می‌کند:
//   JSON کوچک و ساخت‌یافته · bounded retry (حداکثر ۳) · اعتبارسنجی
//   سختِ پاسخ + normalize با درخت scope.ts
// کلید از resolveGeminiConfig() می‌آید (پنل ادمین > env).
// ============================================================
import type { IntentRequest, IntentAnalysis, LlmProvider } from "./types";
import { heuristicUnderstandIntent } from "./heuristicLlm";
import { extractJsonPayload, validateIntentPayload, withBoundedRetry } from "../validation";
import { normalizeIntentAnalysis } from "./openaiCompatLlm";
import { HOMEINO_SYSTEM_PROMPT, HOMEINO_RETRY_HINT } from "./systemPrompt";
import { resolveGeminiConfig } from "../settings";

const API = "https://generativelanguage.googleapis.com/v1beta/models";

export const isGeminiLlmConfigured = async (): Promise<boolean> =>
  Boolean((await resolveGeminiConfig()).apiKey);

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

async function callGemini(req: IntentRequest): Promise<IntentAnalysis> {
  const cfg = await resolveGeminiConfig();
  if (!cfg.apiKey) throw new Error("gemini_llm_not_configured");

  const result = await withBoundedRetry(
    async (attempt) => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12_000);
      try {
        let userContent = buildUserMessage(req);
        if (attempt > 0) userContent += `\n\n${HOMEINO_RETRY_HINT}`;
        const res = await fetch(`${API}/${cfg.textModel}:generateContent?key=${cfg.apiKey}`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: HOMEINO_SYSTEM_PROMPT }] },
            contents: [{ role: "user", parts: [{ text: userContent }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: 512, responseMimeType: "application/json" },
          }),
        });
        if (!res.ok) throw new Error(`llm_http_${res.status}`);
        const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
        const raw = (data?.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
        const parsed = extractJsonPayload(raw);
        if (parsed === null) throw new Error("llm_no_json");
        const problems = validateIntentPayload(parsed);
        if (problems.length > 0) throw new Error(`llm_invalid_schema:${problems.join(",")}`);
        return normalizeIntentAnalysis(parsed, req);
      } finally {
        clearTimeout(timeout);
      }
    },
    {
      attempts: 3,
      shouldRetry: (err) => {
        const msg = err instanceof Error ? err.message : String(err);
        const name = (err as { name?: string })?.name;
        return /llm_no_json|llm_invalid_schema/.test(msg) || /llm_http_5\d\d/.test(msg) || name === "AbortError";
      },
      delayMs: (attempt) => 300 * (attempt + 1),
    },
  );

  if (!result.ok) {
    const msg = result.error instanceof Error ? result.error.message : String(result.error);
    if (msg === "llm_no_json" || msg.startsWith("llm_invalid_schema")) {
      const fb = heuristicUnderstandIntent(req);
      return { ...fb, confidence: Math.min(fb.confidence, 0.55), ambiguous: true, note: "مدل گوگل پاسخ نامعتبر داد — از موتور داخلی استفاده شد." };
    }
    throw result.error;
  }
  return result.value as IntentAnalysis;
}

export const geminiLlmProvider: LlmProvider = {
  name: "gemini",
  async understandIntent(req) {
    if (!(await isGeminiLlmConfigured())) throw new Error("gemini_llm_not_configured");
    return callGemini(req);
  },
};

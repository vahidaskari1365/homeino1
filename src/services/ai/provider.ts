// ============================================================
// Provider Resolver (SERVER-ONLY).
// Single place that decides WHICH AiProvider serves a request.
// Resolution order:
//   1. Gemini        → when GEMINI_API_KEY is set        (best quality)
//   2. Z-Image engine→ when engine env/file config exists (self-host GLM)
//   3. OpenAI-compat → when LLM_API_BASE_URL + LLM_API_KEY are set
//                      (chat-only; same env style as llm/openaiCompatLlm)
//   4. FreeLLMAPI    → when FREELLMAPI_API_KEY + URL set (optional, isolated)
//   5. Mock          → always available (default)
//
// Plus a KEYLESS free tier for generation only: Pollinations
// (pollinationsProvider). The /api/ai gateway inserts it BEFORE
// the mock when a generate action fails upstream — guests always
// get a real AI image, edits stay honest (no fake edits).
//
// Providers are imported dynamically so the client bundle never ships
// server-only code or keys. The UI never knows which one is active.
// ============================================================
import type { AiProvider } from "./types";
import { mockAiProvider } from "./mockAiService";
import { isOpenAiCompatConfigured } from "./llm/openaiCompatLlm";
import { isZEngineConfigured } from "./engineConfig";

export type ProviderName = "mock" | "gemini" | "zai" | "freellmapi" | "openai-chat";
export interface ResolvedProvider { provider: AiProvider; name: ProviderName }

export async function resolveProvider(): Promise<ResolvedProvider> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const m = await import("./geminiProvider");
      return { provider: m.geminiProvider, name: "gemini" };
    } catch { /* fall through */ }
  }
  if (isZEngineConfigured()) {
    try {
      const m = await import("./zaiProvider");
      return { provider: m.zaiProvider, name: "zai" };
    } catch { /* fall through */ }
  }
  if (isOpenAiCompatConfigured()) {
    try {
      const m = await import("./openaiChatProvider");
      return { provider: m.openAiChatProvider, name: "openai-chat" };
    } catch { /* fall through */ }
  }
  if (process.env.FREELLMAPI_API_KEY && process.env.FREELLMAPI_BASE_URL) {
    try {
      const m = await import("./freellmapi");
      return { provider: m.freellmapiProvider, name: "freellmapi" };
    } catch { /* fall through */ }
  }
  return { provider: mockAiProvider, name: "mock" };
}

/** Keyless generation fallback (never resolves as the primary provider). */
export async function resolveFreeGenerationFallback(): Promise<AiProvider | null> {
  try {
    const m = await import("./pollinationsProvider");
    return m.pollinationsProvider;
  } catch {
    return null;
  }
}

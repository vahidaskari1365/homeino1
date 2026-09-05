// ============================================================
// Provider Resolver (SERVER-ONLY).
// Single place that decides WHICH AiProvider serves a request.
// Resolution order:
//   1. Gemini        → when GEMINI_API_KEY is set        (the planned provider)
//   2. OpenAI-compat → when LLM_API_BASE_URL + LLM_API_KEY are set
//                      (chat-only; same env style as llm/openaiCompatLlm)
//   3. FreeLLMAPI    → when FREELLMAPI_API_KEY + URL set (optional, isolated)
//   4. Mock          → always available (default)
// Providers are imported dynamically so the client bundle never ships
// server-only code or keys. The UI never knows which one is active.
// ============================================================
import type { AiProvider } from "./types";
import { mockAiProvider } from "./mockAiService";
import { isOpenAiCompatConfigured } from "./llm/openaiCompatLlm";

export type ProviderName = "mock" | "gemini" | "freellmapi" | "openai-chat";
export interface ResolvedProvider { provider: AiProvider; name: ProviderName }

export async function resolveProvider(): Promise<ResolvedProvider> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const m = await import("./geminiProvider");
      return { provider: m.geminiProvider, name: "gemini" };
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

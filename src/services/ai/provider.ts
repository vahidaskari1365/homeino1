// ============================================================
// Provider Resolver (SERVER-ONLY).
// Single place that decides WHICH AiProvider serves a request.
// Resolution order:
//   1. Gemini   → when GEMINI_API_KEY is set        (the planned provider)
//   2. FreeLLMAPI → when FREELLMAPI_API_KEY + URL set (optional, isolated)
//   3. Mock     → always available (default)
// Providers are imported dynamically so the client bundle never ships
// server-only code or keys. The UI never knows which one is active.
// ============================================================
import type { AiProvider } from "./types";
import { mockAiProvider } from "./mockAiService";

export type ProviderName = "mock" | "gemini" | "freellmapi";
export interface ResolvedProvider { provider: AiProvider; name: ProviderName }

export async function resolveProvider(): Promise<ResolvedProvider> {
  if (process.env.GEMINI_API_KEY) {
    try {
      const m = await import("./geminiProvider");
      return { provider: m.geminiProvider, name: "gemini" };
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

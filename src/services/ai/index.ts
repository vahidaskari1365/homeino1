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
import { AI_MODES } from "./types";
import { CREDIT_CONFIG, costForMode } from "./credits";

export type { AiProvider, GenerateDesignInput, GeneratedDesign, ChatReplyInput, ChatReply, DecorSuggestion, RoomAnalysis, RecommendedProduct } from "./types";
export { AI_MODES, CREDIT_CONFIG, costForMode };

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
};

// type re-export for convenience (unused import suppression)
export type { AiProvider as _AiProvider } from "./types";

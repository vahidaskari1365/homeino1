// ============================================================
// Pollinations Provider (SERVER-ONLY) — keyless FREE tier.
//
// Image GENERATION works anonymously (live-tested, model: sana).
// Image EDITING is behind the paid tier on Pollinations now, so
// edit/inpaint throw IMAGE_UNAVAILABLE and the caller falls
// through to a real edit engine or the honest mock. Text/chat
// is also paid on Pollinations → not implemented here.
//
// Role in the chain: guarantees guests always see a REAL AI
// image for "طراحی از متن" even with zero keys configured.
// ============================================================
import type { AiProvider, GenerateDesignInput, GeneratedDesign } from "./types";
import { uid } from "../../lib/utils";
import { pollinationsImage } from "./pollinations";
import { toEngineEnglish } from "./engineTranslate";

const ERR = "IMAGE_UNAVAILABLE";

export const pollinationsProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    // Task 41 — the free sana engine reads English only: raw Persian
    // prompts yielded loose, wrong-room renders («نشیمن» → bedroom).
    // Translate every Persian-capable field first — English fast-paths
    // through unchanged (no LLM call) and translations are cached.
    const [prompt, style, room, color, mood] = await Promise.all([
      toEngineEnglish(input.prompt ?? ""),
      toEngineEnglish(input.style ?? ""),
      toEngineEnglish(input.room ?? ""),
      toEngineEnglish(input.color ?? ""),
      toEngineEnglish(input.mood ?? ""),
    ]);
    const full = [
      prompt,
      style && `Decor style: ${style}`,
      room && `Room type: ${room}`,
      color && `Color palette: ${color}`,
      mood && `Mood: ${mood}`,
      "Professional interior design photograph, editorial quality, natural soft lighting, realistic materials, high detail, warm and inviting atmosphere.",
    ].filter(Boolean).join(". ");
    const out = await pollinationsImage(full, { width: 1152, height: 864 });
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage: out.dataUrl,
      creditsUsed: 0, // free tier — honest zero
      products: [],
    };
  },

  async editImage(): Promise<GeneratedDesign> { throw new Error(ERR); },
  async inpaint(): Promise<GeneratedDesign> { throw new Error(ERR); },
  async chat() { throw new Error("CHAT_UNAVAILABLE"); },

  async suggestDecor() { throw new Error("SUGGEST_UNAVAILABLE"); },
  async analyzeRoom() { throw new Error("ANALYZE_UNAVAILABLE"); },
  async recommendProducts() { throw new Error("RECOMMEND_UNAVAILABLE"); },
};

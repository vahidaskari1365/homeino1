// ============================================================
// ZAI Provider (SERVER-ONLY) — the self-hosted GLM/Z-Image engine.
//
// Activates when the engine is reachable via env vars OR a
// `.z-ai-config` file (sandbox / self-hosted deployments):
//   • chat / suggest / analyze → OpenAI-compatible /chat/completions (GLM)
//   • image generation         → /images/generations
//   • image EDIT (the «مبل عوض شه» flow)
//                              → /images/generations/edit (LIVE-TESTED:
//                                preserves the room, changes only the ask)
// Edits go through the same adapter the pipeline uses
// (oraliClient.generateEdit) so prompts stay consistent.
// ============================================================
import type {
  AiProvider, GenerateDesignInput, GeneratedDesign,
  ChatReply, ChatReplyInput, DecorSuggestion, RoomAnalysis,
} from "./types";
import { uid } from "../../lib/utils";
import { engineChat, engineGenerate } from "./orali/oraliClient";
import { oraliClient } from "./orali/oraliClient";
import { isZEngineFileConfigured } from "./engineConfig";

const PERSIAN_ASSISTANT =
  "تو دستیار هوشمند دکوراسیون Homeino هستی. فقط درباره‌ی خانه، مبلمان، رنگ، چیدمان و خرید راهنمایی کن. کوتاه، مهربان و حرفه‌ای به فارسی پاسخ بده.";

function designPrompt(input: GenerateDesignInput): string {
  return [
    input.prompt,
    input.style && `Decor style: ${input.style}`,
    input.room && `Room type: ${input.room}`,
    input.color && `Color palette: ${input.color}`,
    input.mood && `Mood: ${input.mood}`,
    "Professional interior design photograph, editorial quality, natural soft lighting, realistic materials, 4k, high detail.",
  ].filter(Boolean).join("\n");
}

async function jsonViaChat<T>(system: string, user: string, fallback: T): Promise<T> {
  try {
    const raw = await engineChat([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return JSON.parse(raw.match(/\{[\s\S]*\}|\[[\s\S]*\]/)?.[0] ?? "") as T;
  } catch {
    return fallback;
  }
}

export const zaiProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    const afterImage = await engineGenerate(designPrompt(input));
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage,
      creditsUsed: 5,
      products: [],
    };
  },

  async editImage(input: GenerateDesignInput): Promise<GeneratedDesign> {
    // Real edit through the proven adapter — room preserved, target changed.
    const out = await oraliClient.generateEdit({
      image: input.referenceImage ?? "",
      instruction: input.prompt || designPrompt(input),
      preserveArchitecture: true,
      style: input.style,
      colors: input.color ? [input.color] : undefined,
    });
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage: out.image,
      creditsUsed: 3,
      products: [],
    };
  },

  async inpaint(input: GenerateDesignInput): Promise<GeneratedDesign> {
    return this.editImage(input); // the engine edits only what the prompt names
  },

  async chat({ message, context, history }: ChatReplyInput): Promise<ChatReply> {
    const system = context
      ? `${PERSIAN_ASSISTANT} کاربر الان در این صفحه هست: ${context}`
      : PERSIAN_ASSISTANT;
    const messages = [
      { role: "system" as const, content: system },
      ...(history ?? []).slice(-8).map((h) => ({ role: h.role, content: h.content.slice(0, 400) })),
      { role: "user" as const, content: message },
    ];
    const content = await engineChat(messages);
    return { content: content || "متأسفم، الان نمی‌تونم پاسخ بدم. دوباره تلاش کن." };
  },

  async suggestDecor({ room, style }): Promise<DecorSuggestion> {
    const fallback = {
      color: "پالت خاکی گرم",
      furniture: ["کاناپه کرم", "میز چوب بلوط", "صندلی مخمل"],
      lighting: "چراغ رومیزی با نور گرم",
      rug: "قالیچه دست‌بافت",
      accessories: ["گلدان سرامیکی", "ست کوسن", "تابلو خطی"],
      layout: `چیدمان باز مناسب ${room} به سبک ${style}`,
    };
    return jsonViaChat<DecorSuggestion>(
      "You are an interior designer. Reply ONLY with compact JSON: {color, furniture[], lighting, rug, accessories[], layout}. Use Persian values.",
      `Design suggestion for a ${room} in ${style} style.`,
      fallback,
    );
  },

  async analyzeRoom(input): Promise<RoomAnalysis> {
    const system =
      "You are an interior designer. Reply ONLY compact JSON with keys: roomType, style, likelyStyle({style, confidence}), palette[], mood, strengths[], opportunities[], suggestions[], guidedSuggestions([{id, title, desc, impact, creditCost, category}]), architecture, lighting, emptySpaces[], functionalIssues[], designOpportunities[]. Persian values for Persian text, English for IDs.";
    const base = await jsonViaChat<Partial<RoomAnalysis>>(
      system,
      `Analyze this room context: ${input.room ?? ""} ${input.style ?? ""}. ${input.prompt ?? ""}`,
      {},
    );
    const { mockAiProvider } = await import("./mockAiService");
    const baseMock = await mockAiProvider.analyzeRoom(input);
    return { ...baseMock, ...base, guidedSuggestions: base.guidedSuggestions ?? baseMock.guidedSuggestions };
  },

  async recommendProducts(): Promise<{ productId: string; reason: string; score: number }[]> {
    const list = await jsonViaChat<{ productId: string; reason: string; score: number }[]>(
      "Reply ONLY a compact JSON array [{productId, reason, score}] using real ids p1..p39.",
      "Recommend 4 products for a modern living room.",
      [],
    );
    if (Array.isArray(list) && list.length) return list.slice(0, 5);
    const { mockAiProvider } = await import("./mockAiService");
    return mockAiProvider.recommendProducts({ mode: "room-redesign", prompt: "modern living room" });
  },
};

export { isZEngineFileConfigured };

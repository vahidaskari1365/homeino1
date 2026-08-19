// ============================================================
// Gemini Provider (SERVER-ONLY) — Gemini-ready slot.
// Activates only when GEMINI_API_KEY is set (see provider.ts).
//   • reasoning / chat / suggest → Gemini text model
//   • image edit / generate / inpaint → Gemini image model
//     (e.g. gemini-2.5-flash-image / "Nano Banana") which preserves
//     the source image; degrades gracefully on any failure.
// Keys NEVER reach the client. No FLUX / Veo / other models here.
// ============================================================
import type { AiProvider, GenerateDesignInput, GeneratedDesign, DecorSuggestion } from "./types";
import { uid } from "@/lib/utils";

const key = () => process.env.GEMINI_API_KEY;
const TEXT_MODEL = () => process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const IMAGE_MODEL = () => process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

const API = `https://generativelanguage.googleapis.com/v1beta/models`;

function buildPrompt(input: GenerateDesignInput): string {
  return [
    input.prompt,
    input.style && `Decor style: ${input.style}`,
    input.room && `Room: ${input.room}`,
    input.color && `Color palette: ${input.color}`,
    input.mood && `Mood: ${input.mood}`,
    "Professional interior design photograph, realistic, natural lighting, high detail.",
  ].filter(Boolean).join("\n");
}

async function geminiText(system: string, user: string): Promise<string> {
  const res = await fetch(`${API}/${TEXT_MODEL()}:generateContent?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
    }),
  });
  if (!res.ok) throw new Error("gemini_text_failed");
  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
}

async function geminiImage(input: GenerateDesignInput): Promise<GeneratedDesign> {
  const parts: Record<string, unknown>[] = [{ text: buildPrompt(input) }];
  if (input.referenceImage) {
    const b64 = input.referenceImage.replace(/^data:image\/\w+;base64,/, "");
    parts.push({ inline_data: { mime_type: "image/jpeg", data: b64 } });
  }
  const res = await fetch(`${API}/${IMAGE_MODEL()}:generateContent?key=${key()}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });
  if (!res.ok) throw new Error("gemini_image_failed");
  const data = await res.json();
  const imgPart = (data?.candidates?.[0]?.content?.parts ?? []).find(
    (p: { inline_data?: { data?: string } }) => p.inline_data?.data
  );
  if (!imgPart) throw new Error("no_image");
  return {
    id: uid(),
    beforeImage: input.referenceImage,
    afterImage: `data:image/png;base64,${imgPart.inline_data.data}`,
    creditsUsed: 5,
    products: [],
  };
}

function fallbackSuggest(room: string, style: string): DecorSuggestion {
  return {
    color: "پالت خاکی گرم",
    furniture: ["کاناپه کرم", "میز چوب بلوط", "صندلی مخمل"],
    lighting: "چراغ رومیزی با نور گرم",
    rug: "قالیچه دست‌بافت",
    accessories: ["گلدان سرامیکی", "ست کوسن", "تابلو خطی"],
    layout: `چیدمان باز مناسب ${room} به سبک ${style}`,
  };
}

export const geminiProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    try { return await geminiImage(input); }
    catch { return { id: uid(), beforeImage: input.referenceImage, afterImage: input.referenceImage ?? "", creditsUsed: 5, products: [] }; }
  },
  async editImage(input: GenerateDesignInput): Promise<GeneratedDesign> { return this.generateDesign(input); },
  async inpaint(input: GenerateDesignInput): Promise<GeneratedDesign> { return this.generateDesign(input); },
  async chat({ message, context }) {
    const system = context
      ? `تو دستیار هوشمند دکوراسیون Homeino هستی. فقط درباره‌ی خانه، مبلمان، رنگ، چیدمان و خرید راهنمایی کن. کوتاه، مهربان و حرفه‌ای به فارسی پاسخ بده. کاربر الان در این صفحه هست: ${context}`
      : "تو دستیار هوشمند دکوراسیون Homeino هستی. فقط درباره‌ی خانه، مبلمان، رنگ، چیدمان و خرید راهنمایی کن. کوتاه، مهربان و حرفه‌ای به فارسی پاسخ بده.";
    const content = await geminiText(system, message);
    return { content: content || "متأسفم، الان نمی‌تونم پاسخ بدم." };
  },
  async suggestDecor({ room, style }): Promise<DecorSuggestion> {
    const raw = await geminiText(
      "You are an interior designer. Reply ONLY with compact JSON: {color, furniture[], lighting, rug, accessories[], layout}. Use Persian values.",
      `Design suggestion for a ${room} in ${style} style.`
    );
    try { return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); }
    catch { return fallbackSuggest(room, style); }
  },
  async analyzeRoom(input) {
    const raw = await geminiText(
      "You are an interior designer. Reply ONLY compact JSON {roomType, style, palette[], mood, suggestions[]}. Persian values.",
      `Analyze this room: ${input.room ?? ""} ${input.style ?? ""}.`
    );
    try { return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); }
    catch { return { roomType: input.room || "پذیرایی", style: input.style || "مدرن", palette: ["#F0E8D8", "#1E5D44", "#BE9A4F"], mood: "گرم و دنج", suggestions: [] }; }
  },
  async understandIntent(input: unknown) {
    const { localUnderstand } = await import("./llm");
    const p = (input ?? {}) as { prompt?: string; style?: string; roomType?: string; colors?: string[]; keep?: string; change?: string };
    const raw = await geminiText(
      "Reply ONLY compact JSON: {intent,target[],changes[],preservedElements[],style,colors[],confidence,scope}. No prose. Local edits unless user asks to restyle the whole room.",
      JSON.stringify(p),
    );
    try { return JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}"); }
    catch { return localUnderstand({ prompt: p.prompt || "", style: p.style, roomType: p.roomType, colors: p.colors, keep: p.keep, change: p.change }); }
  },
  async oraliGenerate(input: unknown) {
    const p = (input ?? {}) as { originalImage?: string };
    try {
      const img = await geminiImage({ mode: "image-edit", prompt: "Apply scoped interior edit. Preserve architecture.", referenceImage: p.originalImage });
      return { generatedImage: img.afterImage, preview: false, overlay: { version: 1, regions: [], preservedArchitecture: true, provider: "orali" } };
    } catch {
      return { generatedImage: p.originalImage, preview: true, overlay: { version: 1, regions: [], preservedArchitecture: true, provider: "mock" } };
    }
  },
  async recommendProducts() {
    const raw = await geminiText(
      "Reply ONLY a compact JSON array [{productId, reason, score}] using real ids p1..p39.",
      "Recommend 4 products for a modern living room."
    );
    try { return JSON.parse(raw.match(/\[[\s\S]*\]/)?.[0] ?? "[]"); }
    catch { return [{ productId: "p1", reason: "پیشنهاد هوشمند", score: 0.9 }]; }
  },
};

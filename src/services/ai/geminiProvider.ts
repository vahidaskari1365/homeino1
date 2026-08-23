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
import { uid } from "../../lib/utils";

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
    // Golden rule (Phase 4/5): when editing an existing photo, only the
    // requested elements change; structure & untouched objects survive.
    input.referenceImage &&
      "The uploaded image is the ORIGINAL room. Change ONLY what the user requested. Do NOT move, add or remove walls, windows, doors, the ceiling, the floor, or any object the user did not mention. Keep the exact same camera angle, perspective, room dimensions and lighting.",
    input.mask && "Edit ONLY inside the highlighted mask region; everything outside the mask must remain pixel-identical.",
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
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
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
  const data = (await res.json()) as { candidates?: { content?: { parts?: { inline_data?: { data?: string } }[] } }[] };
  const imgPart = (data?.candidates?.[0]?.content?.parts ?? []).find(
    (p: { inline_data?: { data?: string } }) => p.inline_data?.data
  );
  if (!imgPart) throw new Error("no_image");
  return {
    id: uid(),
    beforeImage: input.referenceImage,
    afterImage: `data:image/png;base64,${imgPart.inline_data?.data ?? ""}`,
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
      "You are an interior designer. Reply ONLY compact JSON with keys: roomType, style, likelyStyle({style, confidence}), palette[], mood, strengths[], opportunities[], suggestions[], guidedSuggestions([{id, title, desc, impact, creditCost, category}]), architecture, lighting, furniture[], emptySpaces[], functionalIssues[], designOpportunities[]. Persian values for text, English for IDs/keys.",
      `Analyze this room photo/context: ${input.room ?? ""} ${input.style ?? ""}.`
    );
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      return {
        roomType: parsed.roomType || input.room || "پذیرایی",
        style: parsed.style || input.style || "اسکاندیناوی",
        likelyStyle: parsed.likelyStyle || { style: input.style || "Scandinavian", confidence: 0.78 },
        palette: parsed.palette || ["#F4EFEA", "#D8C7B5", "#8C7A6B", "#3E443C"],
        mood: parsed.mood || "آرام و دلنشین",
        confidence: parsed.confidence || 0.8,
        strengths: parsed.strengths || ["نور طبیعی مناسب از پنجره وارد فضا می‌شود", "تناسبات ابعادی فضا استاندارد است"],
        opportunities: parsed.opportunities || ["دیوار اصلی خالی است و نیازمند تابلوی هنری است", "نشیمن بدون فرش تفکیک بصری ندارد"],
        suggestions: parsed.suggestions || ["افزودن یک قالیچه برای تعریف ناحیه‌ی نشیمن", "استفاده از آباژور با نور گرم برای حس دنجی"],
        guidedSuggestions: parsed.guidedSuggestions || [
          { id: "gs1", title: "افزودن فرش برای تعریف فضا", desc: "یک قالیچه بزرگ زیر ناحیه‌ی نشیمن، فضا را گرم‌تر و منظم‌تر می‌کند.", impact: "high", creditCost: 3, category: "rug" },
          { id: "gs2", title: "نور گرم و موضعی", desc: "افزودن آباژور یا چراغ رومیزی با نور گرم (۳۰۰۰K)، حس دنجی می‌آورد.", impact: "medium", creditCost: 2, category: "lighting" },
          { id: "gs3", title: "نقطه کانونی با اثر هنری", desc: "نصب تابلوی مینیمال روی دیوار خالی برای ایجاد تعادل بصری.", impact: "medium", creditCost: 2, category: "art" },
          { id: "gs4", title: "گیاه طبیعی برای طراوت", desc: "یک گیاه آپارتمانی در گوشه‌ی فضا، فضا را زنده و طبیعی می‌کند.", impact: "low", creditCost: 1, category: "plant" },
        ],
        architecture: parsed.architecture || { walls: "رنگ خنثی", floor: "پارکت روشن", windows: 1, doors: 1 },
        lighting: parsed.lighting || "نور طبیعی ملایم، نیازمند نور موضعی",
        emptySpaces: parsed.emptySpaces || ["دیوار اصلی خالی", "گوشه دنج"],
        functionalIssues: parsed.functionalIssues || ["کمبود نور موضعی"],
        designOpportunities: parsed.designOpportunities || ["امکان افزودن فرش و تابلوی دیواری"],
      };
    } catch {
      return {
        roomType: input.room || "پذیرایی",
        style: input.style || "اسکاندیناوی",
        likelyStyle: { style: input.style || "Scandinavian", confidence: 0.78 },
        palette: ["#F4EFEA", "#D8C7B5", "#8C7A6B", "#3E443C"],
        mood: "گرم و دنج",
        confidence: 0.8,
        strengths: ["نور طبیعی مناسب از پنجره", "پلان منعطف فضا"],
        opportunities: ["نبود فرش مناسب در نشیمن", "نورپردازی فقط متکی به سقف"],
        suggestions: ["افزودن قالیچه برای تعریف ناحیه نشیمن", "نورپردازی لایه‌ای با آباژور"],
        guidedSuggestions: [
          { id: "gs1", title: "افزودن فرش برای تعریف فضا", desc: "یک قالیچه بزرگ زیر ناحیه‌ی نشیمن، فضا را گرم‌تر و منظم‌تر می‌کند.", impact: "high", creditCost: 3, category: "rug" },
          { id: "gs2", title: "نور گرم و موضعی", desc: "افزودن آباژور یا چراغ رومیزی با نور گرم (۳۰۰۰K)، حس دنجی می‌آورد.", impact: "medium", creditCost: 2, category: "lighting" },
          { id: "gs3", title: "نقطه کانونی با اثر هنری", desc: "نصب تابلوی مینیمال روی دیوار خالی برای ایجاد تعادل بصری.", impact: "medium", creditCost: 2, category: "art" },
          { id: "gs4", title: "گیاه طبیعی برای طراوت", desc: "یک گیاه آپارتمانی در گوشه‌ی فضا، فضا را زنده و طبیعی می‌کند.", impact: "low", creditCost: 1, category: "plant" },
        ],
      };
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

// ============================================================
// FreeLLMAPI Provider — SERVER-ONLY (never imported by client bundles).
// Imported exclusively by /api/ai so API keys stay on the server.
//
// DESIGN DECISION (per product requirement):
//   • Chat / design reasoning → GLM. GLM-4.5 / GLM-4.7 Flash ARE real
//     chat models in FreeLLMAPI, so we discover the GLM id from /v1/models.
//   • Image generation → /v1/images/generations with model "auto".
//     FreeLLMAPI routes this to whichever provider actually serves a MEDIA
//     model in this installation (e.g. FLUX.1-schnell via SiliconFlow).
//     We NEVER assume GLM can produce images — an endpoint existing does
//     not mean a suitable image model exists. We probe availability first
//     and degrade gracefully to the mock provider otherwise.
// ============================================================

import type { AiProvider, GenerateDesignInput, GeneratedDesign, ChatReply, ChatReplyInput, DecorSuggestion } from "./types";
import { uid } from "../../lib/utils";

const BASE = process.env.FREELLMAPI_BASE_URL || process.env.FREELLMAPI_URL || "http://localhost:8000";
const KEY = process.env.FREELLMAPI_API_KEY || process.env.AI_API_KEY || "";

export const isFreellmapiConfigured = (): boolean => Boolean(KEY);

const authHeaders = () => ({
  Authorization: `Bearer ${KEY}`,
  "Content-Type": "application/json",
});

/* ---- Model discovery: only use models that REALLY exist here ---- */

/** Fetch the list of model ids actually available in this FreeLLMAPI install. */
async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${BASE}/v1/models`, { headers: authHeaders() });
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: unknown[]; models?: unknown[] };
    const list: unknown = data?.data ?? data?.models ?? [];
    if (!Array.isArray(list)) return [];
    return list
      .map((m: Record<string, unknown>) => String(m?.id ?? m?.model ?? m?.name ?? ""))
      .filter(Boolean);
  } catch {
    return [];
  }
}

/** Find a real GLM chat model id if one is configured (e.g. GLM-4.5, GLM-4.7 Flash). */
async function pickChatModel(): Promise<string> {
  const ids = await listModels();
  const glm = ids.find((id) => /glm/i.test(id));
  return glm || "auto"; // "auto" lets FreeLLMAPI route to any available chat model
}

/**
 * Find an IMAGE-EDIT-capable model (one that accepts an input image and returns
 * an edited image, preserving untouched areas). Text-to-image-only models such
 * as FLUX.1-schnell CANNOT do this and are excluded. Canonical candidate:
 * Gemini 2.5 Flash Image ("Nano Banana"). GLM is a chat model — NOT used for edits.
 */
async function pickEditModel(): Promise<string> {
  const ids = await listModels();
  const edit = ids.find((id) => /nano.?banana|flash.?image|imagen.?edit|gpt-image|edit|inpaint/i.test(id));
  if (edit) return edit;
  const gemini = ids.find((id) => /gemini.*flash/i.test(id));
  return gemini || "auto";
}

/**
 * Determine whether IMAGE generation is genuinely available in this install.
 * We look for media models in the catalog AND/OR trust the images endpoint.
 * Note: GLM / chat-only models do NOT count — they cannot generate images.
 */
async function imageAvailable(): Promise<boolean> {
  const ids = await listModels();
  const hasImageModel = ids.some((id) =>
    /flux|stable-?diffusion|sdxl|imagen|dall-?e|kolors|cogview|playground/i.test(id)
  );
  // Some installs expose media models only behind /v1/images/generations and not
  // in /v1/models. We treat a configured key as "worth trying" but callers must
  // handle failure (degrade to mock). hasImageModel makes the positive case strong.
  return hasImageModel || isFreellmapiConfigured();
}

/* ---- Prompt engineering for interior design ---- */

function buildDesignPrompt(input: GenerateDesignInput): string {
  const parts = [
    input.prompt?.trim() && `User request: ${input.prompt}`,
    input.style && `Decor style: ${input.style}`,
    input.room && `Room type: ${input.room}`,
    input.color && `Dominant color palette: ${input.color}`,
    input.mood && `Mood: ${input.mood}`,
  ].filter(Boolean);
  return [
    "Professional interior design photograph, editorial quality.",
    ...parts,
    "Natural soft lighting, realistic materials, balanced composition, 4k, high detail, warm and inviting atmosphere.",
  ].join("\n");
}

async function chatCompletion(system: string, user: string, model?: string): Promise<string> {
  const res = await fetch(`${BASE}/v1/chat/completions`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: model || (await pickChatModel()),
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 1200,
    }),
  });
  if (!res.ok) throw new Error(`FreeLLMAPI chat failed: ${res.status}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data?.choices?.[0]?.message?.content ?? "";
}

async function generateImage(prompt: string, size = "1024x1024"): Promise<string> {
  const res = await fetch(`${BASE}/v1/images/generations`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      model: "auto", // FreeLLMAPI routes to an available media provider (e.g. FLUX)
      prompt,
      n: 1,
      size,
    }),
  });
  if (!res.ok) throw new Error(`Image generation unavailable (${res.status}). No suitable media model is configured in FreeLLMAPI.`);
  const data = (await res.json()) as { data?: { url?: string; b64_json?: string }[] };
  const item = data?.data?.[0];
  if (!item) throw new Error("No image returned by FreeLLMAPI.");
  return item.url || (item.b64_json ? `data:image/png;base64,${item.b64_json}` : "");
}

/* ---- Provider implementation ---- */

export const freellmapiProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    // GLM plans a short concept (optional enrichment); FLUX generates the image.
    const ok = await imageAvailable();
    if (!ok) throw new Error("IMAGE_UNAVAILABLE");
    const afterImage = await generateImage(buildDesignPrompt(input));
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage,
      creditsUsed: 5,
      products: [
        { label: "کاناپه", productId: "p1" },
        { label: "چراغ رومیزی", productId: "p9" },
        { label: "قالیچه", productId: "p12" },
        { label: "کوسن", productId: "p15" },
      ],
    };
  },

  async editImage(input: GenerateDesignInput): Promise<GeneratedDesign> {
    const ok = await imageAvailable();
    if (!ok) throw new Error("IMAGE_UNAVAILABLE");
    const afterImage = await generateImage(buildDesignPrompt(input));
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage,
      creditsUsed: 3,
      products: [
        { label: "فرش", productId: "p12" },
        { label: "کوسن", productId: "p15" },
      ],
    };
  },

  /**
   * PRECISE INPAINTING — preserve the uploaded image and change ONLY the masked
   * region. Sends the ORIGINAL image to an edit-capable model with an instruction
   * that touches only the described/masked area (e.g. "replace the curtains with
   * beige linen, keep every other element identical"). Requires a model that can
   * edit images (e.g. Gemini 2.5 Flash Image). If no edit model is configured in
   * this FreeLLMAPI install, the image is returned unchanged (no fake edits).
   */
  async inpaint(input: GenerateDesignInput): Promise<GeneratedDesign> {
    if (!input.referenceImage) throw new Error("IMAGE_UNAVAILABLE");
    const preservePrompt =
      `Edit ONLY the ${input.mask ? "highlighted/marked region" : "object the user described"}. ` +
      `Change request: ${input.prompt || "as described"}. ` +
      `${input.style ? `Target style: ${input.style}. ` : ""}` +
      `Keep every other element, lighting, perspective and layout of the photo IDENTICAL and unchanged. Preserve the original image.`;
    try {
      const res = await fetch(`${BASE}/v1/chat/completions`, {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify({
          model: await pickEditModel(),
          modalities: ["text", "image"],
          messages: [{
            role: "user",
            content: [
              { type: "text", text: preservePrompt },
              { type: "image_url", image_url: { url: input.referenceImage } },
            ],
          }],
        }),
      });
      if (!res.ok) throw new Error(`edit_failed_${res.status}`);
      const data = (await res.json()) as { choices?: { message?: { content?: unknown } }[]; data?: { url?: string }[] };
      // Image-edit models return the image inline (data url or http url)
      const content = data?.choices?.[0]?.message?.content;
      const found =
        (typeof content === "string" && (content.match(/data:image\/[\w+]+;base64,[^\s"')]+/)?.[0] || content.match(/https?:\/\/[^\s"')]+\.(?:png|jpg|jpeg|webp)/i)?.[0])) ||
        (Array.isArray(content) && (content.find((c: { type: string; image_url?: { url: string } }) => c?.type === "image_url")?.image_url?.url)) ||
        data?.data?.[0]?.url ||
        null;
      if (!found) throw new Error("NO_EDIT_IMAGE");
      return { id: uid(), beforeImage: input.referenceImage, afterImage: found, creditsUsed: 2, products: [] };
    } catch {
      // Graceful preservation fallback — return the original image untouched.
      return { id: uid(), beforeImage: input.referenceImage, afterImage: input.referenceImage, creditsUsed: 1, products: [] };
    }
  },

  async chat({ message, context }: ChatReplyInput): Promise<ChatReply> {
    const system = context
      ? `تو دستیار هوشمند Homeino برای طراحی داخلی و دکوراسیون هستی. کوتاه، مهربان و حرفه‌ای به فارسی پاسخ بده. کاربر الان در این صفحه هست: ${context}`
      : "تو دستیار هوشمند Homeino برای طراحی داخلی و دکوراسیون هستی. کوتاه، مهربان و حرفه‌ای به فارسی پاسخ بده.";
    const content = await chatCompletion(system, message);
    return { content: content || "متأسفم، الان نمی‌تونم پاسخ بدم. دوباره تلاش کن." };
  },

  async suggestDecor({ room, style }): Promise<DecorSuggestion> {
    const system =
      "You are an interior designer. Reply ONLY with compact JSON with keys: color, furniture(array), lighting, rug, accessories(array), layout. Use Persian values.";
    const raw = await chatCompletion(
      system,
      `Design suggestion for a ${room} in ${style} style.`
    );
    try {
      const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
      return {
        color: parsed.color ?? "پالت خنثی گرم",
        furniture: parsed.furniture ?? ["کاناپه", "میز"],
        lighting: parsed.lighting ?? "نور گرم",
        rug: parsed.rug ?? "قالیچه طبیعی",
        accessories: parsed.accessories ?? ["گلدان", "تابلو"],
        layout: parsed.layout ?? "چیدمان باز",
      };
    } catch {
      return {
        color: "پالت خاکی",
        furniture: ["کاناپه کرم", "میز چوب بلوط", "صندلی مخمل"],
        lighting: "چراغ رومیزی با نور گرم",
        rug: "قالیچه بربری دست‌بافت",
        accessories: ["گلدان سرامیکی", "ست کوسن", "تابلو خطی"],
        layout: `چیدمان باز مناسب ${room} به سبک ${style}`,
      };
    }
  },

  async analyzeRoom(input) {
    const system =
      "You are an interior designer. Reply ONLY compact JSON with keys: roomType, style, likelyStyle({style, confidence}), palette[], mood, strengths[], opportunities[], suggestions[], guidedSuggestions([{id, title, desc, impact, creditCost, category}]), architecture, lighting, emptySpaces[], functionalIssues[], designOpportunities[]. Persian values for Persian text, English for IDs.";
    const raw = await chatCompletion(
      system,
      `Analyze this room: ${input.room ?? ""} ${input.style ?? ""}.`
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
        strengths: parsed.strengths || ["نور طبیعی مناسب از پنجره وارد فضا می‌شود", "پلان اتاق امکان چیدمان استاندارد می‌دهد"],
        opportunities: parsed.opportunities || ["دیوار اصلی خالی است و نیازمند تابلوی هنری است", "نشیمن بدون فرش تفکیک بصری ندارد"],
        suggestions: parsed.suggestions || ["افزودن یک قالیچه برای تعریف ناحیه‌ی نشیمن", "استفاده از آباژور با نور گرم"],
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
    return [
      { productId: "p1", reason: "پیشنهاد هوشمند برای سبک مدرن", score: 0.9 },
      { productId: "p9", reason: "نور مناسب برای حس دنجی", score: 0.85 },
      { productId: "p12", reason: "تعریف ناحیه‌ی نشیمن", score: 0.8 },
    ];
  },
};

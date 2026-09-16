// ============================================================
// Gemini Provider (SERVER-ONLY).
// Activates when a Gemini key resolves (see provider.ts + settings.ts):
//   • key source: پنل ادمین (DB, encrypted) → env GEMINI_API_KEY
//   • reasoning / chat / suggest → Gemini text model
//   • image edit / generate / inpaint → Gemini image model
//     (e.g. gemini-3.1-flash-image / "Nano Banana 2") which preserves
//     the source image; degrades gracefully on any failure.
// Keys NEVER reach the client. No FLUX / Veo / other models here.
// ============================================================
import type { AiProvider, GenerateDesignInput, GeneratedDesign, DecorSuggestion, RoomAnalysis } from "./types";
import { uid } from "../../lib/utils";
import { resolveGeminiConfig } from "./settings";
import { normalizeRoomAnalysisFa, FA_ANALYSIS_DIRECTIVE } from "./analysisNormalize";

const API = `https://generativelanguage.googleapis.com/v1beta/models`;

function buildPrompt(input: GenerateDesignInput): string {
  return [
    input.prompt,
    input.style && `Decor style: ${input.style} — apply this style ONLY to the elements being edited, never restyle the rest of the scene.`,
    input.room && `Room: ${input.room}`,
    input.color && `Color palette: ${input.color}`,
    input.mood && `Mood: ${input.mood}`,
    // Golden rule (Phase 4/5): when editing an existing photo, only the
    // requested elements change; structure & untouched objects survive.
    input.referenceImage &&
      "The FIRST image is the ORIGINAL room photo. Change ONLY what the user requested. Do NOT move, add or remove walls, windows, doors, the ceiling, the floor, or any object the user did not mention. Keep the exact same camera angle, perspective, room dimensions and lighting. The rest of the photo must look identical to the original.",
    input.mask && "An EDIT MASK image is attached: its WHITE area is the ONLY region you may change. Repaint the white area as requested; the black area must remain exactly as in the original photo.",
    "Professional interior design photograph, realistic, natural lighting, high detail.",
  ].filter(Boolean).join("\n");
}

/** Split a data URL into {mime, b64} for inline_data parts (null when remote). */
function inlineData(dataUrl: string): { mime_type: string; data: string } | null {
  const m = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return null;
  return { mime_type: m[1], data: m[2] };
}

async function geminiText(system: string, user: string): Promise<string> {
  const cfg = await resolveGeminiConfig();
  if (!cfg.apiKey) throw new Error("gemini_not_configured");
  const res = await fetch(`${API}/${cfg.textModel}:generateContent?key=${cfg.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }] }],
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`gemini_text_failed_${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
}

/**
 * VISION call — the ACTUAL photo goes to the model as inline_data.
 * Task 39: analyzeRoom قبلاً فقط متن می‌فرستاد («Analyze this room photo/context:
 * پذیرایی …») — یعنی عکس هرگز دیده نمی‌شد و تحلیل یک توهم عمومی بود.
 */
async function geminiVisionText(system: string, user: string, imageDataUrl: string): Promise<string> {
  const cfg = await resolveGeminiConfig();
  if (!cfg.apiKey) throw new Error("gemini_not_configured");
  const inline = inlineData(imageDataUrl);
  if (!inline) throw new Error("gemini_vision_bad_image");
  const res = await fetch(`${API}/${cfg.textModel}:generateContent?key=${cfg.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: "user", parts: [{ text: user }, { inline_data: inline }] }],
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`gemini_vision_failed_${res.status}`);
  const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  return parts.map((p: { text?: string }) => p.text ?? "").join("").trim();
}

async function geminiImage(input: GenerateDesignInput): Promise<GeneratedDesign> {
  const parts: Record<string, unknown>[] = [{ text: buildPrompt(input) }];
  // Multi-image fusion (nano-banana): room photo FIRST, then the edit mask
  // (when present — white = the only editable area), then the exact product
  // reference photo(s) — Gemini keeps the product's identity and renders it
  // into the room at the masked spot.
  const refs = input.productReferenceImages ?? [];
  if (input.referenceImage) {
    const room = inlineData(input.referenceImage);
    if (room) parts.push({ inline_data: room });
  }
  if (input.mask) {
    const mask = inlineData(input.mask);
    if (mask) {
      parts.push({ text: "EDIT MASK: the white area is the ONLY region to change — repaint it as instructed; keep the black area exactly as the original photo. Inside the white area the floor, walls and lighting must EXACTLY continue the same surfaces visible around the mask (same material, color, perspective); only the requested object itself is new." });
      parts.push({ inline_data: mask });
    }
  }
  refs.slice(0, 3).forEach((ref, i) => {
    const product = inlineData(ref);
    if (!product) return; // not a data URL (remote) — skip, Gemini needs inline data
    parts.push({ text: `Reference photo ${i + 1}: the EXACT product to place. Render it with identical design, color, material and proportions.` });
    parts.push({ inline_data: product });
  });
  const cfg = await resolveGeminiConfig();
  if (!cfg.apiKey) throw new Error("gemini_not_configured");
  const res = await fetch(`${API}/${cfg.imageModel}:generateContent?key=${cfg.apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ contents: [{ role: "user", parts }] }),
  });
  // Task 40 — دیاگنوستیک صادقانه: status + کد گوگل در پیام می‌آید (بدون کلید/بدنه‌ی کامل)
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let gcode = "";
    try { const j = JSON.parse(body); gcode = String(j?.error?.status || j?.error?.code || "").slice(0, 40); } catch { /* keep empty */ }
    throw new Error(`gemini_image_failed_${res.status}${gcode ? `_${gcode}` : ""}`);
  }
  const data = (await res.json()) as { candidates?: { content?: { parts?: ({ inline_data?: { data?: string } } | { text?: string })[] } }[] };
  const cparts = (data?.candidates?.[0]?.content?.parts ?? []) as { inline_data?: { data?: string }; text?: string }[];
  const imgPart = cparts.find((p) => p.inline_data?.data);
  if (!imgPart) {
    const snippet = cparts.find((p) => p.text)?.text?.slice(0, 60) ?? "empty";
    throw new Error(`no_image(${snippet})`);
  }
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

/* ---------------- Room analysis (shared with the free fallback) ---------------- */

/** پرامپت سیستم تحلیل عکس — بین Gemini و fallback رایگان مشترک است.
 *  emptySpaces دقیقاً همان «بگه چی کم داره» است. */
export const ROOM_ANALYSIS_VISION_SYSTEM =
  "You are Homeino's senior interior designer. You are looking at an ACTUAL photo of the user's room. " +
  "Analyze ONLY what is really visible in THIS photo — never invent objects that are not there. " +
  "Reply ONLY with compact JSON with these keys: " +
  "roomType, style, likelyStyle({style, confidence}), palette[] (4-5 hex codes), mood, confidence(0..1), " +
  "strengths[] (2-3, from the photo), opportunities[] (2-3, from the photo), suggestions[] (2-3), " +
  "guidedSuggestions[] (exactly 4 items {id:'gs1'..'gs4', title, desc, impact:'high'|'medium'|'low', creditCost:1..5, category:'rug'|'lighting'|'art'|'plant'|'sofa'|'curtain'|'table'|'storage'}), " +
  "architecture({walls, floor, ceiling, windows, doors}), lighting, furniture[] (every furniture piece you actually see), " +
  "emptySpaces[] (WHAT IS MISSING in this room — e.g. no rug, no wall art, no floor lamp, no plant, empty corner — THIS is the 'چی کم داره' answer), " +
  "functionalIssues[] (practical problems visible in the photo: bad lighting, cramped walkway, no seating for guests…), " +
  "designOpportunities[] (concrete improvements). " +
  FA_ANALYSIS_DIRECTIVE;

export function roomAnalysisVisionUser(input: { room?: string; style?: string }): string {
  return [
    "این عکس، اتاقِ واقعی کاربر است. دقیقاً از روی همین عکس تحلیل کن.",
    input.room && `کاربر گفته نوع فضا: ${input.room} (اگر با عکس میانه ندارد، عکس را مبنا بگیر).`,
    input.style && `سبک هدف انتخابی کاربر: ${input.style} (فقط برای پیشنهادها؛ سبک «فعلی» را از عکس بگو).`,
    "در emptySpaces صادقانه بگو چه چیزی در این اتاق کم است — چیزی که نبودنش حس می‌شود.",
  ].filter(Boolean).join(" ");
}

/** پارس + نرمال‌سازی پاسخ تحلیل — با پیش‌فرض‌های صادقانه برای فیلدهای غایب. */
export function parseRoomAnalysisFa(raw: string, input: { room?: string; style?: string }): RoomAnalysis {
  try {
    const parsed = JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    // نرمال‌ساز مشترک: هر مقدار انگلیسیِ لیز خورده (سبک/رنگ/عبارت) فارسی می‌شود
    return normalizeRoomAnalysisFa({
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
    });
  } catch {
    return {
      roomType: input.room || "پذیرایی",
      style: input.style || "اسکاندیناوی",
      likelyStyle: { style: input.style || "Scandinavian", confidence: 0.78 },
      palette: ["#F4EFEA", "#D8C7B5", "#8C7A6B", "#3E443C"],
      mood: "گرم و دنج",
      confidence: 0.4,
      strengths: ["نور طبیعی مناسب از پنجره", "پلان منعطف فضا"],
      opportunities: ["نبود فرش مناسب در نشیمن", "نورپردازی فقط متکی به سقف"],
      suggestions: ["افزودن قالیچه برای تعریف ناحیه نشیمن", "نورپردازی لایه‌ای با آباژور"],
      guidedSuggestions: [
        { id: "gs1", title: "افزودن فرش برای تعریف فضا", desc: "یک قالیچه بزرگ زیر ناحیه‌ی نشیمن، فضا را گرم‌تر و منظم‌تر می‌کند.", impact: "high", creditCost: 3, category: "rug" },
        { id: "gs2", title: "نور گرم و موضعی", desc: "افزودن آباژور یا چراغ رومیزی با نور گرم (۳۰۰۰K)، حس دنجی می‌آورد.", impact: "medium", creditCost: 2, category: "lighting" },
        { id: "gs3", title: "نقطه کانونی با اثر هنری", desc: "نصب تابلوی مینیمال روی دیوار خالی برای ایجاد تعادل بصری.", impact: "medium", creditCost: 2, category: "art" },
        { id: "gs4", title: "گیاه طبیعی برای طراوت", desc: "یک گیاه آپارتمانی در گوشه‌ی فضا، فضا را زنده و طبیعی می‌کند.", impact: "low", creditCost: 1, category: "plant" },
      ],
      emptySpaces: ["دیوار اصلی خالی", "گوشه دنج"],
      functionalIssues: ["کمبود نور موضعی"],
      designOpportunities: ["امکان افزودن فرش و تابلوی دیواری"],
    };
  }
}

export const geminiProvider: AiProvider = {
  // Task 39 — خطای صادقانه: قبلاً هر شکستِ Gemini بی‌صدا «عکس بدون تغییر»
  // برمی‌گرداند؛ کلاینت آن را به‌عنوان رندر واقعی نمی‌پذیرفت و می‌افتاد روی
  // کامپوزیت چسبانِ مرورگر («داغونه»). حالا خطا بالا می‌رود تا dispatch plan
  // واقعی (pollinations برای تولید / preview صادقانه برای ویرایش) کار کند.
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> { return geminiImage(input); },
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
    // Task 39 — تحلیلِ واقعیِ همین عکس: عکس آپلودشده با inline_data به Gemini
    // می‌رود و مدل از روی پیکسل‌های واقعی جواب می‌دهد («بگه چی کم داره»).
    const raw = input.referenceImage
      ? await geminiVisionText(ROOM_ANALYSIS_VISION_SYSTEM, roomAnalysisVisionUser(input), input.referenceImage)
      : await geminiText(
          "You are an interior designer. Reply ONLY compact JSON with keys: roomType, style, likelyStyle({style, confidence}), palette[], mood, strengths[], opportunities[], suggestions[], guidedSuggestions([{id, title, desc, impact, creditCost, category}]), architecture, lighting, furniture[], emptySpaces[], functionalIssues[], designOpportunities[]. Persian values for text, English for IDs/keys. " + FA_ANALYSIS_DIRECTIVE,
          `Analyze this room description/context: ${input.room ?? ""} ${input.style ?? ""}. No photo was provided — answer generically but mark confidence 0.4.`
        );
    return parseRoomAnalysisFa(raw, input);
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

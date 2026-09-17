// ============================================================
// Cloudflare Worker Provider (SERVER-ONLY) — موتور رایگان
// github.com/saurav-z/free-image-generation-api (Stable Diffusion XL
// روی Workers AI کلاودفلر، تا ۱۰۰هزار درخواست/روز در فری‌تیر).
//
// فعال‌سازی (Task 42):
//   CF_IMG_WORKER_URL  → آدرس ورکر دیپلوی‌شده (https://…workers.dev)
//   CF_IMG_WORKER_KEY  → همان API_KEY که داخل ورکر ست شده (Bearer)
// تا وقتی این دو ست نباشند، این پرووایدر در زنجیره شرکت نمی‌کند.
//
// جایگاه در زنجیره: بعد از pollinations و قبل از mock — هر دو رایگان.
// ============================================================
import type { AiProvider, GenerateDesignInput, GeneratedDesign } from "./types";
import { uid } from "../../lib/utils";
import { toEngineEnglish } from "./engineTranslate";
import { buildGenerationPrompt } from "./domainGuard";

const ERR = "IMAGE_UNAVAILABLE";
const TIMEOUT_MS = 30_000;

async function cfWorkerImage(fullPrompt: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(process.env.CF_IMG_WORKER_URL as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.CF_IMG_WORKER_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt: fullPrompt }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (res.status === 401) throw new Error("CF_WORKER_AUTH");
    if (!res.ok) throw new Error(`CF_WORKER_HTTP_${res.status}`);
    const type = (res.headers.get("content-type") || "").split(";")[0];
    if (!type.startsWith("image/")) throw new Error("CF_WORKER_NOT_IMAGE");
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength < 1024) throw new Error("CF_WORKER_EMPTY");
    return `data:${type};base64,${buf.toString("base64")}`;
  } finally {
    clearTimeout(timer);
  }
}

export const cloudflareProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    // همان قاعده Task 41: فیلدهای فارسی اول ترجمه می‌شوند (رایگان/کش‌شده)
    // و پرامپت نهایی از گارد دامنه + وفاداری (domainGuard) می‌گذرد.
    const [prompt, style, room, color, mood] = await Promise.all([
      toEngineEnglish(input.prompt ?? ""),
      toEngineEnglish(input.style ?? ""),
      toEngineEnglish(input.room ?? ""),
      toEngineEnglish(input.color ?? ""),
      toEngineEnglish(input.mood ?? ""),
    ]);
    const full = buildGenerationPrompt({ prompt, style, room, color, mood });
    const dataUrl = await cfWorkerImage(full);
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage: dataUrl,
      creditsUsed: 0, // فری‌تیر ورکر — صفرِ صادقانه
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

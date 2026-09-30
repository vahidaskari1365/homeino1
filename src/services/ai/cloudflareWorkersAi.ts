// ============================================================
// Cloudflare Workers AI — direct REST provider (SERVER-ONLY).
//
// Task 73 — موتور رایگانِ سوم در زنجیرهٔ تولید عکس، مستقیم با REST
// رسمی Workers AI (بدون ورکر واسط — فرقش با cloudflareProvider همینه):
//
//   POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}
//        /ai/run/{model}
//   Authorization: Bearer {API_TOKEN}
//   {"prompt": "...", "num_steps": 4, "width": 1024, "height": 768}
//
// فری‌تیر Cloudflare: 10,000 neuron در روز، بدون کارت اعتباری
// (Awesome-free-llm-apis / Task 72). فلکس‌شنل ≈ ۵۰۰ neuron/عکس →
// ≈ ۲۰ عکس/روز. خروجی: بدون واترمارک، تا ۱۰۲۴px — تمیزتر از
// Pollinations ناشناس (واترمارک‌دارِ ۷۶۸px).
//
// فعال‌سازی (تا ست نشوند، پرووایدر در زنجیره شرکت نمی‌کند):
//   CLOUDFLARE_ACCOUNT_ID  → dash.cloudflare.com → Workers & Pages → account id
//   CLOUDFLARE_API_TOKEN   → توکن با پرمیشن Workers AI (Run)
//   CLOUDFLARE_AI_IMAGE_MODEL → اختیاری؛ پیش‌فرض flux-1-schnell
//
// جایگاه در زنجیره: بعد از pollinations و قبل از mock صادقانه.
// ویرایش/اینپینت ندارد → خطای صادقانه (مثل pollinationsProvider).
// ============================================================
import type { AiProvider, GenerateDesignInput, GeneratedDesign } from "./types";
import { uid } from "../../lib/utils";
import { toEngineEnglish } from "./engineTranslate";
import { buildGenerationPrompt } from "./domainGuard";

const ERR = "IMAGE_UNAVAILABLE";
const DEFAULT_MODEL = "@cf/black-forest-labs/flux-1-schnell";
const TIMEOUT_MS = 30_000;

export function isCfWorkersAiConfigured(): boolean {
  const id = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
  return /^[a-f0-9]{32}$/i.test(id) && token.length >= 20;
}

/** flux-1-schnell روی CF محدود به ۱۰۲۴px و مضرب ۸ است. */
function clampSize(w?: number, h?: number): { width: number; height: number } {
  const snap = (v: number) => Math.max(512, Math.min(1024, Math.round(v / 8) * 8));
  return { width: snap(w || 1024), height: snap(h || 768) };
}

interface CfRunOk {
  success: boolean;
  errors?: { message?: string }[];
  result?: { image?: string };
}

async function cfAiImage(fullPrompt: string, opts?: { width?: number; height?: number }): Promise<string> {
  const accountId = (process.env.CLOUDFLARE_ACCOUNT_ID || "").trim();
  const token = (process.env.CLOUDFLARE_API_TOKEN || "").trim();
  const model = (process.env.CLOUDFLARE_AI_IMAGE_MODEL || DEFAULT_MODEL).trim();
  const { width, height } = clampSize(opts?.width, opts?.height);

  let lastErr: unknown = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 900));
    try {
      const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: fullPrompt.slice(0, 1900), num_steps: 4, width, height }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      });
      if (res.status === 401 || res.status === 403) throw new Error("CF_AI_AUTH");
      if (res.status === 429) throw new Error("CF_AI_QUOTA");
      if (!res.ok) throw new Error(`CF_AI_HTTP_${res.status}`);

      // دو شکل پاسخ ممکن: JSON {result:{image:base64}} (مدل‌های flux)
      // یا بایت خام image/* (مدل‌های SDXL قدیمی‌تر).
      const type = (res.headers.get("content-type") || "").split(";")[0];
      if (type.startsWith("image/")) {
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.byteLength < 1_024) throw new Error("CF_AI_EMPTY");
        return `data:${type};base64,${buf.toString("base64")}`;
      }
      const body = (await res.json()) as CfRunOk;
      if (!body?.success || !body.result?.image) {
        const msg = body?.errors?.[0]?.message?.slice(0, 200) || "CF_AI_NO_IMAGE";
        throw new Error(msg);
      }
      const b64 = body.result.image;
      if (b64.length < 1_000) throw new Error("CF_AI_EMPTY");
      return `data:image/jpeg;base64,${b64}`;
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr ?? new Error("CF_AI_FAILED");
}

export const cloudflareWorkersAiProvider: AiProvider = {
  async generateDesign(input: GenerateDesignInput): Promise<GeneratedDesign> {
    // قاعدهٔ Task 41/42: ترجمهٔ فارسی→انگلیسی (کش‌شده) + گارد دامنه،
    // تا خروجی همیشه دکوراسیون داخلی واقع‌گرا بماند.
    const [prompt, style, room, color, mood] = await Promise.all([
      toEngineEnglish(input.prompt ?? ""),
      toEngineEnglish(input.style ?? ""),
      toEngineEnglish(input.room ?? ""),
      toEngineEnglish(input.color ?? ""),
      toEngineEnglish(input.mood ?? ""),
    ]);
    const full = buildGenerationPrompt({ prompt, style, room, color, mood });
    const dataUrl = await cfAiImage(full);
    return {
      id: uid(),
      beforeImage: input.referenceImage,
      afterImage: dataUrl,
      creditsUsed: 0, // فری‌تیر Workers AI — صفرِ صادقانه
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

// ============================================================
// Engine prompt translation (SERVER-ONLY).
//
// LIVE FINDING: the image engine's content filter false-positives
// on PERSIAN script — any Persian character in an image request
// gets HTTP 400 (code 1301), while English sails through and the
// CHAT endpoint handles Persian perfectly.
//
// Fix: image prompts are auto-translated to concise English via
// the engine's own chat (GLM reads Persian natively), with a
// deterministic design dictionary as offline fallback. Results
// are cached in-memory — one translation per unique prompt.
// ============================================================
import { engineChat } from "./orali/oraliClient";

const PERSIAN_RE = /[\u0600-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/;

export function hasPersian(text: string): boolean {
  return PERSIAN_RE.test(text);
}

/* ---- offline fallback dictionary (interior design core) ---- */
const DICT: [RegExp, string][] = [
  [/مبل راحتی|کاناپه|مبل/, "sofa"],
  [/چسترفیلد/, "chesterfield"],
  [/مخمل/, "velvet"],
  [/چرم/, "leather"],
  [/پارچه|روکش/, "fabric upholstery"],
  [/صندلی/, "chair"],
  [/میز جلو مبلی|جلمبلی|میز/, "coffee table"],
  [/ناهارخوری/, "dining table"],
  [/تخت/, "bed"],
  [/فرش|قالیچه|قالی/, "rug"],
  [/پرده/, "curtains"],
  [/کوسن/, "cushions"],
  [/روتختی|ملحفه/, "bedding"],
  [/آباژور|چراغ رومیزی/, "table lamp"],
  [/لوستر|چراغ سقفی/, "ceiling light"],
  [/آینه/, "mirror"],
  [/تابلو/, "wall art"],
  [/گلدان|گیاه|گل/, "vase with plants"],
  [/قفسه|کتابخانه/, "shelf"],
  [/بوفه|کنسول|سایدبورد/, "sideboard"],
  [/دیوار/, "wall"],
  [/کف|پارکت|سرامیک/, "flooring"],
  [/سقف/, "ceiling"],
  [/پنجره/, "window"],
  [/در/, "door"],
  [/پذیرایی|نشیمن|اتاق نشیمن/, "living room"],
  [/اتاق خواب|خواب/, "bedroom"],
  [/آشپزخانه|کابینت/, "kitchen"],
  [/فضای کار|دفتر|اتاق کار/, "home office"],
  [/ناهار خوری|ناهارخوری/, "dining room"],
  [/حیاط|بالکن|تراس|بیرونی/, "outdoor patio"],
  [/سبز/, "green"],
  [/آبی/, "blue"],
  [/قرمز/, "red"],
  [/زرد/, "yellow"],
  [/نارنجی|تراکوتا/, "terracotta"],
  [/قهوه‌ای|قهوه ای|شکلاتی/, "brown"],
  [/کرم|شیری|بژ/, "cream beige"],
  [/سفید/, "white"],
  [/مشکی|سیاه/, "black"],
  [/خاکستری|طوسی/, "gray"],
  [/طلایی|طلایی‌رنگ/, "gold"],
  [/چوب|چوبی/, "wooden"],
  [/فلز|فلزی/, "metal"],
  [/مدرن/, "modern"],
  [/مینیمال|مینیمالیست/, "minimalist"],
  [/کلاسیک/, "classic"],
  [/اسکاندیناوی/, "scandinavian"],
  [/جاپندی/, "japandi"],
  [/صنعتی/, "industrial"],
  [/بوهو|بوهمی/, "bohemian"],
  [/روستیک|روستایی/, "rustic"],
  [/لوکس|لاکچری/, "luxury"],
  [/عوض کن|تعویض|تغییر بده|بذار|بگذار/, "replace"],
  [/اضافه کن|بذار اضافه/, "add"],
  [/حذف کن|بردار/, "remove"],
  [/بزرگ‌تر|بزرگتر/, "larger"],
  [/کوچک‌تر|کوچکتر/, "smaller"],
  [/روشن‌تر|روشنتر|روشن/, "brighter"],
  [/گرم|دنج/, "warm cozy"],
  [/همینطوری بمونه|بقیه.*(بمونه|همون)|دست نزن/, "keep everything else unchanged"],
];

function dictionaryTranslate(text: string): string {
  let out = text;
  for (const [re, en] of DICT) {
    if (re.test(out)) out = out.replace(re, ` ${en} `);
  }
  // Strip any leftover Persian characters + collapse whitespace.
  const stripped = out.replace(PERSIAN_RE, " ").replace(/\s+/g, " ").trim();
  return stripped || "interior design edit";
}

/* ---- translation cache (per server instance) ---- */
const cache = new Map<string, string>();
const CACHE_MAX = 300;

async function translateViaChat(text: string): Promise<string | null> {
  try {
    const out = await engineChat(
      [
        {
          role: "system",
          content:
            "You translate Persian interior-design instructions into concise English for an image-editing model. Output ONLY the English translation — no quotes, no explanations, no Persian. Keep furniture, colors, styles and 'keep everything else unchanged' constraints exact.",
        },
        { role: "user", content: text.slice(0, 800) },
      ],
      { temperature: 0.1 },
    );
    const clean = out.replace(/^[\"'\s]+|[\"'\s]+$/g, "").trim();
    // The translation must be Persian-free; otherwise fall back.
    return clean && !hasPersian(clean) ? clean.slice(0, 900) : null;
  } catch {
    return null;
  }
}

/**
 * Persian-safe prompt for the image engine. English in → unchanged
 * (fast path, no LLM call). Persian in → translated (cached).
 */
export async function toEngineEnglish(text: string): Promise<string> {
  if (!text || !hasPersian(text)) return text;
  const cached = cache.get(text);
  if (cached) return cached;

  const translated = (await translateViaChat(text)) ?? dictionaryTranslate(text);
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(text, translated);
  return translated;
}

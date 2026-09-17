// ============================================================
// Serper Provider (SERVER-ONLY) — عکس‌های واقعی گوگل برای بخش AI.
//
// Task 42 — درخواست مالک: «از api serper.dev برای قسمت هوش مصنوعی
// استفاده کنیم برای عکس». منبع عکسِ واقعی (نه تولیدی) برای الهام/
// مرجع در استودیو — فری‌تیر ~۲۵۰۰ کوئری در ماه.
//
// صرفه‌جویی اجباری در فری‌تیر:
//  • کش درون‌حافظه‌ای ۶ ساعته (instance گرم ورسل) با سقف ۴۰۰ کلید؛
//  • «الهام واقعی» در UI فقط بعد از کلیک کاربر fetch می‌کند.
//
// گارد دامنه (خواسته مالک): کوئری با ترجمه انگلیسی + پسوند دکوراسیون
// فرستاده می‌شود تا نتایج همیشه هم‌راستای کسب‌وکار سایت بماند.
// ============================================================
import { toEngineEnglish } from "./engineTranslate";

const API_URL = "https://google.serper.dev/images";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h
const CACHE_MAX = 400;
const TIMEOUT_MS = 12_000;

export interface SerperImage {
  imageUrl: string;
  title: string;
  source: string;
  link?: string;
  width?: number;
  height?: number;
}

const cache = new Map<string, { at: number; images: SerperImage[] }>();

export function isSerperConfigured(): boolean {
  return Boolean(process.env.SERPER_API_KEY);
}

/**
 * کوئری گاردشده: ورودی فارسی → انگلیسی (translateViaCompat رایگان) و اگر
 * کلمه‌ای از دامنه دکوراسیون در متن نبود، پسوند دامنه اضافه می‌شود.
 */
export async function buildImageQuery(raw: string): Promise<string> {
  const en = await toEngineEnglish(raw);
  const base = en.trim().slice(0, 120);
  const hasDomainWord =
    /interior|decor|room|kitchen|bedroom|living|dining|furniture|design|style|home|apartment/i.test(base);
  return hasDomainWord ? base : `${base ? `${base}, ` : ""}interior design decor photo`;
}

/** نرمال‌سازی سخت‌گیرانه: فقط URL مطلق، حذف تکراری (http→https یکسان‌سازی). */
function normalize(rows: unknown[]): SerperImage[] {
  const seen = new Set<string>();
  const out: SerperImage[] = [];
  for (const raw of rows) {
    const r = raw as Record<string, unknown>;
    const url = typeof r.imageUrl === "string" ? r.imageUrl : "";
    if (!url || !/^https?:\/\//i.test(url)) continue;
    const key = url.split("#")[0].replace(/^http:/i, "https:");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      imageUrl: key,
      title: typeof r.title === "string" ? r.title.slice(0, 140) : "",
      source: typeof r.source === "string" ? r.source.slice(0, 80) : "",
      link: typeof r.link === "string" && r.link.startsWith("http") ? r.link : undefined,
      width: typeof r.width === "number" ? r.width : undefined,
      height: typeof r.height === "number" ? r.height : undefined,
    });
  }
  return out;
}

/**
 * جست‌وجوی عکس واقعی گوگل. خطا هرگز بی‌صدا به mock نمی‌رود — بالا می‌رود
 * تا گیت /api/ai پاسخ degraded خالی بدهد (UI نمی‌سوزد).
 */
export async function searchRealImages(query: string, num = 8): Promise<SerperImage[]> {
  const key = process.env.SERPER_API_KEY;
  if (!key) throw new Error("SERPER_NOT_CONFIGURED");
  const q = query.trim().slice(0, 160);
  if (!q) return [];

  const hit = cache.get(q);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.images;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json" },
      body: JSON.stringify({ q, num: Math.min(Math.max(num, 1), 20) }),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`SERPER_HTTP_${res.status}`);
    const data = (await res.json()) as { images?: unknown[] };
    const images = normalize(Array.isArray(data.images) ? data.images : []);
    if (cache.size >= CACHE_MAX) {
      const oldest = cache.keys().next().value;
      if (oldest) cache.delete(oldest);
    }
    cache.set(q, { at: Date.now(), images });
    return images;
  } finally {
    clearTimeout(timer);
  }
}

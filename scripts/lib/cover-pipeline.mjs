#!/usr/bin/env node
/**
 * cover-pipeline — زنجیره مشترک کاور برای ایجنت‌های محتوا (مجله/ترندها و تعمیر کاور)
 * ============================================================
 * قواعد کاربر (Task 43):
 *   ① هیچ عکسی نباید دوبار استفاده شود — نه هم‌مسیر، نه هم‌بایت (md5).
 *   ② عکس باید خودِ ایجنت دانلود کند و داخل ریپو ذخیره شود (هات‌لینک ممنوع).
 *   ③ عکس باید به موضوع بریف مرتبط باشد — کاور جنریک فقط آخرین پناه است و
 *      باید پرچم‌گذاری شود تا ناظر سایت (site-watchdog) آلارم بدهد.
 *
 * ترتیب انتخاب کاور در هر بریف:
 *   1) og:image خود منبع (مقاله اصلی)
 *   2) جستجوی وب هم‌موضوع (z-ai — فقط سندباکس)
 *   3) Openverse (رایگان، بدون کلید، لایسنس تجاری) — داخل Actions هم کار می‌کند
 *   4) تولید عکس با Pollinations (رایگان، بدون کلید) — دانلود و ذخیره محلی
 *   5) استخر جنریک دسته (آخرین پناه — پرچم coverSource:"pool")
 *
 * رجیستری ضدتکرار: src/content/trends/cover-registry.json
 *   { byMd5: {md5: slug}, byPath: {publicPath: slug}, byUrl: {url: slug} }
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

export const __coverDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const REPO_ROOT = __coverDir;
export const REGISTRY_FILE = path.join(REPO_ROOT, "src", "content", "trends", "cover-registry.json");
export const SRC_IMG_DIR = path.join(REPO_ROOT, "public", "images", "trends", "src");

export const UA_HEADERS = {
  "User-Agent": "Mozilla/5.0 (compatible; HomeinoCoverBot/1.0; +https://homeino.vercel.app)",
  Accept: "image/*,*/*;q=0.8",
};

// ---------- md5 ----------
export function md5Buf(buf) {
  return crypto.createHash("md5").update(buf).digest("hex");
}

export function md5File(p) {
  try {
    return md5Buf(fs.readFileSync(p));
  } catch {
    return null;
  }
}

// ---------- رجیستری ----------
export function loadRegistry() {
  try {
    const j = JSON.parse(fs.readFileSync(REGISTRY_FILE, "utf8"));
    return { byMd5: j.byMd5 || {}, byPath: j.byPath || {}, byUrl: j.byUrl || {} };
  } catch {
    return { byMd5: {}, byPath: {}, byUrl: {} };
  }
}

export function saveRegistry(reg) {
  fs.mkdirSync(path.dirname(REGISTRY_FILE), { recursive: true });
  fs.writeFileSync(REGISTRY_FILE, JSON.stringify(reg, null, 2) + "\n", "utf8");
}

/** ایندکس بایتی همه کاورهای فعلی بریف‌ها — تکرار بین بریف‌های زنده را هم می‌گیرد */
export function buildBytesIndex(briefs) {
  const byMd5 = {};
  const byPath = {};
  for (const b of briefs || []) {
    if (!b?.cover) continue;
    byPath[b.cover] = b.slug;
    const p = path.join(REPO_ROOT, "public", b.cover);
    const h = md5File(p);
    if (h) byMd5[h] = b.slug;
  }
  return { byMd5, byPath };
}

/** آیا این بایت/مسیر/URL قبلاً برای بریف دیگری مصرف شده؟ */
export function findConflict({ buf, publicPath, url, selfSlug }, reg, extraBytesIndex) {
  const h = buf ? md5Buf(buf) : null;
  if (h) {
    if (reg.byMd5[h] && reg.byMd5[h] !== selfSlug)
      return `md5-dup:${reg.byMd5[h]}`;
    const ei = extraBytesIndex?.byMd5?.[h];
    if (ei && ei !== selfSlug) return `bytes-dup-live:${ei}`;
  }
  if (publicPath && reg.byPath[publicPath] && reg.byPath[publicPath] !== selfSlug)
    return `path-dup:${reg.byPath[publicPath]}`;
  if (url && reg.byUrl[url] && reg.byUrl[url] !== selfSlug)
    return `url-dup:${reg.byUrl[url]}`;
  return null;
}

/** ثبت کاور تأییدشده در رجیستری */
export function registerCover({ md5, publicPath, url, slug }, reg) {
  if (md5) reg.byMd5[md5] = slug;
  if (publicPath) reg.byPath[publicPath] = slug;
  if (url) reg.byUrl[url] = slug;
}

// ---------- ابعاد تصویر (PNG/JPEG/GIF/WebP-min) ----------
export function probeImageDims(buf) {
  try {
    if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let off = 2;
      while (off + 9 < buf.length) {
        if (buf[off] !== 0xff) { off++; continue; }
        const marker = buf[off + 1];
        if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
          return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
        }
        off += 2 + buf.readUInt16BE(off + 2);
      }
    }
    if (buf.length > 12 && buf.slice(0, 4).toString() === "RIFF" && buf.slice(8, 12).toString() === "WEBP") {
      const code = buf.slice(12, 16).toString();
      if (code === "VP8X") return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
      if (code === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
    }
  } catch {}
  return null;
}

// ---------- دانلود با گیت‌های کیفی ----------
/**
 * دانلود عکس به public/images/trends/src — در صورت عبور از گیت‌ها مسیر عمومی برمی‌گرداند.
 * گیت‌ها: content-type تصویری، حداقل حجم، حداقل ابعاد، یکتایی md5/مسیر/URL.
 */
export async function downloadCoverImage(imgUrl, slug, reg, extraBytesIndex, opts = {}) {
  const minW = opts.minW ?? 600;
  const minH = opts.minH ?? 360;
  try {
    const res = await fetch(imgUrl, {
      headers: { ...UA_HEADERS, Referer: new URL(imgUrl).origin },
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) return { error: `http-${res.status}` };
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/") || /svg|icon|gif/.test(type)) return { error: "type-reject" };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 8000) return { error: "too-small" };
    const dims = probeImageDims(buf);
    if (dims) {
      if (dims.w < minW || dims.h < minH) return { error: `dims-${dims.w}x${dims.h}` };
    } else if (buf.length < 25000) {
      return { error: "unknown-format-small" };
    }
    const conflict = findConflict({ buf, url: imgUrl, selfSlug: slug }, reg, extraBytesIndex);
    if (conflict) return { error: conflict };
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : "jpg";
    fs.mkdirSync(SRC_IMG_DIR, { recursive: true });
    const dest = path.join(SRC_IMG_DIR, `${slug}.${ext}`);
    fs.writeFileSync(dest, buf);
    const publicPath = `/images/trends/src/${slug}.${ext}`;
    return { buf, md5: md5Buf(buf), publicPath, url: imgUrl, dims };
  } catch (e) {
    return { error: "fetch-fail:" + (e?.message || "x") };
  }
}

// ---------- Openverse (رایگان/بی‌کلید — داخل Actions هم زنده است) ----------
const OV_BASE = "https://api.openverse.org/v1/images/";

export async function openverseImages(query, limit = 8) {
  try {
    const u = `${OV_BASE}?q=${encodeURIComponent(query)}&page_size=${limit}&license_type=commercial&size=large&mature=false`;
    const res = await fetch(u, { headers: { ...UA_HEADERS, Accept: "application/json" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return [];
    const j = await res.json();
    return (j.results || [])
      .filter((r) => r.url && (r.width || 1200) >= 600 && (r.height || 400) >= 360)
      .map((r) => ({ url: r.url, source: r.source || "openverse", w: r.width || 1200, h: r.height || 800 }));
  } catch {
    return [];
  }
}

// ---------- تولید عکس رایگان (Pollinations) — دانلود محلی، بدون هات‌لین ----------
function slugSeed(slug) {
  let h = 0;
  for (const ch of slug) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h % 100000;
}

export async function generatedCover(promptEn, slug, reg, extraBytesIndex) {
  const base = slugSeed(slug);
  const seeds = [base, base + 777, base + 313];
  for (let i = 0; i < seeds.length; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 6000)); // نفس برای سهمیه رایگان
    const u = `https://image.pollinations.ai/prompt/${encodeURIComponent(promptEn)}?width=1152&height=864&seed=${seeds[i]}&nologo=true&model=flux`;
    // پن سرویس رایگان گاهی خروجی ۸۸۶×۶۶۵ می‌دهد — گیت ملایم‌تر برای تولید
    const r = await downloadCoverImage(u, slug, reg, extraBytesIndex, { minW: 760, minH: 560 });
    if (!r.error) {
      // حذف واترمارک گوشهٔ پایین (پن سرویس رایگان nologo را رعایت نمی‌کند)
      const cropped = await cropBottomStrip(path.join(REPO_ROOT, "public", r.publicPath));
      if (cropped) {
        r.md5 = md5File(path.join(REPO_ROOT, "public", r.publicPath));
        r.dims = cropped;
      }
      return { ...r, url: u, generated: true };
    }
    console.log(`  generate seed=${seeds[i]} رد شد: ${r.error}`);
  }
  return null;
}

/** نوار پایین عکس تولیدی را می‌بُرد (واترمارک) — اگر sharp در دسترس باشد */
async function cropBottomStrip(absPath) {
  try {
    const sharp = require("sharp");
    const meta = await sharp(absPath).metadata();
    if (!meta.width || !meta.height || meta.height < 500) return null;
    const cut = Math.max(28, Math.round(meta.height * 0.075)); // ~۷٫۵٪ پایین
    const buf = await sharp(absPath)
      .extract({ left: 0, top: 0, width: meta.width, height: meta.height - cut })
      .jpeg({ quality: 84 })
      .toBuffer();
    fs.writeFileSync(absPath, buf);
    return { w: meta.width, h: meta.height - cut };
  } catch {
    return null;
  }
}

// ---------- پرامپت انگلیسی برای تولید کاور هم‌موضوع ----------
const CATEGORY_PROMPT = {
  "مبلمان": "elegant modern living room with a statement sofa, warm natural light, interior design photography",
  "فرش و قالیچه": "beautiful area rug anchoring a stylish living room, interior design photography",
  "کف‌پوش": "premium wooden flooring in a bright modern interior, interior design photography",
  "روشنایی و لوستر": "designer pendant chandelier lighting a cozy interior, evening ambience, interior design photography",
  "تابلو و دیوارکوب": "curated wall art and framed prints on an elegant interior wall, interior design photography",
  "گلدان و گیاه": "ceramic vases with green plants on a styled console, bright interior, interior design photography",
  "پرده و منسوجات": "flowing linen curtains in a sunlit living room, soft textures, interior design photography",
  "دکوری و اکسسوری": "styled coffee table with elegant decor accessories, interior design photography",
  "کمد و ذخیره‌سازی": "built-in wardrobe and smart storage wall in a modern bedroom, interior design photography",
  "دیوارپوش": "accent wall with elegant wallpaper and panelling, interior design photography",
  "رنگ": "freshly painted accent wall in a tasteful modern interior, colour-focused interior design photography",
  "آشپزخانه": "modern kitchen interior with warm materials, interior design photography",
  "حمام": "spa-like bathroom interior with elegant tiles, interior design photography",
  "متریال": "close-up of natural materials and textures in a modern interior, interior design photography",
  "سبک‌ها": "beautifully styled modern interior with character, interior design photography",
  "هوشمند": "smart home device seamlessly integrated in an elegant interior, interior design photography",
  "ویلا و باغ": "luxury villa living space opening to a garden, interior design photography",
  "حیاط و بیرونی": "cozy outdoor patio with stylish furniture at golden hour, interior design photography",
  "محیط کار": "stylish home office workspace in a bright interior, interior design photography",
  "وسایل ترند": "trendy decor piece in a beautifully styled modern interior, interior design photography",
  "سبک زندگی": "warm inviting home interior with lived-in charm, interior design photography",
};

/** با LLM یک پرامپت انگلیسیِ کاور می‌سازد؛ شکست → دیکشنری دسته */
export async function topicPromptEn(title, category, callLlmFn) {
  const fallback = CATEGORY_PROMPT[category] || CATEGORY_PROMPT["سبک‌ها"];
  // مسیر ۱ — z-ai CLI (سندباکس): سریع، رایگان، هم‌موضوع با خودِ تیتر
  try {
    const has = spawnSync("which", ["z-ai"], { encoding: "utf8" }).status === 0;
    if (has) {
      const raw = execFileSync(
        "z-ai",
        [
          "chat",
          "-s", "You convert Persian interior-design trend titles into ONE short English image-generation prompt (realistic interior photo, max 22 words, no text/watermark/people). Reply with the prompt line only.",
          "-p", `عنوان: ${title}\nدسته: ${category || "عمومی"}`,
        ],
        { timeout: 60_000, encoding: "utf8" }
      );
      const j = JSON.parse(raw.slice(raw.indexOf("{")));
      const line = String(j?.choices?.[0]?.message?.content || "").replace(/["\n\r]/g, " ").trim();
      if (line.length > 20 && /^[A-Za-z0-9 ,'\-]+$/.test(line)) return line + ", professional interior design photography";
    }
  } catch {}
  // مسیر ۲ — زنجیرهٔ LLM (داخل Actions با کلیدها کار می‌کند)
  if (typeof callLlmFn === "function") {
    try {
      const out = await callLlmFn(
        [
          { role: "system", content: "You write concise image-generation prompts for interior-design magazine covers. Reply with ONE line of English only: a realistic interior-design photograph description (no text, no watermark, no collage, no people portraits). Max 30 words." },
          { role: "user", content: `Trend title (Persian): ${title}\nCategory: ${category || "general"}` },
        ],
        { temperature: 0.3, maxTokens: 80 }
      );
      const line = (out || "").replace(/["\n\r]/g, " ").trim();
      if (line.length > 25 && /^[A-Za-z0-9 ,'\-]+$/.test(line)) return line + ", professional interior design photography";
    } catch {}
  }
  return fallback;
}

// ---------- گیت متنی ضدکلاژ (تصمیم قبل از دانلود) ----------
/** نشانی‌های رایج کلاژ/بنر/لوگو/اسپرایت را قبل از دانلود رد می‌کند */
export function looksLikeNonPhoto(url) {
  const u = (url || "").toLowerCase();
  return /(logo|sprite|icon|avatar|banner|badge|placeholder|watermark|collage|infographic|chart|diagram|\.svg)/.test(u);
}

// ============================================================
// serper.mjs — کلاینت serper.dev برای ایجنت‌های محتوایی هومینو
// (magazine-daily + serper-pool-topup)
//
// serper.dev = API نتایج گوگل (Search / News / Images / …)
//   - کلید رایگان: ۲,۵۰۰ کوئری شروع، بدون کارت بانکی → https://serper.dev
//   - احراز: هدر X-API-KEY
//   - کوئری‌های این ریپو مصرفی‌شان چند ده در روز است؛ خیلی زیر سقف رایگان
//
// قواعد استفاده در هومینو:
//   - همه توابع بدون کلید (env: SERPER_API_KEY) بی‌صدا null/error برمی‌گردانند
//     تا رفتار فعلی ایجنت‌ها دست‌نخورده بماند.
//   - عکس‌ها هرگز هات‌لینک نمی‌شوند: downloadImage فایل را دانلود و
//     اعتبارسنجی (نوع، حجم، ابعاد) می‌کند و در ریپو ذخیره می‌شود.
// ============================================================
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const BASE = "https://google.serper.dev";
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoMagazineBot/1.0; +https://homeino.ir)" };

export function serperKey() {
  const k = process.env.SERPER_API_KEY;
  return k && k.trim().length > 10 ? k.trim() : null;
}

async function serperPost(endpoint, body, timeoutMs = 15_000) {
  const key = serperKey();
  if (!key) return { error: "no-key" };
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}/${endpoint}`, {
      method: "POST",
      headers: { "X-API-KEY": key, "Content-Type": "application/json", ...UA },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const b = await res.text().catch(() => "");
      return { error: `HTTP ${res.status}: ${b.slice(0, 120)}` };
    }
    return { data: await res.json() };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "timeout" : e?.message ?? "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

/** خبرهای تازه گوگل‌نیوز — منبع کمکی برای بریف‌های مجله */
export async function serperNews(q, { gl = "us", hl = "en", when = "1w", num = 10 } = {}) {
  const r = await serperPost("news", { q, gl, hl, tbs: `qdr:${when}`, num });
  if (r.error) return null;
  return Array.isArray(r.data?.news) ? r.data.news : null;
}

/** عکس‌های مرتبط — کاندید کاور ترندها / پرکردن استخر الهام */
export async function serperImages(q, { gl = "us", hl = "en", num = 20 } = {}) {
  const r = await serperPost("images", { q, gl, hl, num });
  if (r.error) return null;
  return Array.isArray(r.data?.images) ? r.data.images : null;
}

/**
 * عکس‌های هم‌موضوع با شکل سازگار با زنجیره کاور magazine-daily:
 * خروجی [{url, source, w, h}] — بدون کلید: [] (رفتار فعلی دست‌نخورده)
 */
export async function serperTopicImages(query, { num = 12 } = {}) {
  if (!serperKey()) return [];
  const imgs = await serperImages(query, { num });
  if (!imgs?.length) return [];
  return pickImageCandidate(imgs, { minWidth: 600, minHeight: 360, landscape: false, maxTries: 8 })
    .map((c) => ({ url: c.url, source: `serper:${c.source || "web"}`, w: c.w, h: c.h }));
}

// ---------- ابزار عکس ----------

function imgField(im, names) {
  for (const n of names) {
    const v = Number(im?.[n]);
    if (Number.isFinite(v) && v > 0) return v;
  }
  return 0;
}

/** ابعاد تصویر از بایت‌ها (PNG/JPEG/WebP) — بدون وابستگی خارجی */
export function imageDims(buf) {
  if (!buf || buf.length < 24) return null;
  // PNG: IHDR در آفست ۱۶
  if (buf[0] === 0x89 && buf[1] === 0x50) {
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  // JPEG: اسکن مارکرهای SOF
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) { off++; continue; }
      const marker = buf[off + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      off += 2 + buf.readUInt16BE(off + 2);
    }
    return null;
  }
  // WebP: VP8/VP8L/VP8X — فقط تشخیص کافی است
  if (buf.slice(8, 12).toString("ascii") === "WEBP") return { w: 0, h: 0 };
  return null;
}

/**
 * بهترین کاندید عکس از نتایج serper — با فیلتر ابعاد/نوع و پرهیز از تکرار
 * existingHashes: مجموعه md5 فایل‌های قبلی (برای جلوگیری از کاور تکراری)
 * exclude: مجموعه URLهایی که قبلا استفاده/رد شده‌اند
 */
export function pickImageCandidate(images, { minWidth = 800, minHeight = 520, landscape = true, exclude = null, maxTries = 5 } = {}) {
  if (!Array.isArray(images)) return null;
  const seen = new Set();
  const out = [];
  for (const im of images) {
    const u = String(im?.imageUrl || im?.original || "");
    if (!/^https?:\/\//i.test(u) || seen.has(u)) continue;
    seen.add(u);
    if (exclude?.has(u)) continue;
    if (/\.svg(\?|$)/i.test(u)) continue;
    const w = imgField(im, ["imageWidth", "width", "originalWidth"]);
    const h = imgField(im, ["imageHeight", "height", "originalHeight"]);
    if ((w && w < minWidth) || (h && h < minHeight)) continue;
    if (landscape && w && h && w <= h) continue; // کاور افقی می‌خواهیم
    const score = Math.min(w, 4000) + Math.min(h, 3000) * 0.5;
    out.push({ url: u, title: String(im?.title || ""), source: String(im?.source || im?.domain || ""), w, h, score });
    if (out.length >= 24) break;
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, maxTries);
}

/**
 * دانلود و اعتبارسنجی عکس → ذخیره محلی (هیچ‌وقت هات‌لینک نمی‌مانیم)
 * خروجی: { ok:true, file, cover, bytes, md5 } یا { error }
 */
export async function downloadImage(url, destFile, { minBytes = 25_000, maxBytes = 5_000_000, minW = 640, minH = 420, timeoutMs = 20_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal, redirect: "follow" });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/") || type.includes("svg")) return { error: `bad-type:${type || "?"}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < minBytes) return { error: `too-small:${buf.length}` };
    if (buf.length > maxBytes) return { error: `too-big:${buf.length}` };
    const dims = imageDims(buf);
    if (dims && dims.w && dims.w < minW) return { error: `narrow:${dims.w}` };
    if (dims && dims.h && dims.h < minH) return { error: `short:${dims.h}` };
    const md5 = crypto.createHash("md5").update(buf).digest("hex");
    fs.mkdirSync(path.dirname(destFile), { recursive: true });
    fs.writeFileSync(destFile, buf);
    return { ok: true, file: destFile, bytes: buf.length, md5, dims };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "timeout" : e?.message ?? "fetch failed" };
  } finally {
    clearTimeout(t);
  }
}

/** md5 فایل‌های موجود در یک پوشه — برای تشخیص کاور تکراری */
export function hashDir(dir) {
  const map = new Map();
  try {
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      try {
        const st = fs.statSync(p);
        if (!st.isFile() || st.size > 6_000_000) continue;
        map.set(crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"), f);
      } catch { /* فایل ناپایدار — رد */ }
    }
  } catch { /* پوشه نیست */ }
  return map;
}

/** حذف فایل بد (اگر بعد از دانلود معلوم شد تکراری است) */
export function safeUnlink(p) {
  try { fs.unlinkSync(p); } catch { /* بی‌اهمیت */ }
}

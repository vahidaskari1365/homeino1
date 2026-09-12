#!/usr/bin/env node
// ============================================================
// expand-product-pool (v2) — شارژ استخر عکس «دسته‌های محصول» الهام
// روش: web_search (z-ai CLI) → مقالات → og:image → دانلود لوکال
// به public/images/product-pins/ — بدون وابستگی به سرویس image-search
// و بدون هات‌لینک خارجی (مقاوم در CI و برای همیشه).
//
// خروجی: pool._products[slug] = [{url: "/images/product-pins/…", source}]
// قابل‌ادامه: دسته‌هایی که به هدف رسیده‌اند رد می‌شوند.
// اجرا (فقط سندباکس): node scripts/expand-product-pool.mjs [--target=10]
// ============================================================
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { PRODUCTS } from "./lib/homeino-categories.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POOL_FILE = join(ROOT, "scripts/inspiration-pool.json");
const IMG_DIR = join(ROOT, "public", "images", "product-pins");
const TARGET_PER_PRODUCT = Number(process.argv.find((a) => a.startsWith("--target="))?.split("=")[1] || 10);
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoMagazineBot/1.0; +https://homeino.ir)" };

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/>/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#x2F;/gi, "/");
}

/** og:image / twitter:image از HTML صفحه */
function extractOgImage(html, baseUrl) {
  if (!html) return null;
  const pats = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (!m) continue;
    const raw = decodeEntities(m[1]).trim();
    if (!/^https?:/i.test(raw) && !raw.startsWith("//") && !raw.startsWith("/")) continue;
    try { return new URL(raw, baseUrl).href; } catch { return null; }
  }
  return null;
}

function probeImageDims(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const fmt = buf.toString("ascii", 12, 16);
      if (fmt === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (fmt === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
      if (fmt === "VP8X") return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
      return null;
    }
    return null;
  } catch { return null; }
}

async function fetchText(url, timeoutMs = 12_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(t); }
}

async function downloadImage(imgUrl, baseName) {
  try {
    const res = await fetch(imgUrl, { headers: { ...UA, Referer: new URL(imgUrl).origin, Accept: "image/*" }, signal: AbortSignal.timeout(18_000) });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/") || /svg|icon/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 6000) return null;
    const dims = probeImageDims(buf);
    if (dims) { if (dims.w < 500 || dims.h < 320) return null; }
    else if (buf.length < 25_000) return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : "jpg";
    const dest = `${baseName}.${ext}`;
    writeFileSync(dest, buf);
    return `/images/product-pins/${dest.split("/").pop()}`;
  } catch { return null; }
}

function webSearch(query, num) {
  const out = join(ROOT, "scripts/.ws-tmp.json");
  try {
    execFileSync("z-ai", ["function", "-n", "web_search", "-a", JSON.stringify({ query, num }), "-o", out], { timeout: 90_000, encoding: "utf8" });
    const j = JSON.parse(readFileSync(out, "utf8"));
    return (Array.isArray(j) ? j : j.results || []).map((r) => ({ url: r.url, host: r.host_name || "" }));
  } catch { return []; }
}

async function main() {
  mkdirSync(IMG_DIR, { recursive: true });
  const doc = JSON.parse(readFileSync(POOL_FILE, "utf8"));
  doc.pool._products ??= {};

  // کوئری‌های ویرایشی برای دسته‌هایی که نتایج فروشگاهی/بدون og زیاد می‌دهند
  const QUERY_OVERRIDES = {
    "پرده و منسوجات": ["sheer curtains styling bedroom interior", "linen drapes neutral living room", "window treatment trends 2026", "cafe curtains kitchen ideas"],
    "مبل و مبلمان": ["sofa living room ideas", "modern sofa design guide", "best sofa styles 2026", "living room seating ideas"],
    "فرش و قالیچه": ["area rug living room ideas", "how to choose rug size living room", "rug styling tips modern interior", "persian rug interior ideas"],
    "کف‌پوش": ["wood flooring ideas living room", "herringbone parquet inspiration", "flooring trends 2026", "oak floor interior styling"],
  };

  // تکرار جهانی ممنوع: همه URLهای استخر (سبک + محصول) — هم مسیر لوکال هم آدرس og منبع
  const allUrls = new Set();
  for (const styleSpace of Object.values(doc.pool)) {
    for (const items of Object.values(styleSpace || {})) {
      if (Array.isArray(items)) for (const p of items) { if (p?.url) allUrls.add(p.url); if (p?.src) allUrls.add(p.src); }
    }
  }
  const before = Object.values(doc.pool._products).reduce((n, v) => n + v.length, 0);
  console.log(`استخر محصولات فعلی: ${before} عکس — هدف: ${PRODUCTS.length}×${TARGET_PER_PRODUCT}`);

  for (const [pi, product] of PRODUCTS.entries()) {
    const bucket = doc.pool._products[product.slug] ?? [];
    if (bucket.length >= TARGET_PER_PRODUCT) {
      console.log(`[${pi + 1}/${PRODUCTS.length}] ${product.slug}: کافی (${bucket.length}) — رد شد`);
      continue;
    }
    // کوئری‌ها: ویرایشی (اگر تعریف شده) وگرنه چهار واریانت عمومی
    const queries = QUERY_OVERRIDES[product.slug] ?? [
      `${product.en} ideas`,
      `${product.en} design guide`,
      `${product.en} best picks 2026`,
      `${product.en} styling tips`,
    ];
    const triedPages = new Set(bucket.map((p) => p.page).filter(Boolean));
    for (const [qi, q] of queries.entries()) {
      if (bucket.length >= TARGET_PER_PRODUCT) break;
      const results = webSearch(q, 8);
      console.log(`  q${qi + 1} «${q}» → ${results.length} نتیجه`);
      for (const r of results) {
        if (bucket.length >= TARGET_PER_PRODUCT) break;
        if (!r.url || triedPages.has(r.url)) continue;
        triedPages.add(r.url);
        const html = await fetchText(r.url, 11_000);
        if (!html) continue;
        const og = extractOgImage(html, r.url);
        if (!og || allUrls.has(og)) continue;
        const name = `c${pi + 1}-${String(bucket.length + 1).padStart(2, "0")}`;
        const local = await downloadImage(og, join(IMG_DIR, name));
        if (!local) continue;
        allUrls.add(og);
        bucket.push({ url: local, source: r.host || new URL(r.url).hostname, src: og, page: r.url });
        console.log(`    + ${local} (${r.host})`);
        await sleep(500);
      }
      await sleep(2_000);
    }
    doc.pool._products[product.slug] = bucket;
    console.log(`[${pi + 1}/${PRODUCTS.length}] ${product.slug}: ${bucket.length} عکس`);
    // ذخیره تدریجی — قطعی وسط کار از دست نمی‌رود
    writeFileSync(POOL_FILE, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  }

  const after = Object.values(doc.pool._products).reduce((n, v) => n + v.length, 0);
  console.log(`\n✓ استخر محصولات: ${before} → ${after} عکس`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

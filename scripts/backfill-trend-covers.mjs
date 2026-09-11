#!/usr/bin/env node
/**
 * backfill-trend-covers — پرکردن کاور بریف‌های موجود از خودِ منبع
 * ============================================================
 * برای هر بریف trends.json که کاورش از استخر لوکال است:
 *   1. لینک منبع (حتی news.google.com) به آدرس واقعی ناشر حل می‌شود
 *   2. og:image از HTML صفحه استخراج می‌شود
 *   3. عکس دانلود و در public/images/trends/src/<slug>.<ext> ذخیره می‌شود
 *   4. cover بریف به همان مسیر محلی تغییر می‌کند
 * اگر منبع عکس نداد: کاور فعلی می‌ماند (بدون دروغ، بدون تکرار جدید).
 * اجرا: node scripts/backfill-trend-covers.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_FILE = path.join(REPO, "src", "content", "trends", "trends.json");
const SRC_IMG_DIR = path.join(REPO, "public", "images", "trends", "src");
const DRY = process.argv.includes("--dry");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoMagazineBot/1.0; +https://homeino.ir)" };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchText(url, timeoutMs = 11000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch { return null; } finally { clearTimeout(t); }
}

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/>/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#x2F;/gi, "/");
}

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

async function resolveRealSourceUrl(url) {
  if (!/news\.google\.com/i.test(url)) return url;
  const html = await fetchText(url, 9000);
  if (!html) return url;
  const m = html.match(/data-n-au=["']([^"']+)["']/i)
    || html.match(/href=["'](https?:\/\/[^"']+)["'][^>]*jslog/i)
    || html.match(/https?:\/\/(?!news\.google|www\.google|accounts\.google|policies\.google)[a-z0-9.-]+\.[a-z]{2,}[^"'<>\s]+/i);
  if (!m) return url;
  try {
    const u = new URL(decodeEntities(m[1]));
    if (/google\./i.test(u.hostname)) return url;
    return u.href;
  } catch { return url; }
}

async function downloadImage(imgUrl, destBase) {
  try {
    const res = await fetch(imgUrl, {
      headers: { ...UA, Referer: new URL(imgUrl).origin, Accept: "image/*" },
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/") || /svg|icon/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 6000) return null;
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : "jpg";
    const dest = `${destBase}.${ext}`;
    fs.writeFileSync(dest, buf);
    return `/images/trends/src/${path.basename(dest)}`;
  } catch { return null; }
}

/** عکس واقعی وبِ هم‌موضوع با ز-ای — فال‌بک وقتی منبع og ندارد */
function hasZai() {
  try { return spawnSync("which", ["z-ai"], { encoding: "utf8" }).status === 0; } catch { return false; }
}

function zAiImageSearch(query) {
  try {
    const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", "4", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    return (j.results || []).map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200, h: parseInt(r.original_height) || 800 }));
  } catch { return []; }
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const briefs = db.briefs ?? [];
  fs.mkdirSync(SRC_IMG_DIR, { recursive: true });

  const usedOg = new Set(); // جلوگیری از عکس تکراری بین بریف‌ها
  const usedWeb = new Set();
  const zai = hasZai();
  let updated = 0, failed = 0, skipped = 0, webfall = 0;

  for (const b of briefs) {
    if (b.cover?.startsWith("/images/trends/src/")) { skipped++; continue; }
    const url = b.source?.url;
    if (!url) { failed++; continue; }
    process.stdout.write(`→ ${b.slug} [${b.source.name}] ... `);
    const real = await resolveRealSourceUrl(url);
    await sleep(400);
    const html = await fetchText(real);
    const og = extractOgImage(html, real);
    if (!og || usedOg.has(og)) {
      // فال‌بک: عکس وبِ هم‌موضوع (اگر ز-ای هست) — نه عکس تکراری استخر
      if (zai && !DRY) {
        const hits = zAiImageSearch(`${b.title} interior design home`).filter((p) => p.w >= 600 && !usedWeb.has(p.url));
        let done = false;
        for (const hit of hits) {
          const cover = await downloadImage(hit.url, path.join(SRC_IMG_DIR, b.slug));
          if (cover) { usedWeb.add(hit.url); b.cover = cover; updated++; webfall++; done = true; console.log(`✓ ${cover} (وب هم‌موضوع)`); break; }
        }
        if (done) { await sleep(600); continue; }
      }
      console.log("✗ بدون og:image"); failed++; await sleep(600); continue;
    }
    if (DRY) { console.log(`(dry) og پیدا شد: ${og.slice(0, 80)}…`); continue; }
    const cover = await downloadImage(og, path.join(SRC_IMG_DIR, b.slug));
    if (cover) {
      usedOg.add(og);
      b.cover = cover;
      updated++;
      console.log(`✓ ${cover}`);
    } else { console.log("✗ دانلود ناموفق"); failed++; }
    await sleep(600);
  }

  if (!DRY) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify({ briefs }, null, 2)}\n`, "utf8");
  }
  console.log(`\nنتیجه: ${updated} کاور تازه (${updated - webfall} از خود منبع، ${webfall} وب هم‌موضوع) · ${failed} ناموفق · ${skipped} قبلاً از منبع${DRY ? " (dry)" : ""}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

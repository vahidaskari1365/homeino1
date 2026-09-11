#!/usr/bin/env node
/**
 * fix-trend-covers — تعمیر کاورهای خراب بریف‌های ترند
 * ===================================================
 * کاورهایی که فایلشان لوگو/آیکون است (مثل لوگوی گوگل‌نیوز ۳۰۰×۳۰۰) شناسایی
 * و با عکس واقعیِ هم‌موضوع از جستجوی وب (z-ai) جایگزین می‌شوند.
 * گیت‌ها: عرض ≥۶۰۰، ابعاد واقعی از بایت‌ها، هش یکتا بین همه کاورها.
 * اجرا: node scripts/fix-trend-covers.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_FILE = path.join(REPO, "src", "content", "trends", "trends.json");
const SRC_IMG_DIR = path.join(REPO, "public", "images", "trends", "src");
const DRY = process.argv.includes("--dry");
// اجرای اجباری برای اسلاگ‌های مشخص: --slug=xxx (حتی اگر فایل فعلی سالم باشد)
const FORCE_SLUGS = process.argv.filter((a) => a.startsWith("--slug=")).map((a) => a.slice(7));
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoMagazineBot/1.0; +https://homeino.ir)" };
// آژانس‌های استوک — پیش‌نمایششان همیشه واترمارک دارد؛ اصلاً وارد کاندیدها نشو
const STOCK_DOMAINS = /(dreamstime|shutterstock|gettyimages|istockphoto|123rf|alamy|depositphotos|stock\.adobe|freepik|bigstockphoto|colourbox|agefotostock|photos\.com|stockcake|vecteezy)\.?/i;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// کوئری‌های دقیق برای بریف‌های خراب — بر اساس موضوع واقعی هر مطلب
const TOPIC_QUERIES = {
  "2026-09-11-4r72bc": "autumn terrace furniture cozy outdoor lounge fall backyard decor inspiration",
  "2026-09-11-64agps": "layered warm living room lighting floor lamp table lamp evening ambiance",
  "2026-09-11-ps6ehp": "Apple iPhone Fold concept render foldable iPhone design",
  "2026-09-11-dlxuqa": "retro colorful mid-century living room seventies palette funky decor",
  "2026-09-11-rmeav8": "bold sculptural contemporary furniture statement designer chair",
  "2026-09-10-pineapple-house-interiors": "earthy modern living room natural textures terracotta linen organic interior",
  "2026-09-10-j9wkdy": "dark moody kitchen design rich colors textured cabinets",
};

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
    if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    return null;
  } catch { return null; }
}

/** آیا این فایل کاور «بد» است؟ خیلی‌کوچک (لوگو/آواتار) یا اصلاً وجود ندارد */
function isBadCover(relPath) {
  if (!relPath) return { bad: true, reason: "بدون کاور" };
  const p = path.join(REPO, "public", relPath);
  if (!fs.existsSync(p)) return { bad: true, reason: "فایل نیست" };
  const buf = fs.readFileSync(p);
  if (buf.length < 20000) return { bad: true, reason: `حجم کم (${buf.length}B)` };
  const d = probeImageDims(buf);
  if (!d) return { bad: true, reason: "فرمت ناشناخته" };
  if (d.w < 500 || d.h < 320) return { bad: true, reason: `خوش‌قیفه ${d.w}×${d.h}` };
  return { bad: false, dims: d, hash: crypto.createHash("sha1").update(buf).digest("hex") };
}

function hasZai() {
  try { return spawnSync("which", ["z-ai"], { encoding: "utf8" }).status === 0; } catch { return false; }
}

function zAiImageSearch(query, count = 8) {
  try {
    const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", String(count), "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    return (j.results || [])
      .filter((r) => !STOCK_DOMAINS.test(r.original_url || "")) // واترمارک آژانس‌های استوک ممنوع
      .map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200 }));
  } catch { return []; }
}

async function downloadValidated(imgUrl, destBase, seenHashes) {
  try {
    const res = await fetch(imgUrl, {
      headers: { ...UA, Referer: new URL(imgUrl).origin, Accept: "image/*" },
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/") || /svg|icon/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 20000) return null;
    const d = probeImageDims(buf);
    if (!d || d.w < 600 || d.h < 400) return null;
    if (d.w / d.h > 3.2 || d.h / d.w > 2.2) return null; // بنر/نوار خیلی‌کشیده نه
    const hash = crypto.createHash("sha1").update(buf).digest("hex");
    if (seenHashes.has(hash)) return null; // عکس تکراری بین کاورها ممنوع
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : "jpg";
    const dest = `${destBase}.${ext}`;
    fs.writeFileSync(dest, buf);
    seenHashes.add(hash);
    return `/images/trends/src/${path.basename(dest)}`;
  } catch { return null; }
}

async function main() {
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const briefs = db.briefs ?? [];
  const zai = hasZai();
  if (!zai && !DRY) { console.error("✗ z-ai CLI نیست — تعمیر ممکن نیست"); process.exit(1); }

  // هش همه کاورهای سالم فعلی → جلوگیری از تکرار
  const seenHashes = new Set();
  for (const b of briefs) {
    const chk = isBadCover(b.cover);
    if (!chk.bad) seenHashes.add(chk.hash);
  }

  let fixed = 0, failed = 0;
  const badFilesToDelete = [];

  for (const b of briefs) {
    let chk = isBadCover(b.cover);
    if (!chk.bad && FORCE_SLUGS.includes(b.slug)) chk = { bad: true, reason: "اجبار بازگرفتن" };
    if (!chk.bad) continue;
    const slug = b.slug;
    const query = TOPIC_QUERIES[slug] || `${b.title} interior design home decor`;
    console.log(`→ ${slug} [${chk.reason}] «${b.title.slice(0, 40)}»`);
    if (DRY) { console.log(`  (dry) کوئری: ${query}`); continue; }

    const hits = zAiImageSearch(query).filter((p) => p.w >= 700);
    let done = false;
    const oldCover = b.cover; // قبل از جایگزینی نگه می‌داریم — حذف هم‌مسیر ممنوع
    for (const hit of hits) {
      const cover = await downloadValidated(hit.url, path.join(SRC_IMG_DIR, slug), seenHashes);
      if (cover) {
        b.cover = cover;
        if (oldCover && oldCover !== cover) badFilesToDelete.push(path.join(REPO, "public", oldCover));
        fixed++;
        done = true;
        console.log(`  ✓ ${cover} (${hit.source}, کوئری: ${query.slice(0, 40)}…)`);
        break;
      }
    }
    if (!done) { failed++; console.log("  ✗ هیچ کاندید سالمی نیامد"); }
    await sleep(800);
  }

  if (!DRY && fixed > 0) {
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
    for (const f of badFilesToDelete) {
      try { fs.unlinkSync(f); console.log(`  🗑 حذف فایل خراب: ${path.basename(f)}`); } catch {}
    }
  }
  console.log(`\nنتیجه: ${fixed} کاور تعمیر شد · ${failed} ناموفق${DRY ? " (dry)" : ""}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

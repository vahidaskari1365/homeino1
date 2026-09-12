#!/usr/bin/env node
// ============================================================
// compress-product-pool — فشرده‌سازی عکس‌های public/images/product-pins
// عرض ≤۱۰۰۰px، JPEG q78 — تا ریپو و دیپلوی سبک بماند.
// فایل‌های خروجی: <name>.jpg (png/webp/avif به jpg یکدست تبدیل می‌شوند)
// سپس مسیرهای استخر (pool._products) به نام‌های جدید اصلاح می‌شوند.
// اجرا: node scripts/compress-product-pool.mjs
// ============================================================
import { readFileSync, writeFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const IMG_DIR = join(ROOT, "public", "images", "product-pins");
const POOL_FILE = join(ROOT, "scripts", "inspiration-pool.json");

async function main() {
  const files = readdirSync(IMG_DIR).filter((f) => /\.(png|jpe?g|webp|avif)$/i.test(f));
  console.log(`${files.length} فایل — فشرده‌سازی…`);
  let savedBytes = 0;
  for (const f of files) {
    const src = join(IMG_DIR, f);
    const dest = join(IMG_DIR, basename(f).replace(/\.(png|jpe?g|webp|avif)$/i, "") + ".jpg");
    const before = statSync(src).size;
    const buf = await sharp(src)
      .rotate()
      .resize({ width: 1000, withoutEnlargement: true })
      .jpeg({ quality: 78, mozjpeg: true })
      .toBuffer();
    const after = buf.length;
    if (dest !== src || after < before) {
      writeFileSync(dest, buf);
      if (dest !== src) rmSync(src);
      savedBytes += before - after;
    }
    process.stdout.write(`  ${basename(dest)}: ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB\n`);
  }
  // اصلاح مسیرهای استخر پس از تغییر پسوندها
  const doc = JSON.parse(readFileSync(POOL_FILE, "utf8"));
  let fixed = 0;
  for (const items of Object.values(doc.pool._products ?? {})) {
    for (const p of items) {
      const m = p.url.match(/^(\/images\/product-pins\/c\d+-\d+)\.(png|jpe?g|webp|avif)$/i);
      if (m && m[2].toLowerCase() !== "jpg") { p.url = `${m[1]}.jpg`; fixed++; }
    }
  }
  writeFileSync(POOL_FILE, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(`\n✓ صرفه‌جویی: ${(savedBytes / 1e6).toFixed(1)}MB | مسیرهای اصلاح‌شده در استخر: ${fixed}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

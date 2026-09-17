#!/usr/bin/env node
// ============================================================
// serper-pool-topup — شارژ استخر عکس ایجنت الهام با serper.dev
// ============================================================
// استخر inspiration-pool.json (style × room) مصرف می‌شود؛ وقتی یک ترک
// ته کشیده باشد ایجنت آن ترکیب را رد می‌کند (ستاره‌گیری صفر). این اسکریپت:
//   1) هر ترک کم‌عروده (کمتر از --min، پیش‌فرض ۱۲) را پیدا می‌کند
//   2) با serper.dev (گوگل‌ایمیج) برای همان سبک×فضا عکس تازه می‌گیرد
//   3) هر کاندید را واقعاً دانلود می‌کند تا مطمئن شود URL زنده و عکس واقعی است
//      (هات‌لینِ مرده و واترمارکِ استوک قبول نمی‌شود) — سپس فایل موقت پاک می‌شود
//   4) نتیجه را به استخر اضافه و فایل را می‌نویسد
//
// کلید: env SERPER_API_KEY (رایگان ۲,۵۰۰ کوئری — serper.dev، بدون کارت)
// بدون کلید: اسکریپت صادقانه خارج می‌شود و هیچ چیزی را تغییر نمی‌دهد.
// اجرا: node scripts/serper-pool-topup.mjs [--min 12] [--max-add 60]
// ============================================================
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { serperKey, serperImages, pickImageCandidate, downloadImage } from "./lib/serper.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const POOL_FILE = path.join(REPO, "scripts", "inspiration-pool.json");

// فیلتر عکس‌های استوک واترمارک‌دار — مثل زنجیره کاور مجله
const STOCK_DOMAINS = /(dreamstime|shutterstock|gettyimages|istockphoto|123rf|alamy|depositphotos|stock\.adobe|freepik|bigstockphoto|colourbox|agefotostock|photos\.com|stockcake|vecteezy)\.?/i;

const ROOMS = {
  "پذیرایی": "living room",
  "اتاق خواب": "bedroom",
  "ناهارخوری": "dining room",
  "فضای کار": "home office",
  "بیرونی": "outdoor patio garden",
};

function argNum(flag, dflt) {
  const i = process.argv.indexOf(flag);
  return i !== -1 ? Math.max(1, parseInt(process.argv[i + 1]) || dflt) : dflt;
}
const MIN_PER_TRACK = argNum("--min", 12);
const MAX_ADD = argNum("--max-add", 60);

async function main() {
  if (!serperKey()) {
    console.log("serper-pool-topup] SERPER_API_KEY نیست — هیچ کاری انجام نشد (کلید رایگان: serper.dev)");
    process.exit(0);
  }
  const db = JSON.parse(fs.readFileSync(POOL_FILE, "utf8"));
  const pool = db.pool ?? {};
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "homeino-topup-"));

  // شمارش + URLهای موجود (ضدتکرار)
  const existingUrls = new Set();
  const starved = [];
  for (const [style, rooms] of Object.entries(pool)) {
    if (style.startsWith("_") || typeof rooms !== "object" || !rooms) continue;
    for (const [room, arr] of Object.entries(rooms)) {
      if (!Array.isArray(arr)) continue;
      for (const it of arr) existingUrls.add(it?.url);
      if (arr.length < MIN_PER_TRACK && ROOMS[room]) starved.push({ style, room, have: arr.length });
    }
  }
  console.log(`serper-pool-topup] ترک‌های کم‌عروده (<${MIN_PER_TRACK}): ${starved.length}`);

  let added = 0;
  const report = [];
  for (const { style, room, have } of starved) {
    if (added >= MAX_ADD) break;
    const need = Math.min(MIN_PER_TRACK - have, MAX_ADD - added, 8);
    const q = `${ROOMS[room]} interior design ${style} style`;
    const imgs = await serperImages(q, { num: 16 });
    if (!imgs) { console.log(`  serper failed: ${q}`); continue; }
    const cands = pickImageCandidate(imgs, { minWidth: 800, minHeight: 540, landscape: true, maxTries: 10 });
    let ok = 0;
    for (const c of cands) {
      if (ok >= need || added >= MAX_ADD) break;
      if (existingUrls.has(c.url) || STOCK_DOMAINS.test(c.source || "") || STOCK_DOMAINS.test(c.url)) continue;
      // اعتبارسنجی واقعی: دانلود کامل + جادوبایت + ابعاد — بعد پاک شدن
      const probe = await downloadImage(c.url, path.join(tmpDir, "probe.img"), { minW: 800, minH: 540 });
      if (!probe.ok) continue;
      const domain = (() => { try { return new URL(c.url).hostname.replace("www.", ""); } catch { return "web"; } })();
      (pool[style][room] = pool[style][room] || []).push({ url: c.url, source: c.source || domain });
      existingUrls.add(c.url);
      existingUrls.add(c.url.replace(/^https?:/, "http:"));
      added++; ok++;
    }
    report.push({ track: `${style}/${room}`, have, added: ok });
    console.log(`  ${style}/${room}: داشت ${have} ← +${ok}`);
  }

  fs.rmSync(tmpDir, { recursive: true, force: true });
  if (added === 0) {
    console.log("serper-pool-topup] هیچ URL تازه‌ای قبول نشد — فایل دست‌نخورده ماند");
    process.exit(0);
  }
  db._comment = db._comment ?? "استخر عکس ایجنت الهام";
  db._topup = { at: new Date().toISOString(), added, via: "serper", tracks: report.length };
  fs.writeFileSync(POOL_FILE, `${JSON.stringify(db, null, 2)}\n`, "utf8");
  console.log(`serper-pool-topup] ✓ ${added} عکس تازه به ${report.length} ترک اضافه شد`);
}

main().catch((e) => {
  console.error("serper-pool-topup] FATAL", e?.message ?? e);
  process.exit(1);
});

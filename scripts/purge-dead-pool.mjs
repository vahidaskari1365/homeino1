#!/usr/bin/env node
// ============================================================
// purge-dead-pool — پالایش استخر عکس الهام از URLهای مرده
// ============================================================
// لینک‌های z-cdn/chatglm بعد از چند ساعت/روز منقضی می‌شوند و استخر را
// «پوسیده» می‌کنند (ناظر سایت: سلامت استخر عکس ❌). این اسکریپت:
//   ① همهٔ URLهای http استخر را موازی HEAD می‌زند (کش زنده/مرده)
//   ② هر URL مرده را از استخر حذف می‌کند + آمار را چاپ می‌کند
//   ③ دامنه‌های شناخته‌شدهٔ پایدار (pinimg/لوکال) را بدون چک نگه می‌دارد
//      مگر --check-all داده شود
// اجرا: node scripts/purge-dead-pool.mjs [--check-all] [--dry]
// ============================================================
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const POOL_FILE = join(ROOT, "scripts", "inspiration-pool.json");
const DRY = process.argv.includes("--dry");
const CHECK_ALL = process.argv.includes("--check-all");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoInspirationBot/1.0; +https://homeino.ir)" };

// دامنه‌هایی که به تجربهٔ ایجنت‌ها (recon-harvest/تست دانلود) پایدارند — پیش‌فرض چک نمی‌شوند
const STABLE_RE = /^https?:\/\/(i\.pinimg\.com|images\.pexels\.com|images\.unsplash\.com|cdn\.pixabay\.com|upload\.wikimedia\.org|live\.staticflickr\.com|images\.adsttc\.com|cdn\.home-designing\.com)\//i;

// دامنه‌های محکوم‌به‌انقضا (Task 75) — لینک‌های امضادار/زمان‌دار که حتی اگر الان
// زنده باشند تا چند ساعت/روز آینده می‌میرند و استخر را «پوسیده» می‌کنند. بدون
// HEAD حذف می‌شوند تا چرخ‌لنگهٔ پوسیدگی برای همیشه بسته بماند.
const DOOMED_RE = /^https?:\/\/([a-z0-9-]+\.)*z-cdn\.chatglm\.cn\//i;

const doc = JSON.parse(readFileSync(POOL_FILE, "utf8"));
const pool = doc.pool || {};

// ---------- جمع‌آوری URLها ----------
const urls = new Map(); // url → [path-in-pool]
for (const [st, spaces] of Object.entries(pool)) {
  for (const [sp, items] of Object.entries(spaces)) {
    for (const it of items) {
      if (!it?.url?.startsWith("http")) continue;
      if (!urls.has(it.url)) urls.set(it.url, []);
      urls.get(it.url).push([st, sp]);
    }
  }
}
const doomedCount = [...urls.keys()].filter((u) => DOOMED_RE.test(u)).length;
const toCheck = [...urls.keys()].filter((u) => CHECK_ALL || (!STABLE_RE.test(u) && !DOOMED_RE.test(u)));
console.log(`استخر: ${Object.keys(pool).length} کلید | ${urls.size} URL یکتا | چک: ${toCheck.length}${CHECK_ALL ? " (همه)" : " (پایدارها مستثنا)"}${doomedCount ? ` | محکوم‌به‌انقضا (بدون چک حذف): ${doomedCount}` : ""}`);

// ---------- HEAD موازی ----------
const alive = new Set();
let idx = 0;
async function worker() {
  while (idx < toCheck.length) {
    const u = toCheck[idx++];
    try {
      const r = await fetch(u, { method: "HEAD", headers: UA, redirect: "follow", signal: AbortSignal.timeout(7000) });
      if (r.ok) alive.add(u);
      else if (r.status === 405) {
        // بعضی سرورها HEAD را رد می‌کنند — GET سبک
        const g = await fetch(u, { headers: UA, redirect: "follow", signal: AbortSignal.timeout(9000) }).catch(() => null);
        if (g?.ok) alive.add(u);
        try { await g?.body?.cancel(); } catch {}
      }
    } catch { /* مرده */ }
  }
}
const t0 = Date.now();
await Promise.all(Array.from({ length: 16 }, worker));
console.log(`چک تمام شد در ${Math.round((Date.now() - t0) / 1000)}s — زنده: ${alive.size} / مرده: ${toCheck.length - alive.size}`);

// ---------- حذف مرده‌ها ----------
let removed = 0;
const removedByDomain = {};
for (const [st, spaces] of Object.entries(pool)) {
  for (const [sp, items] of Object.entries(spaces)) {
    if (!Array.isArray(items)) continue;
    const kept = items.filter((it) => {
      const u = it?.url;
      if (!u?.startsWith("http")) return true; // لوکال می‌ماند
      if (DOOMED_RE.test(u)) {
        // محکوم‌به‌انقضا — بدون چک حذف (Task 75)
        removed++;
        const d = new URL(u).hostname;
        removedByDomain[d] = (removedByDomain[d] || 0) + 1;
        return false;
      }
      if (!toCheck.includes(u)) return true; // پایدار یا اصلاً چک نشده
      if (alive.has(u)) return true;
      removed++;
      const d = new URL(u).hostname;
      removedByDomain[d] = (removedByDomain[d] || 0) + 1;
      return false;
    });
    spaces[sp] = kept;
  }
}
console.log(`حذف‌شده: ${removed}`, removedByDomain);
if (!DRY && removed > 0) {
  writeFileSync(POOL_FILE, JSON.stringify(doc, null, 2) + "\n", "utf8");
  console.log("→ inspiration-pool.json پالایش شد");
} else if (DRY) {
  console.log("[dry] فایل نوشته نشد");
}

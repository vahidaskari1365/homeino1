#!/usr/bin/env node
// ============================================================
// HOMEINO — نگهبان روزانه محتوا (watchdog)
// هر روز دو بار: سلامت ایجنت‌های محتوا را می‌سنجد؛
// اگر مشکلی باشد «ایسوی هشدار» می‌سازد/به‌روز می‌کند و وقتی برطرف شد می‌بندد.
//
// چک‌ها: ① تازگی پین‌های الهام (≤۳۶ ساعت) ② تازگی بریف مجله (≤۴۸ ساعت)
// ③ باقیمانده استخر عکس (≥۴۰) ④ نزدیکی انقضای توکن مانیتورینگ (متغیر PAT_EXPIRES_AT)
//
// آلارم = خروج ۱ (اجرای قرمز در Actions) + ایسو. فقط GITHUB_TOKEN لازم دارد
// (مستقل از توکن شخصی — پس انقضای توکن هرگز خودِ هشدار را خاموش نمی‌کند).
// اجرا: node scripts/watchdog.mjs
// ============================================================
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const now = Date.now();
const ISSUE_TITLE = "🚨 نگهبان هومینو — محتوای خودکار مشکل دارد";

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", timeout: 60000 });
}

const checks = [];

// ① تازگی پین‌های الهام
let pinImages = new Set();
try {
  const pins = JSON.parse(readFileSync(join(ROOT, "src/data/inspirations.generated.json"), "utf8"));
  for (const p of pins) pinImages.add(p.image);
  const agentPins = pins.filter((p) => p.author?.type === "agent" && p.createdAt);
  const last = agentPins.length ? Math.max(...agentPins.map((p) => Date.parse(p.createdAt))) : 0;
  const hours = Math.floor((now - last) / 36e5);
  checks.push({
    name: "پین‌های الهام",
    ok: hours <= 36,
    detail: `آخرین پین ${hours} ساعت پیش — ${agentPins.length} پین ایجنت در سایت`,
  });
} catch (e) {
  checks.push({ name: "پین‌های الهام", ok: false, detail: "خطا: " + e.message });
}

// ② تازگی بریف مجله
try {
  const t = JSON.parse(readFileSync(join(ROOT, "src/content/trends/trends.json"), "utf8"));
  const briefs = t.briefs || [];
  const last = briefs.length ? Date.parse(briefs[0].date + "T12:00:00Z") : 0;
  const hours = Math.floor((now - last) / 36e5);
  checks.push({
    name: "بریف‌های مجله",
    ok: hours <= 48,
    detail: `آخرین بریف ${hours} ساعت پیش — ${briefs.length} بریف کل`,
  });
} catch (e) {
  checks.push({ name: "بریف‌های مجله", ok: false, detail: "خطا: " + e.message });
}

// ③ استخر عکس الهام
try {
  const poolDoc = JSON.parse(readFileSync(join(ROOT, "scripts/inspiration-pool.json"), "utf8"));
  let remaining = 0;
  for (const spaces of Object.values(poolDoc.pool || {})) {
    for (const items of Object.values(spaces)) {
      remaining += items.filter((p) => !pinImages.has(p.url)).length;
    }
  }
  checks.push({
    name: "استخر عکس الهام",
    ok: remaining >= 40,
    detail: `${remaining} عکس مصرف‌نشده — شارژ با scripts/expand-inspiration-pool.py`,
  });
} catch (e) {
  checks.push({ name: "استخر عکس الهام", ok: false, detail: "خطا: " + e.message });
}

// ④ انقضای توکن شخصی مانیتورینگ
const patExp = process.env.PAT_EXPIRES_AT || "";
if (patExp) {
  const days = Math.floor((Date.parse(patExp + "T00:00:00Z") - now) / 864e5);
  checks.push({
    name: "انقضای توکن مانیتورینگ",
    ok: days > 7,
    detail: days > 0 ? `${days} روز مانده (تا ${patExp})` : `منقضی شده (${patExp}) — توکن جدید لازم است`,
  });
} else {
  checks.push({ name: "انقضای توکن مانیتورینگ", ok: true, detail: "متغیر PAT_EXPIRES_AT تنظیم نشده — بی‌اثر" });
}

const alarm = checks.some((c) => !c.ok);
const icon = (ok) => (ok ? "✅" : "❌");
const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";

const body = [
  "گزارش خودکار نگهبان محتوا — آخرین بررسی: `" + stamp + "`",
  "",
  "| چک | وضعیت | جزئیات |",
  "|---|---|---|",
  ...checks.map((c) => `| ${c.name} | ${icon(c.ok)} | ${c.detail} |`),
  "",
  alarm
    ? "**اقدام لازم:** لاگ اجرای ورک‌فلوها را ببینید (Actions → magazine-daily / inspiration-daily). برای استخر عکس: اسکریپت `scripts/expand-inspiration-pool.py` را در سندباکس اجرا کنید. برای توکن: PAT جدید بسازید و متغیر `PAT_EXPIRES_AT` را به‌روز کنید."
    : "همه‌چیز سالم است — این ایسو به‌محض سلامت بعدی بسته خواهد شد.",
].join("\n");

let existing = null;
try {
  const list = JSON.parse(gh(["issue", "list", "--state", "open", "--json", "number,title", "--limit", "50"]));
  existing = (list || []).find((i) => i.title === ISSUE_TITLE);
} catch (e) {
  console.log("⚠ جستجوی ایسو ناموفق:", e.message);
}

if (alarm && !existing) {
  gh(["issue", "create", "--title", ISSUE_TITLE, "--body", body]);
  console.log("🚨 آلارم: ایسوی هشدار ساخته شد");
} else if (alarm && existing) {
  gh(["issue", "edit", String(existing.number), "--body", body]);
  console.log(`🚨 آلارم: ایسوی #${existing.number} به‌روز شد`);
} else if (!alarm && existing) {
  gh(["issue", "close", String(existing.number), "--comment", "✅ همه‌چیز سالم شد — این ایسو خودکار بسته شد."]);
  console.log(`✅ سلامت برقرار — ایسوی #${existing.number} بسته شد`);
} else {
  console.log("✅ همه‌چیز سالم — ایسویی لازم نبود");
}

for (const c of checks) console.log(`${icon(c.ok)} ${c.name}: ${c.detail}`);
process.exit(alarm ? 1 : 0);

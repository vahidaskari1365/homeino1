#!/usr/bin/env node
/**
 * نهایی‌سازی state ناتمام ران کشته‌شدهٔ trend-cover-repair (timeout وسط کار):
 *  -zitwb0: کاور در trends.json هنوز .png است ولی فایل جدید .jpg ساخته شده (png حذف شده)
 *  -h8mxta/ze351w/zitwb0: امتیاز QA واقعی از stdout ران (۹/۹/۶) در گزارش ثبت نشد
 *  -رجیستری md5 هم باید با md5 تازهٔ فایل‌ها هم‌گام شود
 * اجرا: node scripts/finalize-cover-fix.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { REPO_ROOT, loadRegistry, saveRegistry } from "./lib/cover-pipeline.mjs";

const TRENDS = path.join(REPO_ROOT, "src/content/trends/trends.json");
const QA_REPORT = path.join(REPO_ROOT, "scripts/trend-cover-qa-report.json");

const md5 = (p) => createHash("md5").update(fs.readFileSync(p)).digest("hex");

// امتیازهای QA واقعی از خروجی ران کشته‌شده (timeout 575s پس از [4/14])
const REAL_QA = {
  "2026-09-20-h8mxta": { score: 9, textHeavy: false },
  "2026-09-20-ze351w": { score: 9, textHeavy: false },
  "2026-09-20-zitwb0": { score: 6, textHeavy: false },
};

const doc = JSON.parse(fs.readFileSync(TRENDS, "utf8"));
const qa = JSON.parse(fs.readFileSync(QA_REPORT, "utf8"));
const reg = loadRegistry();

for (const b of doc.briefs) {
  const r = REAL_QA[b.slug];
  if (!r) continue;
  // zitwb0: png → jpg (فایل png توسط ران حذف شده)
  const cur = path.join(REPO_ROOT, "public", b.cover);
  if (!fs.existsSync(cur)) {
    const alt = b.cover.replace(/\.png$/, ".jpg");
    if (fs.existsSync(path.join(REPO_ROOT, "public", alt))) {
      console.log(`مسیر کاور اصلاح شد: ${b.slug} ${b.cover} → ${alt}`);
      b.cover = alt;
    } else {
      console.log(`⚠ فایل کاور ${b.slug} پیدا نشد — رها شد`);
      continue;
    }
  }
  qa[b.slug] = { cover: b.cover, title: b.title, ...r };
  const abs = path.join(REPO_ROOT, "public", b.cover);
  reg.byPath[b.cover] = { md5: md5(abs), slug: b.slug };
  reg.byMd5[md5(abs)] = b.cover;
  console.log(`✓ ${b.slug} — cover=${b.cover} QA=${r.score}`);
}

fs.writeFileSync(TRENDS, JSON.stringify({ briefs: doc.briefs }, null, 2) + "\n", "utf8");
fs.writeFileSync(QA_REPORT, JSON.stringify(qa, null, 2) + "\n", "utf8");
saveRegistry(reg);
console.log("state نهایی شد");

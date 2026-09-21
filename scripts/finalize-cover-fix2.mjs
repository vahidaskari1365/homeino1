#!/usr/bin/env node
/**
 * نهایی‌سازی v2 — QA مستقیم فایل‌های تازهٔ ران کشته‌شده + ثبت امتیاز واقعی
 * خروجی: گزارش QA هم‌گام با فایل‌ها → صف تعویض بعدی فقط k7vdcq/rlvgv1 (و ناپذیرفته‌ها)
 * اجرا: node scripts/finalize-cover-fix2.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { REPO_ROOT } from "./lib/cover-pipeline.mjs";

const pExecFile = promisify(execFile);
const QA_REPORT = path.join(REPO_ROOT, "scripts/trend-cover-qa-report.json");
const TRENDS = path.join(REPO_ROOT, "src/content/trends/trends.json");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function vision(imagePath, title, tries = 4) {
  const out = path.join("/tmp", `fin-${path.basename(imagePath)}.json`);
  for (let i = 0; i < tries; i++) {
    try {
      await pExecFile("z-ai", ["vision", "-p",
        `این عکس باید کاور مقالهٔ ترند دکوراسیون «${title}» باشد. فقط JSON: {"score": ۰تا۱۰ ارتباط با موضوع, "textHeavy": کلاژ/بنر پر از متن یا لوگو؟}`,
        "-i", imagePath, "-o", out], { timeout: 90_000 });
      const j = JSON.parse(fs.readFileSync(out, "utf8"));
      const m = (j?.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no-json");
      const p = JSON.parse(m[0]);
      return { score: Math.max(0, Math.min(10, Number(p.score) || 0)), textHeavy: Boolean(p.textHeavy) };
    } catch (e) {
      if (i < tries - 1) await sleep(/429/.test(String(e?.message)) ? 12_000 : 4_000);
    }
  }
  return null;
}

// فایل‌های تازهٔ ران کشته‌شده (mtime امروز، گزارش QA قدیمی)
const TARGETS = [
  "2026-09-18-urban-utility-suv",
  "2026-09-18-ci5t88",
  "2026-09-20-0fcfm4",
];

const qa = JSON.parse(fs.readFileSync(QA_REPORT, "utf8"));
const doc = JSON.parse(fs.readFileSync(TRENDS, "utf8"));
const briefOf = Object.fromEntries(doc.briefs.map((b) => [b.slug, b]));

for (const slug of TARGETS) {
  const b = briefOf[slug];
  if (!b) continue;
  const p = path.join(REPO_ROOT, "public", b.cover);
  if (!fs.existsSync(p)) { console.log(`✗ فایل نیست: ${slug}`); continue; }
  const v = await vision(p, b.title);
  if (!v) { console.log(`⚠ QA ناموفق (نرخ/شبکه): ${slug} — گزارش دست‌نخورده`); continue; }
  qa[slug] = { cover: b.cover, title: b.title, ...v };
  console.log(`${v.score >= 8 || (v.score >= 6 && !v.textHeavy) ? "✓ قبول" : "✕ رد"} ${slug} — QA=${v.score}${v.textHeavy ? " پرمتن" : ""}`);
  await sleep(3000);
}

fs.writeFileSync(QA_REPORT, JSON.stringify(qa, null, 2) + "\n", "utf8");
console.log("گزارش QA به‌روز شد");

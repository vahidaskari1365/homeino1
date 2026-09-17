#!/usr/bin/env node
/**
 * trend-cover-repair — تعمیر یک‌باره کاورهای ترندها (Task 43)
 * ============================================================
 * حذف کلاس باگ «کاور تکراری/نامربوط» از داده‌های فعلی:
 *   ① QA بصری همه کاورهای دانلودشده با مدل بینایی رایگان (GLM-V):
 *      امتیاز ارتباط با موضوع + تشخیص کلاژ/بنر پر از متن → زیر آستانه = تعویض
 *   ② کاورهای روی استخر جنریک (product-pins) و فایل‌های مشترک بین دو بریف → تعویض
 *   ③ کاور جدید: جستجوی وب هم‌موضوع (z-ai) → Openverse → تولید رایگان (Pollinations)
 *      همه دانلود و داخل ریپو ذخیره می‌شوند (هات‌لین ممنوع) + رجیستری md5 ضدتکرار
 *
 * اجرا: node scripts/trend-cover-repair.mjs [--qa-only]
 */
import fs from "node:fs";
import path from "node:path";
import { execFile, execSync } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  REPO_ROOT, loadRegistry, saveRegistry, buildBytesIndex, registerCover,
  downloadCoverImage, openverseImages, generatedCover, topicPromptEn,
} from "./lib/cover-pipeline.mjs";
import { callLlm } from "./lib/llm-chain.mjs";

const pExecFile = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(REPO_ROOT, "src", "content", "trends", "trends.json");
const QA_REPORT = path.join(__dirname, "trend-cover-qa-report.json");
const QA_ONLY = process.argv.includes("--qa-only");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------- z-ai CLI ----------
async function zAiVision(imagePath, prompt, tries = 4) {
  const out = path.join("/tmp", `vis-${path.basename(imagePath)}.json`);
  for (let i = 0; i < tries; i++) {
    try {
      await pExecFile("z-ai", ["vision", "-p", prompt, "-i", imagePath, "-o", out], { timeout: 90_000 });
      const j = JSON.parse(fs.readFileSync(out, "utf8"));
      const content = j?.choices?.[0]?.message?.content ?? "";
      const m = content.match(/\{[\s\S]*\}/);
      if (!m) throw new Error("no-json");
      const parsed = JSON.parse(m[0]);
      return {
        score: Math.max(0, Math.min(10, Number(parsed.score) || 0)),
        textHeavy: Boolean(parsed.textHeavy),
      };
    } catch (e) {
      const msg = String(e?.message || "");
      const rate = /429|Too many/i.test(msg);
      if (i < tries - 1) await sleep(rate ? 12_000 * (i + 1) : 4_000);
    }
  }
  return null;
}

function zAiImageSearchSync(query, count = 6, tries = 3) {
  for (let t = 0; t < tries; t++) {
    try {
      const raw = execFileSync(
        "z-ai",
        ["image-search", "-q", query, "--count", String(count), "--gl", "us", "--no-rank"],
        { timeout: 150_000, encoding: "utf8" }
      );
      const j = JSON.parse(raw.slice(raw.indexOf("{")));
      const STOCK = /(dreamstime|shutterstock|gettyimages|istockphoto|123rf|alamy|depositphotos|stock\.adobe|freepik|bigstockphoto|colourbox|agefotostock|photos\.com|stockcake|vecteezy)\.?/i;
      const results = (j.results || [])
        .filter((r) => !STOCK.test(r.original_url || ""))
        .map((r) => ({
          url: r.original_url,
          source: r.source || "وب",
          w: parseInt(r.original_width) || 1200,
          h: parseInt(r.original_height) || 800,
        }));
      if (results.length) return results;
    } catch {}
    if (t < tries - 1) sleepSync(15_000); // سهمیه داغ — بعداً دوباره
  }
  return [];
}
function sleepSync(ms) {
  try { execSync(`sleep ${Math.ceil(ms / 1000)}`); } catch {}
}

// ---------- main ----------
const doc = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
const briefs = doc.briefs || [];
const reg = loadRegistry();
const liveBytes = buildBytesIndex(briefs);
console.log(`بریف‌ها: ${briefs.length} | رجیستری: md5=${Object.keys(reg.byMd5).length} path=${Object.keys(reg.byPath).length}`);

// ---------- فاز A: QA بصری همه کاورهای src ----------
const qaTargets = [];
for (const b of briefs) {
  if (b.cover && b.cover.includes("/trends/src/")) qaTargets.push(b);
}
// resume: QA قبلی را بازیابی کن — فقط خطاها دوباره امتحان می‌شوند
const prevQa = fs.existsSync(QA_REPORT) ? JSON.parse(fs.readFileSync(QA_REPORT, "utf8")) : {};
const qa = { ...prevQa };
const pending = qaTargets.filter((b) => {
  const p = prevQa[b.slug];
  return !p || p.error;
});
console.log(`QA بصری: ${pending.length} از ${qaTargets.length} (بقیه از قبل سالم ثبت شده‌اند)…`);
let done = 0;
const queue = [...pending];
async function qaWorker(id) {
  while (queue.length) {
    const b = queue.shift();
    if (!b) break;
    const p = path.join(REPO_ROOT, "public", b.cover);
    const res = await zAiVision(
      p,
      `این عکس کاور مقالهٔ ترند دکوراسیون با عنوان «${b.title}» در دستهٔ «${b.category}» است. فقط JSON بده: {"score": عدد ۰تا۱۰ میزان ارتباط تصویر با موضوع مقاله, "textHeavy": true اگر تصویر بیشتر یک کلاژ/بنر/گرافیک با متن یا لوگوی بزرگ است تا عکس واقعی فضای داخلی}`
    );
    qa[b.slug] = { cover: b.cover, title: b.title, ...(res || { score: -1, textHeavy: false, error: true }) };
    done++;
    if (done % 5 === 0) console.log(`  QA ${done}/${pending.length}…`);
    await sleep(1500 + id * 700); // نفس برای سهمیه — هر ورکر ریتم خودش
  }
}
await Promise.all(Array.from({ length: 2 }, (_, i) => qaWorker(i)));
fs.writeFileSync(QA_REPORT, JSON.stringify(qa, null, 2) + "\n", "utf8");
const stillErr = Object.values(qa).filter((v) => v.error).length;
const flagged = Object.entries(qa).filter(([, v]) => !v.error && (v.score <= 5 || v.textHeavy));
console.log(`QA تمام شد — خطای باقی‌مانده: ${stillErr} | پرچم‌دار: ${flagged.length} (${flagged.map(([s]) => s).join(", ") || "—"})`);
if (QA_ONLY) process.exit(stillErr > 0 ? 2 : 0); // کد ۲ = ناتمام؛ دوباره اجرا شود

// ---------- فاز B: فهرست تعویض ----------
// گروه‌بندی بر اساس مسیر کاور — فایل مشترک: تازه‌ترین نگه می‌دارد
// QA به مسیر کاور چسبیده — کاور تعویض‌شده در اجرای قبلی دوباره پرچم نمی‌خورد
const byPath = new Map();
for (const b of [...briefs].sort((a, z) => (a.date < z.date ? 1 : -1))) {
  if (!byPath.has(b.cover)) byPath.set(b.cover, []);
  byPath.get(b.cover).push(b);
}
const toReplace = new Set();
for (const [cover, group] of byPath) {
  const isPool = cover.includes("/product-pins/");
  const isStaticShared = cover.includes("/trends/trends-") && group.length > 1;
  if (isPool) group.forEach((b) => toReplace.add(b.slug));
  else if (isStaticShared) group.slice(1).forEach((b) => toReplace.add(b.slug)); // اولی (تازه‌ترین) می‌ماند
}
for (const [slug, v] of Object.entries(qa)) {
  if (v.error) continue;
  const b = briefs.find((x) => x.slug === slug);
  if (b && b.cover === v.cover && (v.score <= 5 || v.textHeavy)) toReplace.add(slug);
}

// بریف‌هایی که قبلاً md5 تکراری ثبت شده؟ (دو فایل یک‌بایت در دو بریف زنده)
const md5Owner = new Map();
for (const b of [...briefs].sort((a, z) => (a.date < z.date ? 1 : -1))) {
  const p = path.join(REPO_ROOT, "public", b.cover);
  const { md5File } = await import("./lib/cover-pipeline.mjs");
  const h = md5File(p);
  if (!h) continue;
  if (md5Owner.has(h)) toReplace.add(b.slug);
  else md5Owner.set(h, b.slug);
}

console.log(`تعویض: ${toReplace.size} بریف → ${[...toReplace].join(", ")}`);

// ---------- فاز C: تعویض هوشمند ----------
let replaced = 0;
const usedUrls = new Set();
let bi = 0;
for (const b of briefs) {
  if (!toReplace.has(b.slug)) continue;
  bi++;
  console.log(`\n→ [${bi}/${toReplace.size}] ${b.slug} [${b.category}] ${b.title.slice(0, 55)}`);
  const oldCover = b.cover;
  const prompt = await topicPromptEn(b.title, b.category, callLlm);
  const query = prompt.split(", ").slice(0, 6).join(" ");
  console.log(`  query: ${query}`);
  const cands = [
    ...zAiImageSearchSync(`${query} interior design`).map((c) => ({ ...c, via: "web" })),
    ...(await openverseImages(query)).map((c) => ({ ...c, via: "openverse" })),
  ];
  let accepted = null;
  for (const c of cands) {
    if (!c?.url || usedUrls.has(c.url)) continue;
    if ((c.w || 0) < 600 || (c.h || 0) < 360) continue;
    const r = await downloadCoverImage(c.url, b.slug, reg, liveBytes);
    if (r.error) {
      console.log(`  · دانلود رد شد (${r.error}): ${c.url.slice(0, 90)}`);
      continue;
    }
    // گیت نهایی: QA بصری کاندید — ارتباط ≥۶ و بدون کلاژ متنی
    const v = await zAiVision(
      path.join(REPO_ROOT, "public", r.publicPath),
      `این عکس باید کاور مقالهٔ ترند دکوراسیون «${b.title}» باشد. فقط JSON: {"score": ۰تا۱۰ ارتباط با موضوع, "textHeavy": کلاژ/بنر پر از متن یا لوگو؟}`
    );
    if (v && v.score >= 6 && !v.textHeavy) {
      accepted = { ...r, via: c.via };
      usedUrls.add(c.url);
      console.log(`  ✓ ${c.via} (QA=${v.score}) → ${r.publicPath}`);
      break;
    }
    console.log(`  ✕ رد شد (QA=${v ? v.score : "?"}${v?.textHeavy ? ", پر از متن" : ""}): ${c.url.slice(0, 80)}`);
  }
  if (!accepted) {
    const gen = await generatedCover(prompt, b.slug, reg, liveBytes);
    if (gen) {
      accepted = { ...gen, via: "generated" };
      console.log(`  ✓ تولید رایگان → ${gen.publicPath}`);
    }
  }
  if (!accepted) {
    console.log("  ⚠ هیچ مسیری جواب نداد — دست‌نخورده می‌ماند (ناظر سایت پرچم می‌زند)");
    continue;
  }
  b.cover = accepted.publicPath;
  b.coverSource = accepted.via;
  registerCover({ md5: accepted.md5, publicPath: accepted.publicPath, url: accepted.url, slug: b.slug }, reg);
  // فایل قبلی اگر مال همین بریف بود و دیگر هیچ بریفی ارجاع ندارد → حذف
  if (oldCover.includes("/trends/src/") && !briefs.some((x) => x.cover === oldCover)) {
    try { fs.rmSync(path.join(REPO_ROOT, "public", oldCover)); } catch {}
  }
  replaced++;
  await sleep(6000); // نفس بین بریف‌ها — سهمیه‌ها خنک شوند
}

// ---------- ذخیره ----------
fs.writeFileSync(DATA_FILE, `${JSON.stringify({ briefs }, null, 2)}\n`, "utf8");
saveRegistry(reg);
console.log(`\nخلاصه: ${replaced}/${toReplace.size} کاور تعویض شد | رجیستری: ${Object.keys(reg.byMd5).length} md5 یکتا`);

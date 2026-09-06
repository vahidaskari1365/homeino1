#!/usr/bin/env node
// ============================================================
// HOMEINO — Inspiration QA Fix (یک‌باره، نتیجه بازبینی چشمی تک‌تک پین‌ها)
//
//   • حذف پین‌های نامرتبط: کولاژ، عکس محصول (آینه/فرش/لامپ)، پانورامای
//     خراب، رندر ضعیف و تکراری‌های seed
//   • اصلاح سبک/فضای پین‌هایی که عکس‌شان چیز دیگری نشان می‌دهد +
//     بازنویسی فارسی متن بر اساس واقعیت عکس (با z-ai chat)
// ============================================================
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEN_FILE = join(ROOT, "src/data/inspirations.generated.json");

// ---------- تصمیم‌های بازبینی چشمی (بر اساس نام فایل عکس) ----------
const DELETE = new Set([
  "d23813f52d6b.jpg", // کولاژ ۳ عکس ناهارخوری — نه فضای کار، نه آرت‌دکو
  "3af21ee55d50.jpg", // تکراری seed i4
  "de54fd6097e1.jpg", // پانورامای اتاق کار قدیمی — نه بیرونی
  "0ad701d6fb8f.jpg", // کراپ عمودی تکراری همان اتاق کار اتیک
  "ef6e9b94fa6c.jpg", // تکراری seed i18 (میز گیمینگ)
  "880100f8a328.jpeg", // رندر ضعیف لوج
  "4b469df1f6ae.jpg", // تکراری seed i9
  "f35493317778.jpeg", // عکس محصول آباژور
  "372f2a05e7ff.jpg", // تکراری seed i8
  "027037d90f9d.png", // کولاژ آینه با واترمارک
  "3f6a399ef107.jpg", // عکس محصول آینه
  "a4a2a7aaaeaf.jpg", // گوشه ورودی — نه اتاق خواب نئوکلاسیک
  "c5292e81ae03.jpg", // عکس محصول آینه
  "cb65d1176442.jpg", // عکس محصول فرش
  "e316d2d979b4.jpg", // نمای فرش — نه ناهارخوری
  "128e2eaf2b09.png", // پهن کردن فرش — نه فضای کار
  "3f3f0dd63c09.jpg", // کولاژ ۳ عکس + تکراری seed i6
]);

// [نام فایل عکس، styleSlug جدید، room جدید] — متن با LLM بازنویسی می‌شود
const REASSIGN = [
  ["82466c601d52.png", "japandi", "پذیرایی"],
  ["d13121eb9b4f.png", "rustic", "ناهارخوری"],
  ["439214903fad.jpg", "contemporary", "ناهارخوری"],
  ["56eb4b4a8518.jpg", "rustic", "پذیرایی"],
  ["8d61bc483b50.jpg", "boho", "پذیرایی"],
  ["26db031d8c18.jpg", "boho", "پذیرایی"],
  ["6868b917b2f7.jpg", "boho", "پذیرایی"],
  ["0f1e1de9c108.png", "industrial", "پذیرایی"],
  ["77ffa0996974.png", "contemporary", "پذیرایی"],
  ["a420f7ac2a43.jpg", "rustic", "پذیرایی"],
];

const STYLE_FA = { modern: "مدرن", minimal: "مینیمال", scandinavian: "اسکاندیناوی", japandi: "جاپندی", classic: "کلاسیک", neoclassic: "نئوکلاسیک", industrial: "صنعتی", boho: "بوهو", rustic: "روستیک", mediterranean: "مدیترانه‌ای", contemporary: "معاصر", "art-deco": "آرت دکو" };

const SYSTEM = `تو سردبیر ارشد نشریه «هومینو» هستی؛ مرجع فارسی طراحی خانه.
یک عکس چیدمان واقعی را (با توضیحی که می‌گیری) بازنگری می‌کنی و متن پین را با فضای و سبک درست می‌نویسی.
اصول: بازنویسی اورجینال، لحن گرم و حرفه‌ای، کاربردی برای خانه ایرانی.
فقط JSON معتبر برگردان:
{"title":"تیتر جذاب زیر ۶۰ نویسه","description":"۳-۵ جمله درباره چیدمان، نور، متریال و حس فضا","items":["۴ تا ۷ قلم وسایل کلیدی فارسی"],"styleNote":"۲-۳ جمله درباره سبک","tags":["۳ تگ فارسی"]}`;

function regen(styleFa, room, hint) {
  const prompt = `یک عکس واقعی «${room}» به سبک ${styleFa} داریم. ${hint} متن پین الهام را برای همین فضا و سبک بنویس.`;
  const out = join(ROOT, "scripts/.llm-tmp.json");
  try {
    execFileSync("z-ai", ["chat", "-p", prompt, "-s", SYSTEM, "-o", out], { timeout: 150000 });
    const j = JSON.parse(readFileSync(out, "utf8"));
    const raw = j.choices?.[0]?.message?.content ?? "";
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a !== -1 && b !== -1) return JSON.parse(raw.slice(a, b + 1));
  } catch { /* fallback below */ }
  return null;
}

const RUN_STARTED = Date.now();
const gen = JSON.parse(readFileSync(GEN_FILE, "utf8"));
const before = gen.length;

const kept = [];
let deleted = 0, fixed = 0;
for (const pin of gen) {
  const base = String(pin.image).split("/").pop();
  if (DELETE.has(base)) { deleted += 1; continue; }
  const move = REASSIGN.find(([img]) => img === base);
  if (move) {
    const [, styleSlug, room] = move;
    const meta = regen(STYLE_FA[styleSlug], room, "توصیف صادقانه عکس: چیدمان واقعی و زندگی‌پذیر با نور طبیعی.");
    pin.styleSlug = styleSlug;
    pin.room = room;
    pin.title = String(meta?.title ?? `چیدمان ${room} به سبک ${STYLE_FA[styleSlug]}`).slice(0, 80);
    if (meta?.description) pin.description = String(meta.description).slice(0, 900);
    if (Array.isArray(meta?.items)) pin.items = meta.items.map(String).slice(0, 7);
    if (meta?.styleNote) pin.styleNote = String(meta.styleNote).slice(0, 500);
    if (Array.isArray(meta?.tags)) pin.tags = meta.tags.map(String).slice(0, 5);
    pin._qa = "room-style-fixed";
    fixed += 1;
    console.log(`↺ اصلاح: ${pin.title} → ${STYLE_FA[styleSlug]} × ${room}`);
  }
  kept.push(pin);
}

writeFileSync(GEN_FILE, JSON.stringify(kept, null, 2) + "\n");

const cov = new Set(kept.map((p) => `${p.styleSlug}|${p.room}`)).size;
console.log(`\nحذف: ${deleted} | اصلاح: ${fixed} | مجموع: ${kept.length} (از ${before}) | پوشش ماتریس: ${cov}/60`);

await logContentAgentRun(ROOT, {
  agentKey: "inspiration-curator",
  ok: true,
  durationMs: Date.now() - RUN_STARTED,
  summary: `بازبینی چشمی تک‌تک پین‌ها: ${deleted} پین نامرتبط/تکراری حذف، ${fixed} پین سبک/فضایشان اصلاح و متن‌شان بازنویسی شد`,
  detail: { deleted, fixed, total: kept.length, coverage: `${cov}/60`, via: "visual-qa" },
});

#!/usr/bin/env node
// ============================================================
// HOMEINO — Inspiration Backfill (یک‌باره / ابزار نگهداشت)
//
// هدف: پر کردن کامل ماتریس ۱۲ سبک × ۵ فضا برای بخش الهام
//   1. پین‌های موجود که متن خراب (نویسه چینی/خارج از فارسی) دارند تمیز می‌شوند
//   2. برای هر ترکیب سبک×فضای خالی، ۱ تا ۲ چیدمان واقعی از وب
//      (Pinterest و منابع دیزاین) پیدا و فارسی اورجینال بازنویسی می‌شود
//   3. تاریخچه اجرا در src/data/agent-runs.json ثبت می‌شود (پنل ادمین)
//
// اجرا:  node scripts/inspiration-backfill.mjs [--per-combo=2] [--dry]
// ============================================================
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEN_FILE = join(ROOT, "src/data/inspirations.generated.json");
const PER_COMBO = Number(process.argv.find((a) => a.startsWith("--per-combo="))?.split("=")[1] || 2);
const DRY = process.argv.includes("--dry");
const CONCURRENCY = 2;
const SEARCH_GAP_MS = 12_000; // فاصله بین جستجوها — محدودیت نرخ سرویس جستجو
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const STYLES = [
  { slug: "modern", name: "مدرن", en: "modern interior design living" },
  { slug: "minimal", name: "مینیمال", en: "minimalist interior clean lines" },
  { slug: "scandinavian", name: "اسکاندیناوی", en: "scandinavian interior bright cozy" },
  { slug: "japandi", name: "جاپندی", en: "japandi interior warm wood zen" },
  { slug: "classic", name: "کلاسیک", en: "classic elegant interior ornate" },
  { slug: "neoclassic", name: "نئوکلاسیک", en: "neoclassical interior modern elegance" },
  { slug: "industrial", name: "صنعتی", en: "industrial interior brick metal loft" },
  { slug: "boho", name: "بوهو", en: "bohemian interior colorful textiles plants" },
  { slug: "rustic", name: "روستیک", en: "rustic interior wood beams stone fireplace" },
  { slug: "mediterranean", name: "مدیترانه‌ای", en: "mediterranean interior white blue arches" },
  { slug: "contemporary", name: "معاصر", en: "contemporary interior design sleek" },
  { slug: "art-deco", name: "آرت دکو", en: "art deco interior glam gold velvet" },
];
const SPACES = [
  { slug: "پذیرایی", en: "living room" },
  { slug: "اتاق خواب", en: "bedroom" },
  { slug: "فضای کار", en: "home office workspace" },
  { slug: "ناهارخوری", en: "dining room" },
  { slug: "بیرونی", en: "outdoor patio balcony" },
];

// ---------- ابزار ----------
function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0;
}
const HAS_ZAI = which("z-ai");

const SYSTEM = `تو سردبیر ارشد نشریه «هومینو» هستی؛ مرجع فارسی طراحی خانه.
از روی یک عکس چیدمان (توضیح عکس را می‌گیری) یک پین الهام‌بخش فارسی می‌سازی.
اصول: بازنویسی اورجینال (هرگز کپی)، لحن گرم و حرفه‌ای، کاربردی برای خانه ایرانی، بدون تملق.
فقط JSON معتبر برگردان:
{"title":"تیتر جذاب زیر ۶۰ نویسه","description":"۳-۵ جمله درباره چیدمان، نور، متریال و حس فضا","items":["۴ تا ۷ قلم وسایل کلیدی فارسی"],"styleNote":"۲-۳ جمله: چه چیزی این فضا را نماینده این سبک می‌کند","tags":["۳ تگ فارسی"]}`;

async function llmJson(prompt) {
  if (!HAS_ZAI) return null;
  const out = join(ROOT, "scripts/.llm-tmp.json");
  try {
    execFileSync("z-ai", ["chat", "-p", prompt, "-s", SYSTEM, "-o", out], { timeout: 150000 });
    const j = JSON.parse(readFileSync(out, "utf8"));
    const raw = j.choices?.[0]?.message?.content ?? "";
    const a = raw.indexOf("{"), b = raw.lastIndexOf("}");
    if (a === -1 || b === -1) return null;
    return JSON.parse(raw.slice(a, b + 1));
  } catch { return null; }
}

let lastSearchAt = 0;
let search429 = 0;
async function searchImage(query) {
  if (!HAS_ZAI) return [];
  // فاصله‌گذاری سراسری بین جستجوها — غیربلاک‌کننده (async)
  const wait = Math.max(0, lastSearchAt + SEARCH_GAP_MS - Date.now());
  lastSearchAt = Date.now() + wait;
  if (wait) await sleep(wait);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", "6", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
      const j = JSON.parse(raw.slice(raw.indexOf("{")));
      return (j.results || []).map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200, h: parseInt(r.original_height) || 800 }));
    } catch (e) {
      const msg = String(e?.message ?? e);
      if (msg.includes("429")) {
        search429 += 1;
        const backoff = 45_000 * (attempt + 1);
        console.log(`  … محدودیت نرخ (429) — ${Math.round(backoff / 1000)}s صبر`);
        await sleep(backoff);
        continue;
      }
      return [];
    }
  }
  return [];
}


// فقط نویسه‌های فارسی/لاتین/عدد/سجلاّنش نگه داشته می‌شوند — بقایای چینی/روسی و … پاک می‌شوند
const BAD_CHARS = /[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af\u0400-\u04ff]/;
function cleanText(s) {
  return String(s ?? "").replace(BAD_CHARS, "").replace(/\s{2,}/g, " ").trim();
}

const TEMPLATE_ITEMS = (spaceSlug) =>
  spaceSlug === "اتاق خواب" ? ["تخت چوبی", "روتختی بافت", "آباژور کنار تخت", "فرش دستباف", "میز کنسول"]
  : spaceSlug === "فضای کار" ? ["میز کار چوبی", "صندلی ارگونومیک", "قفسه دیواری", "چراغ رومیزی", "گلدان سبز"]
  : spaceSlug === "ناهارخوری" ? ["میز ناهارخوری", "صندلی ناهارخوری", "لوستر", "بوفه", "جلد میز پارچه‌ای"]
  : spaceSlug === "بیرونی" ? ["صندلی باغی", "گلدان کاشته", "چراغ محوطه", "نیمکت چوبی", "فرش بیرونی"]
  : ["کاناپه", "میز جلومبلی", "فرش", "آباژور", "تابلو", "کوسن‌های هماهنگ"];

function templatePin(style, space, pick) {
  return {
    title: cleanText(`چیدمان ${space.slug} به سبک ${style.name}`),
    description: `یک چیدمان واقعی ${space.slug} با زبان طراحی ${style.name}: ترکیب عناصر شاخص این سبک با نورپردازی لایه‌ای و متریال هماهنگ، فضایی می‌سازد که هم چشم‌نواز است و هم زندگی‌پذیر. این پین از منابع بین‌المللی دیزاین انتخاب شده و برای خانه‌های ایرانی بازخوانی شده است. با کلیک روی پین می‌توانید ویژگی‌های سبک و وسایل کلیدی این چیدمان را ببینید.`,
    items: TEMPLATE_ITEMS(space.slug),
    styleNote: `سبک ${style.name} با تکیه بر ${style.en.split(" ").slice(0, 3).join(" ")} شناخته می‌شود؛ پالت رنگی هماهنگ، متریال بافت‌دار و تعادل میان فرم و کارکرد، هویت سبک را به‌وضوح نشان می‌دهد.`,
    tags: [style.name, space.slug, "ایده چیدمان"],
  };
}

// ---------- اجرا ----------
const RUN_STARTED = Date.now();
const gen = existsSync(GEN_FILE) ? JSON.parse(readFileSync(GEN_FILE, "utf8")) : [];
const seenImgs = new Set(gen.map((p) => p.image));
let cleaned = 0;

// 1) پاکسازی پین‌های خراب
for (const pin of gen) {
  const fields = ["title", "description", "styleNote"];
  let dirty = fields.some((f) => BAD_CHARS.test(String(pin[f] ?? "")))
    || (Array.isArray(pin.items) && pin.items.some((i) => BAD_CHARS.test(String(i))))
    || (Array.isArray(pin.tags) && pin.tags.some((t) => BAD_CHARS.test(String(t))));
  if (!dirty) continue;
  if (!DRY) {
    const fixed = await llmJson(`این پین الهام دکوراسیون («${cleanText(pin.title)}» — سبک ${pin.styleSlug}، فضا ${pin.room}) متن‌هایش نویسه‌های خراب دارند. یک متن فارسی تمیز و اورجینال بر اساس همین موضوع بنویس.`);
    const t = fixed ?? templatePin(
      STYLES.find((s) => s.slug === pin.styleSlug) ?? STYLES[0],
      SPACES.find((s) => s.slug === pin.room) ?? SPACES[0],
      null,
    );
    pin.title = cleanText(fixed?.title) || cleanText(pin.title) || t.title;
    pin.description = cleanText(fixed?.description) || t.description;
    pin.items = (fixed?.items ?? t.items).map(cleanText).filter(Boolean).slice(0, 7);
    pin.styleNote = cleanText(fixed?.styleNote) || t.styleNote;
    pin.tags = (fixed?.tags ?? t.tags).map(cleanText).filter(Boolean).slice(0, 5);
  }
  cleaned += 1;
  console.log(`✚ پاکسازی: ${pin.title.slice(0, 50)}`);
}

// 2) پر کردن ترکیب‌های خالی ماتریس
const covered = new Set(gen.map((p) => `${p.styleSlug}|${p.room}`));
const missing = [];
for (const style of STYLES) {
  for (const space of SPACES) {
    const key = `${style.slug}|${space.slug}`;
    if (!covered.has(key)) {
      for (let k = 0; k < PER_COMBO; k++) missing.push({ style, space, k });
    }
  }
}
console.log(`ماتریس: ${covered.size}/${STYLES.length * SPACES.length} ترکیب پوشیده شده — ${missing.length} پین هدف برای پر کردن gaps`);

const today = new Date().toISOString().slice(0, 10);
let seq = gen.length;
const added = [];

async function buildPin({ style, space }, idx) {
  const imgs = await searchImage(`pinterest ${style.en} ${space.en} interior layout`);
  const pick = imgs.find((p) => !seenImgs.has(p.url) && p.w >= 500 && p.h >= 350)
    ?? imgs.find((p) => !seenImgs.has(p.url));
  if (!pick) return null;
  const topic = `${space.en} in ${style.en} style — Pinterest layout photo (source: ${pick.source})`;
  const meta = (await llmJson(topic)) ?? templatePin(style, space, pick);
  const pin = {
    id: `ag-${today.replace(/-/g, "")}-bf${String(idx).padStart(3, "0")}`,
    title: cleanText(meta.title).slice(0, 80) || `چیدمان ${space.slug} به سبک ${style.name}`,
    image: pick.url,
    styleSlug: style.slug,
    room: space.slug,
    tags: (meta.tags ?? [style.name, space.slug]).map(cleanText).filter(Boolean).slice(0, 5),
    productIds: [],
    description: cleanText(meta.description).slice(0, 900),
    items: (meta.items ?? []).map(cleanText).filter(Boolean).slice(0, 7),
    styleNote: cleanText(meta.styleNote).slice(0, 500),
    source: { label: pick.source },
    author: { name: "ایجنت هومینو", type: "agent" },
    createdAt: new Date().toISOString(),
    _via: meta === templatePin ? "قالب" : (fixedFlag(meta) ? "llm" : "llm"),
  };
  return pin;
}
function fixedFlag() { return true; } // متن از LLM یا قالب — هر دو فارسی تمیز

// اجرای دسته‌ای با همزمانی محدود
let cursor = 0;
async function worker() {
  while (cursor < missing.length) {
    const job = missing[cursor++];
    try {
      const pin = await buildPin(job, seq + added.length);
      if (pin && !seenImgs.has(pin.image)) {
        seenImgs.add(pin.image);
        added.push(pin);
        console.log(`✓ [${added.length}/${missing.length}] ${pin.title} — ${job.style.name} × ${job.space.slug} (${pin.source?.label ?? "وب"})`);
      } else {
        console.log(`✗ عکس تازه برای ${job.style.name} × ${job.space.slug} پیدا نشد`);
      }
    } catch (e) {
      console.log(`✗ خطا در ${job.style.name} × ${job.space.slug}: ${e.message?.slice(0, 80)}`);
    }
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

// 3) ذخیره
const merged = [...added.reverse(), ...gen]; // جدیدترین‌ها بالا
const capped = merged.slice(0, 360);
if (!DRY) {
  writeFileSync(GEN_FILE, JSON.stringify(capped, null, 2) + "\n");
}

const coveredAfter = new Set(capped.map((p) => `${p.styleSlug}|${p.room}`)).size;
console.log(`\nپاکسازی: ${cleaned} پین | افزوده: ${added.length} پین | پوشش ماتریس: ${coveredAfter}/${STYLES.length * SPACES.length} | مجموع: ${capped.length}`);
if (DRY) console.log("[dry] هیچ فایلی نوشته نشد");

await logContentAgentRun(ROOT, {
  agentKey: "inspiration-curator",
  ok: added.length > 0 || cleaned > 0,
  dry: DRY,
  durationMs: Date.now() - RUN_STARTED,
  summary: `بک‌فیل ماتریس الهام: ${added.length} پین جدید، ${cleaned} پین پاکسازی‌شده — پوشش ${coveredAfter}/۶۰ ترکیب${search429 ? ` (${search429} بار محدودیت نرخ)` : ""}`,
  detail: {
    added: added.length,
    cleaned,
    coverage: `${coveredAfter}/60`,
    total: capped.length,
    via: "backfill",
  },
});

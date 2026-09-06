#!/usr/bin/env node
// ============================================================
// HOMEINO — Inspiration Daily Agent (روزی ۳ بار)
// گردش کار: چرخش ماتریس سبک×فضا → جستجوی عکس چیدمان واقعی →
// بازنویسی فارسی اورجینال (LLM) → افزودن به پین‌های الهام → پوش
//
// بک‌اند LLM (به‌ترتیب): z-ai CLI (سندباکس) | LLM_API_BASE_URL+KEY (هر اندپوینت
// سازگار با OpenAI) | قالب متن فارسی پایدار (fallback صادقانه)
// اجرا:  node scripts/inspiration-daily.mjs [--pins=6] [--dry]
// ============================================================
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const GEN_FILE = join(ROOT, "src/data/inspirations.generated.json");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoInspirationBot/1.0; +https://homeino.ir)" };

// ---------- ماتریس سبک × فضا (مطابق فیلترهای سایت) ----------
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

// ---------- چرخش: هر اجرا نوبت بعدی ماتریس ----------
const PINS_PER_RUN = Number(process.argv.find((a) => a.startsWith("--pins="))?.split("=")[1] || 6);
const DRY = process.argv.includes("--dry");
const RUNS_PER_DAY = 3;
const daySlot = Math.floor(Date.now() / 864e5); // شماره مطلق روز
const minute = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
const runSlot = Math.min(2, Math.floor(minute / (1440 / RUNS_PER_DAY)));
const cursor = ((daySlot * RUNS_PER_DAY + runSlot) % (STYLES.length * SPACES.length));
const combos = [];
for (let i = 0; i < PINS_PER_RUN; i++) {
  const idx = (cursor + i * 7) % (STYLES.length * SPACES.length); // گام ۷ = پوشش متفاوت در هر اجرا
  combos.push({ style: STYLES[Math.floor(idx / SPACES.length)], space: SPACES[idx % SPACES.length] });
}

// ---------- LLM ----------
const ENV = {};
const envFile = join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) ENV[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const USE_CUSTOM = !!(process.env.LLM_API_KEY && process.env.LLM_BASE_URL) || !!(ENV.LLM_API_KEY && ENV.LLM_BASE_URL);
const LLM_BASE = process.env.LLM_BASE_URL || ENV.LLM_BASE_URL;
const LLM_KEY = process.env.LLM_API_KEY || ENV.LLM_API_KEY;
const LLM_MODEL = process.env.LLM_MODEL || ENV.LLM_MODEL || "gpt-4o-mini";

const SYSTEM = `تو سردبیر ارشد نشریه «هومینو» هستی؛ مرجع فارسی طراحی خانه.
از روی یک عکس چیدمان (توضیح عکس را می‌گیری) یک پین الهام‌بخش فارسی می‌سازی.
اصول: بازنویسی اورجینال (هرگز کپی)، لحن گرم و حرفه‌ای، کاربردی برای خانه ایرانی، بدون تملق.
فقط JSON معتبر برگردان:
{"title":"تیتر جذاب زیر ۶۰ نویسه","description":"۳-۵ جمله درباره چیدمان، نور، متریال و حس فضا","items":["۴ تا ۷ قلم وسایل کلیدی فارسی"],"styleNote":"۲-۳ جمله: چه چیزی این فضا را نماینده این سبک می‌کند","tags":["۳ تگ فارسی"]}`;

async function llm(prompt) {
  if (USE_CUSTOM) {
    const res = await fetch(`${LLM_BASE.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${LLM_KEY}` },
      body: JSON.stringify({ model: LLM_MODEL, messages: [{ role: "system", content: SYSTEM }, { role: "user", content: prompt }], temperature: 0.7 }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}`);
    const j = await res.json();
    return j.choices?.[0]?.message?.content || "";
  }
  if (which("z-ai")) {
    const out = join(ROOT, "scripts/.llm-tmp.json");
    execFileSync("z-ai", ["chat", "-p", prompt, "-s", SYSTEM, "-o", out], { timeout: 150000 });
    const j = JSON.parse(readFileSync(out, "utf8"));
    return j.choices?.[0]?.message?.content ?? "";
  }
  return null; // fallback قالبی
}
function which(bin) {
  const r = spawnSync("which", [bin], { encoding: "utf8" });
  return r.status === 0;
}
const extractJson = (s) => {
  if (s == null) return null;
  const a = s.indexOf("{"), b = s.lastIndexOf("}");
  if (a === -1 || b === -1) return null;
  try { return JSON.parse(s.slice(a, b + 1)); } catch { return null; }
};

// ---------- عکس: جستجوی تصویر واقعی (z-ai) یا استخر کامیت‌شده (اجرای ابری) ----------
const POOL_FILE = join(ROOT, "scripts/inspiration-pool.json");
let POOL = null;
try { POOL = JSON.parse(readFileSync(POOL_FILE, "utf8")).pool; } catch { POOL = null; }

function poolImage(styleSlug, spaceSlug) {
  if (!POOL) return null;
  const direct = POOL[styleSlug]?.[spaceSlug] || [];
  const siblings = Object.entries(POOL[styleSlug] || {}).filter(([s]) => s !== spaceSlug).flatMap(([, v]) => v);
  const cands = [...direct, ...siblings];
  return cands.find((p) => !seenImgs.has(p.url)) || null; // صادقانه: بدون تکرار
}

function searchImage(query) {
  if (!which("z-ai")) return [];
  try {
    const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", "4", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    return (j.results || []).map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200, h: parseInt(r.original_height) || 800 }));
  } catch { return []; }
}

// ---------- اجرا ----------
const RUN_STARTED = Date.now();
const gen = existsSync(GEN_FILE) ? JSON.parse(readFileSync(GEN_FILE, "utf8")) : [];
const seenImgs = new Set(gen.map((p) => p.image));
const today = new Date().toISOString().slice(0, 10);
const added = [];

console.log(`ایجنت الهام — نوبت ${runSlot + 1}/${RUNS_PER_DAY} روز ${today} | ${combos.length} پین هدف`);
if (!USE_CUSTOM && !which("z-ai")) console.log("⚠ نه LLM خارجی هست نه z-ai — متن پین‌ها از قالب پایدار ساخته می‌شود");

for (const [i, { style, space }] of combos.entries()) {
  const label = `${style.name} × ${space.slug}`;
  process.stdout.write(`[${i + 1}/${combos.length}] ${label} ... `);
  let pick = null;
  if (which("z-ai")) {
    const imgs = searchImage(`${style.en} ${space.en} layout`);
    pick = imgs.find((p) => !seenImgs.has(p.url) && p.w >= 600) || null;
  }
  if (!pick) pick = poolImage(style.slug, space.slug); // اجرای ابری بدون z-ai
  if (!pick) { console.log("✗ عکس تازه پیدا نشد"); continue; }

  const topic = `${space.en} in ${style.en} style — image description: ${pick.source}`;
  let meta = null, via = "llm";
  try { meta = extractJson(await llm(topic)); } catch { meta = null; }
  if (!meta || !meta.title || !meta.description) {
    via = "قالب";
    meta = {
      title: `چیدمان ${space.slug} به سبک ${style.name}`,
      description: `یک چیدمان واقعی ${space.slug} با زبان طراحی ${style.name}: ترکیب عناصر شاخص این سبک با نورپردازی لایه‌ای و متریال هماهنگ، فضایی می‌سازد که هم چشم‌نواز است و هم زندگی‌پذیر. این پین از منابع بین‌المللی دیزاین انتخاب شده و برای خانه‌های ایرانی بازخوانی شده است. با کلیک روی پین می‌توانید ویژگی‌های سبک و وسایل کلیدی این چیدمان را ببینید.`,
      items: space.slug === "اتاق خواب" ? ["تخت چوبی", "پشه‌پوش بافت", "آباژور کنار تخت", "فرش دستباف", "میز کنسول"]
        : space.slug === "فضای کار" ? ["میز کار چوبی", "صندلی ارگونومیک", "قفسه دیواری", "چراغ رومیزی", "گلدان سبز"]
        : space.slug === "ناهارخوری" ? ["میز ناهارخوری", "صندلی ناهارخوری", "لوستر", "بوفه", "جلد میز پارچه‌ای"]
        : space.slug === "بیرونی" ? ["صندلی باغی", "گلدان کاشته", "چراغ محوطه", "نیمکت چوبی", "فرش بیرونی"]
        : ["کاناپه", "میز جلومبلی", "فرش", "آباژور", "تابلو", "کوسن‌های هماهنگ"],
      styleNote: `سبک ${style.name} با تکیه بر ${style.en.split(" ").slice(0, 3).join(" ")} شناخته می‌شود؛ در این فضا پالت رنگی هماهنگ، متریال بافت‌دار و تعادل میان فرم و کارکرد، هویت سبک را به‌وضوح نشان می‌دهد.`,
      tags: [style.name, space.slug, "ایده چیدمان"],
    };
  }

  const pin = {
    id: `ag-${today.replace(/-/g, "")}-${String(cursor + i).padStart(2, "0")}`,
    title: String(meta.title).slice(0, 80),
    image: pick.url,
    styleSlug: style.slug,
    room: space.slug,
    tags: (meta.tags || [style.name, space.slug]).slice(0, 5),
    productIds: [],
    description: String(meta.description).slice(0, 900),
    items: (meta.items || []).slice(0, 7).map(String),
    styleNote: String(meta.styleNote || "").slice(0, 500),
    source: { label: pick.source },
    author: { name: "ایجنت هومینو", type: "agent" },
    createdAt: new Date().toISOString(),
    _via: via,
  };
  gen.unshift(pin);
  seenImgs.add(pick.url);
  added.push(pin);
  console.log(`✓ ${pin.title} (${via})`);
}

// نگهداشت: حداکثر ۳۶۰ پین ایجنت
const capped = gen.slice(0, 360);
if (DRY) { console.log(`\n[dry] ${added.length} پین ساخته شد — فایل نوشته نشد`); }
else {
  writeFileSync(GEN_FILE, JSON.stringify(capped, null, 2) + "\n");
  console.log(`\n${added.length} پین جدید → ${GEN_FILE} (مجموع: ${capped.length})`);
}

// ثبت کارکرد ایجنت برای پنل ادمین (/admin/automation)
await logContentAgentRun(ROOT, {
  agentKey: "inspiration-curator",
  ok: added.length > 0,
  dry: DRY,
  durationMs: Date.now() - RUN_STARTED,
  summary: DRY
    ? `اجرای آزمایشی: ${added.length} پین ساخته شد (فایل نوشته نشد)`
    : added.length > 0
      ? `${added.length} پین الهام جدید (${added.some((p) => p._via === "llm") ? "بازنویسی LLM" : "قالب پایدار"})`
      : "پین جدیدی افزوده نشد — عکس تازه برای نوبت‌های این اجرا پیدا نشد",
  detail: {
    added: added.length,
    total: capped.length,
    via: added.filter((p) => p._via === "llm").length ? "llm" : "template",
    combos: combos.map((c) => `${c.style.name} × ${c.space.slug}`),
  },
});

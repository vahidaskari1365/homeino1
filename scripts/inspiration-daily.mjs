#!/usr/bin/env node
// ============================================================
// HOMEINO — Inspiration Daily Agent (روزی ۳ بار)
// گردش کار: چرخش ماتریس سبک×فضا → جستجوی عکس چیدمان واقعی →
// بازنویسی فارسی اورجینال (LLM) → افزودن به پین‌های الهام → پوش
// + پین‌های محصول‌محور: هر نوبت ۲ پین از دسته‌های محصول سایت
// (فرش، روشنایی، پرده، تابلو، گلدان، کمد، کف‌پوش، دیوارپوش…)
//
// بک‌اند LLM: زنجیره چندکلیدی LLM_KEYS_JSON (z.ai + Google) | کلید تکی env |
// OmniRoute | z-ai CLI/SDK (سندباکس) | قالب متن فارسی پایدار (fallback صادقانه)
// اجرا:  node scripts/inspiration-daily.mjs [--pins=6] [--dry]
// ============================================================
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";
import { callLlm } from "./lib/llm-chain.mjs";
import { PRODUCTS } from "./lib/homeino-categories.mjs";

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
  { slug: "حیاط و محوطه", en: "outdoor courtyard backyard patio garden landscape design" },
];
// کلید قدیمی استخر عکس برای این فضا «بیرونی» است؛ برای سازگاری نگه می‌داریم
const SPACE_POOL_ALIAS = { "حیاط و محوطه": "بیرونی" };

// ---------- چرخش: هر اجرا نوبت بعدی ماتریس ----------
const PINS_PER_RUN = Number(process.argv.find((a) => a.startsWith("--pins="))?.split("=")[1] || 6);
const DRY = process.argv.includes("--dry");
const RUNS_PER_DAY = 3;
const daySlot = Math.floor(Date.now() / 864e5); // شماره مطلق روز
const minute = new Date().getUTCHours() * 60 + new Date().getUTCMinutes();
const runSlot = Math.min(2, Math.floor(minute / (1440 / RUNS_PER_DAY)));
const cursor = ((daySlot * RUNS_PER_DAY + runSlot) % (STYLES.length * SPACES.length));
// پین‌های محصول: هر نوبت ۲ دسته محصول با گام نصف‌طول (تا تکرار نشوند)
const PRODUCT_PINS_PER_RUN = Math.min(2, PRODUCTS.length);
const prodCursor = (daySlot * RUNS_PER_DAY + runSlot) % PRODUCTS.length;
// انتخاب ترکیب‌ها بعد از بارگذاری استخر انجام می‌شود (چرخش هوشمند: ترکیب بدون عکس رد می‌شود)

// ---------- LLM ----------
const ENV = {};
const envFile = join(ROOT, ".env.local");
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m) ENV[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SYSTEM = `تو سردبیر ارشد نشریه «هومینو» هستی؛ مرجع فارسی طراحی خانه.
از روی یک عکس چیدمان (توضیح عکس را می‌گیری) یک پین الهام‌بخش فارسی می‌سازی.
اصول: بازنویسی اورجینال (هرگز کپی)، لحن گرم و حرفه‌ای، کاربردی برای خانه ایرانی، بدون تملق.
فقط JSON معتبر برگردان:
{"title":"تیتر جذاب زیر ۶۰ نویسه","description":"۳-۵ جمله درباره چیدمان، نور، متریال و حس فضا","items":["۴ تا ۷ قلم وسایل کلیدی فارسی"],"styleNote":"۲-۳ جمله: چه چیزی این فضا را نماینده این سبک می‌کند","tags":["۳ تگ فارسی"]}`;

async function llm(prompt) {
  const chained = await callLlm([{ role: "system", content: SYSTEM }, { role: "user", content: prompt }]);
  if (chained) return chained;
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
  const alias = SPACE_POOL_ALIAS[spaceSlug];
  const direct = POOL[styleSlug]?.[spaceSlug] || (alias ? POOL[styleSlug]?.[alias] || [] : []);
  const siblings = Object.entries(POOL[styleSlug] || {}).filter(([s]) => s !== spaceSlug && s !== alias).flatMap(([, v]) => v);
  const cands = [...direct, ...siblings];
  return cands.find((p) => !seenImgs.has(p.url)) || null; // صادقانه: بدون تکرار
}

// استخر اختصاصی دسته‌های محصول (کلید _products در inspiration-pool.json)
function productPoolImage(productSlug) {
  if (!POOL) return null;
  const cands = POOL._products?.[productSlug] || [];
  return cands.find((p) => !seenImgs.has(p.url)) || null;
}
function productPoolRemaining() {
  if (!POOL?._products) return 0;
  let n = 0;
  for (const items of Object.values(POOL._products)) n += items.filter((p) => !seenImgs.has(p.url)).length;
  return n;
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

// ---------- چرخش هوشمند: فقط ترکیب‌هایی که عکس مصرف‌نشده دارند ----------
function unusedCount(styleSlug, spaceSlug) {
  if (!POOL) return 0;
  const alias = SPACE_POOL_ALIAS[spaceSlug];
  const direct = POOL[styleSlug]?.[spaceSlug] || (alias ? POOL[styleSlug]?.[alias] || [] : []);
  const n = direct.filter((p) => !seenImgs.has(p.url)).length;
  if (n > 0) return n;
  const siblings = Object.entries(POOL[styleSlug] || {}).filter(([s]) => s !== spaceSlug && s !== alias).flatMap(([, v]) => v);
  return siblings.filter((p) => !seenImgs.has(p.url)).length;
}
const MATRIX = STYLES.length * SPACES.length;
// هدف پین‌های سبک×فضا = باقی سهمیه بعد از پین‌های محصول
const STYLE_PINS_TARGET = Math.max(1, PINS_PER_RUN - PRODUCT_PINS_PER_RUN);
const combos = [];
const poolStarved = [];
for (let k = 0; k < MATRIX && combos.length < STYLE_PINS_TARGET; k++) {
  const idx = (cursor + k * 7) % MATRIX; // گام ۷ = پوشش متفاوت در هر اجرا؛ کامل دور کامل ماتریس
  const style = STYLES[Math.floor(idx / SPACES.length)];
  const space = SPACES[idx % SPACES.length];
  if (unusedCount(style.slug, space.slug) > 0) combos.push({ style, space });
  else poolStarved.push(`${style.name} × ${space.slug}`);
}
const poolEmpty = combos.length === 0;
let poolRemaining = 0;
if (POOL) for (const sp of Object.values(POOL)) for (const items of Object.values(sp)) poolRemaining += items.filter((p) => !seenImgs.has(p.url)).length;
const poolLow = poolRemaining > 0 && poolRemaining < 40;
const today = new Date().toISOString().slice(0, 10);
const added = [];

console.log(`ایجنت الهام — نوبت ${runSlot + 1}/${RUNS_PER_DAY} روز ${today} | ${combos.length} پین هدف | باقیمانده استخر: ${poolRemaining}${poolLow ? " ⚠ استخر رو به اتمام" : ""}`);
if (poolStarved.length) console.log(`⚠ ${poolStarved.length} ترکیب بدون عکس مصرف‌نشده رد شد`);
if (!process.env.LLM_KEYS_JSON && !process.env.LLM_API_KEY && !process.env.OMNIROUTE_BASE_URL && !which("z-ai")) console.log("⚠ نه زنجیره کلیدی هست نه z-ai — متن پین‌ها از قالب پایدار ساخته می‌شود");

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
        : space.slug === "حیاط و محوطه" || space.slug === "بیرونی" ? ["مبل حیاطی", "گلدان کاشته", "چراغ محوطه", "نیمکت چوبی", "آتشدان یا باربیکیو", "فرش بیرونی"]
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

// ---------- پین‌های محصول‌محور (۲ در هر نوبت، چرخش روی دسته‌های محصول) ----------
// هدف سئو: برای هر دسته محصول (فرش، روشنایی، پرده، تابلو، گلدان، کمد، کف‌پوش، دیوارپوش…)
// جریان پایدار پین تخصصی تولید شود تا صفحه الهام در آن کلیدواژه‌ها رتبه بگیرد
// و دستیارهای هوشمند هومینو را برای آن دسته پیشنهاد بدهند.
const PRODUCT_FALLBACK_ITEMS = {
  "مبل و مبلمان": ["کاناپه", "مبل راحتی", "میز جلومبلی", "فرش هماهنگ", "کوسن‌های بافت"],
  "فرش و قالیچه": ["فرش مدرن", "قالیچه دستباف", "رانر راهرو", "پد ضدلغزش", "گره‌بافت ترک"],
  "کف‌پوش": ["کف‌پوش لمینت", "پارکت چوبی", "اس‌پی‌سی", "قرنیز", "فوم زیرکار"],
  "روشنایی و لوستر": ["لوستر سقفی", "آباژور ایستاده", "چراغ دیواری", "نوار LED", "دیمر گرم"],
  "تابلو و دیوارکوب": ["تابلو اکریلیک", "چاپ کانواس", "قاب چوبی", "آینه دیواری", "شلف دیواری"],
  "گلدان و گیاه": ["گلدان سرامیکی", "سانسوریا", "قوطی کاشته", "استند گل", "پیک نگهدارنده"],
  "پرده و منسوجات": ["پرده توری", "پرده بلاک‌آوت", "ریل دوطبقه", "کوسن مخمل", "پتو بافت"],
  "دکوری و اکسسوری": ["آینه قاب‌دار", "شمع و شمعدان", "مجسمه دکوری", "کاسه مرکزی", "کتاب‌پایه"],
  "کمد و ذخیره‌سازی": ["کمد دو درب", "واکر این", "باکس ذخیره", "آویز مخملی", "سبد حصیری"],
  "دیوارپوش": ["کاغذدیواری طرح‌دار", "پنل چوبی سه‌بعدی", "تراورتین مصنوعی", "نوار لبه‌گیری", "چسب دیواری"],
};
const productJobs = [];
for (let k = 0; k < PRODUCT_PINS_PER_RUN; k++) {
  const product = PRODUCTS[(prodCursor + k * 5) % PRODUCTS.length];
  const style = STYLES[(daySlot * RUNS_PER_DAY + runSlot + k) % STYLES.length];
  productJobs.push({ product, style });
}
console.log(`پین‌های محصول این نوبت: ${productJobs.map((j) => j.product.slug).join(" + ")}`);
for (const [k, { product, style }] of productJobs.entries()) {
  const label = `${product.slug} × ${style.name}`;
  process.stdout.write(`[${k + 1}/${productJobs.length}] ${label} ... `);
  let pick = productPoolImage(product.slug); // اول استخر کامیت‌شده (اجرای ابری)
  if (!pick && which("z-ai")) {
    const imgs = searchImage(`${product.en} ${style.en.split(" ")[0]}`).filter((p) => p.w >= 600 && !seenImgs.has(p.url));
    pick = imgs[0] || null;
  }
  if (!pick) pick = poolImage(style.slug, product.room); // آخرین فال‌بک: عکس فضای هماهنگ
  if (!pick) { console.log("✗ عکس تازه پیدا نشد"); continue; }

  const topic =
    `عکس یک «${product.slug}» در فضای ${product.room} با حال‌وهوای سبک ${style.name} (منبع تصویر: ${pick.source}). ` +
    "یک پین الهام‌بخش تخصصی درباره انتخاب و استایل‌کردن این محصول بنویس: چه ویژگی‌هایی (متریال، فرم، رنگ، اندازه) در این نمونه دیده می‌شود، " +
    "چطور برای خانه ایرانی انتخاب و استایلش کنیم و با چه عناصر دیگری هماهنگ می‌شود.";
  let meta = null, via = "llm";
  try { meta = extractJson(await llm(topic)); } catch { meta = null; }
  if (!meta || !meta.title || !meta.description) {
    via = "قالب";
    meta = {
      title: `راهنمای انتخاب ${product.slug} به سبک ${style.name}`,
      description: `${product.slug} یکی از مهم‌ترین عناصر هویت‌بخش ${product.room} است؛ در این نمونه زبان طراحی ${style.name} را می‌بینیم: فرم و متریال هماهنگ با پالت فضای ایرانی، نورپردازی لایه‌ای و بافت‌های مکمل. هنگام انتخاب ${product.slug} به اندازه فضا، متریال و کیفیت ساخت توجه کنید و آن را با عناصر مکمل ست کنید تا فضا یکدست و زندگی‌پذیر شود. این پین از منابع بین‌المللی دیزاین انتخاب و برای خانه‌های ایرانی بازخوانی شده است.`,
      items: PRODUCT_FALLBACK_ITEMS[product.slug] || [product.slug, "عناصر مکمل", "نور لایه‌ای", "پالت هماهنگ", "بافت طبیعی"],
      styleNote: `نمونه‌ای از ${product.slug} در زبان طراحی ${style.name}: تعادل فرم و کارکرد، متریال صادق و پالت رنگی هماهنگ — ویژگی‌هایی که این سبک را برای فضای ایرانی کاربردی می‌کند.`,
      tags: [product.slug, style.name, "راهنمای انتخاب"],
    };
  }

  const pin = {
    id: `ag-${today.replace(/-/g, "")}-p${String(prodCursor).padStart(2, "0")}-${k}`,
    title: String(meta.title).slice(0, 80),
    image: pick.url,
    styleSlug: style.slug,
    room: product.room,
    tags: (meta.tags || [product.slug, style.name]).slice(0, 5),
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
const productPins = added.filter((p) => /^ag-\d{8}-p\d{2}/.test(p.id)).length;
await logContentAgentRun(ROOT, {
  agentKey: "inspiration-curator",
  ok: added.length > 0,
  dry: DRY,
  durationMs: Date.now() - RUN_STARTED,
  summary: DRY
    ? `اجرای آزمایشی: ${added.length} پین ساخته شد (فایل نوشته نشد)`
    : added.length > 0
      ? `${added.length} پین الهام جدید (${added.some((p) => p._via === "llm") ? "بازنویسی LLM" : "قالب پایدار"}${productPins ? `؛ ${productPins} پین محصول‌محور` : ""})`
      : poolEmpty
        ? `استخر عکس خالی است (باقیمانده: ${poolRemaining}) — نیاز به شارژ: expand-inspiration-pool`
        : "پین جدیدی افزوده نشد — عکس تازه برای نوبت‌های این اجرا پیدا نشد",
  detail: {
    added: added.length,
    productPins,
    total: capped.length,
    via: added.filter((p) => p._via === "llm").length ? "llm" : "template",
    poolRemaining,
    productPoolRemaining: productPoolRemaining(),
    skippedStarved: poolStarved.length,
    combos: combos.map((c) => `${c.style.name} × ${c.space.slug}`),
    productJobs: productJobs.map((j) => j.product.slug),
  },
});

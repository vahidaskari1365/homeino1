#!/usr/bin/env node
// ============================================================
// HOMEINO — ترمیم وفاداری موضوع + عکس‌های مرده در پین‌های الهام
// ============================================================
// سه کلاس خرابی را پیدا و عکس را از منبع پایدارِ همموضوع جایگزین می‌کند:
//   ① پین‌هایی که عکسشان از فضای دیگری است (قربانیان فال‌بک خواهر قدیمی)
//   ② پین‌هایی که عکسشان مرده است (مثل لینک‌های منقضی z-cdn — ناظر: ~۲۰۰ پین)
//   ③ پین‌های محصول‌محورِ مرده — جایگزین فقط از همان استخر محصول
// ترتیب جایگزینی: استخرِ زنده (همان سبک×فضا، ثبات‌دامنه‌محور) → جستجوی زندهٔ z-ai
// با QA بینایی → تولید رایگان Pollinations با سلف-هاست (Task 74 — پناه آخرِ بیدردسر).
// همهٔ جایگزین‌ها سلف-هاست می‌شوند؛ لینک منقضی‌شدنی دیگر هرگز منتشر نمی‌شود.
// اجرا: node scripts/qa-repair-pins.mjs [--dry] [--max=N] [--parallel=4] [--no-gen]
// ============================================================
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { cropBottomStrip } from "./lib/cover-pipeline.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
const NO_GEN = process.argv.includes("--no-gen");
const argNum = (flag, dflt) => {
  const i = process.argv.indexOf(flag);
  return i > -1 ? Math.max(1, Number(process.argv[i + 1]) || dflt) : dflt;
};
const MAX_FIX = argNum("--max", Infinity);
const PARALLEL = argNum("--parallel", 4);

const GEN_FILE = join(ROOT, "src/data/inspirations.generated.json");
const POOL_FILE = join(ROOT, "scripts/inspiration-pool.json");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoInspirationBot/1.0; +https://homeino.ir)" };

const EN_SPACE = { "پذیرایی": "living room", "اتاق خواب": "bedroom", "فضای کار": "home office workspace", "ناهارخوری": "dining room", "بیرونی": "outdoor patio balcony" };
const EN_STYLE = { modern: "modern interior design", minimal: "minimalist interior", scandinavian: "scandinavian interior", japandi: "japandi interior", classic: "classic elegant interior", neoclassic: "neoclassical interior", industrial: "industrial interior", boho: "bohemian interior", rustic: "rustic interior", mediterranean: "mediterranean interior", contemporary: "contemporary interior", "art-deco": "art deco interior" };

function which(bin) {
  return spawnSync("which", [bin], { encoding: "utf8" }).status === 0;
}
const HAS_ZAI = process.env.USE_ZAI !== "0" && which("z-ai");

const pins = JSON.parse(readFileSync(GEN_FILE, "utf8"));
const poolDoc = JSON.parse(readFileSync(POOL_FILE, "utf8"));
const pool = poolDoc.pool || {};

// ایندکس معکوس: url → مجموعهٔ style:space
const urlPlaces = new Map();
for (const [st, spaces] of Object.entries(pool)) {
  for (const [sp, items] of Object.entries(spaces)) {
    for (const it of items) {
      if (!urlPlaces.has(it.url)) urlPlaces.set(it.url, []);
      urlPlaces.get(it.url).push(`${st}:${sp}`);
    }
  }
}

const seen = new Set(pins.map((p) => p.image));
const fixes = [];
const fails = [];
const consumedPoolUrls = new Set(); // عکس‌های استخری که این اجرا مصرف کرد — آخر کار از استخر حذف می‌شوند

// دامنه‌های پایدار — لینک‌های z-cdn/chatglm منقضی می‌شوند و دیگر پذیرفته نمی‌شوند
const STABLE_DOMAINS = [
  "images.pexels.com", "images.unsplash.com", "cdn.pixabay.com",
  "upload.wikimedia.org", "live.staticflickr.com", "images.adsttc.com",
  "cdn.home-designing.com", "i.pinimg.com",
];
const isStable = (u) => {
  try {
    const h = new URL(u).hostname;
    return STABLE_DOMAINS.some((d) => h === d || h.endsWith("." + d));
  } catch {
    return false;
  }
};

async function isDead(url) {
  if (url.startsWith("/images/")) return !existsSync(join(ROOT, "public", url)); // سلف-هاست
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 9000);
    const res = await fetch(url, { method: "HEAD", signal: ctrl.signal, redirect: "follow", headers: UA });
    clearTimeout(t);
    return !res.ok;
  } catch {
    return true;
  }
}

// ---------- کش زنده‌بودن استخر — یک‌بار سنجش موازی، بعد انتخاب هم‌گام و بی‌مسابقه ----------
const aliveCache = new Map();
{
  const httpUrls = [...urlPlaces.keys()].filter((u) => u.startsWith("http"));
  console.log(`سنجش زنده‌بودن استخر: ${httpUrls.length} URL …`);
  let i = 0;
  await Promise.all(Array.from({ length: 16 }, async () => {
    while (i < httpUrls.length) {
      const u = httpUrls[i++];
      aliveCache.set(u, !(await isDead(u)));
    }
  }));
  const aliveN = [...aliveCache.values()].filter(Boolean).length;
  console.log(`استخر زنده: ${aliveN}/${httpUrls.length} (بقیه مرده — انتخاب نمی‌شوند)`);
}

/** ثبات دامنه — pinimg/لوکال ماندگارند؛ z-cdn منقضی‌شدنی (هم‌راستا با inspiration-daily) */
function stability(url) {
  if (typeof url !== "string") return 0;
  if (url.startsWith("/images/")) return 3;
  if (isStable(url)) return 2;
  return 1;
}

/** انتخاب هم‌گام کاندید زندهٔ مصرف‌نشده از یک باکت استخر + رزرو فوری (ضد دو-مصرفی) */
function reserveFromBucket(bucket) {
  const cands = (bucket || [])
    .filter((c) => !seen.has(c.url) && !consumedPoolUrls.has(c.url))
    .filter((c) => (c.url.startsWith("/images/") ? existsSync(join(ROOT, "public", c.url)) : aliveCache.get(c.url) === true))
    .sort((a, b) => stability(b.url) - stability(a.url));
  if (!cands.length) return null;
  consumedPoolUrls.add(cands[0].url);
  return cands[0];
}
function unreserve(url) {
  consumedPoolUrls.delete(url);
}

function searchImage(query) {
  if (!HAS_ZAI) return [];
  try {
    const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", "4", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    return (j.results || []).map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200, h: parseInt(r.original_height) || 800 }));
  } catch {
    return [];
  }
}

function downloadTmp(url) {
  // سینک برای سادگی — تعداد پین‌های خراب کم است
  try {
    const res = execFileSync("curl", ["-sL", "--max-time", "15", "-A", UA["User-Agent"], "-o", join(ROOT, "scripts", ".pin-qa-tmp.img"), "-w", "%{http_code} %{content_type}", url], { encoding: "utf8" });
    const [code, type] = res.split(" ");
    if (code !== "200" || !type?.startsWith("image")) return null;
    return join(ROOT, "scripts", ".pin-qa-tmp.img");
  } catch {
    return null;
  }
}

function visionOk(tmp, styleSlug, room) {
  try {
    const out = join(ROOT, "scripts", ".pin-qa-vision.json");
    execFileSync("z-ai", ["vision", "-i", tmp, "-p",
      `آیا این عکس یک «${room}» با سبک «${styleSlug}» است؟ فقط JSON: {"ok":true} یا {"ok":false,"reason":"..."}`,
      "-o", out], { timeout: 120000 });
    const j = JSON.parse(readFileSync(out, "utf8"));
    const m = (j.choices?.[0]?.message?.content ?? "").match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { ok: false };
  } catch {
    return { ok: false };
  }
}

const PINS_IMG_DIR = join(ROOT, "public", "images", "pins");

/** عکس را همین حالا (وقتی زنده است) دانلود و داخل ریپو میزبان می‌کند — ضد انقضا */
function selfHost(pinId, url) {
  try {
    mkdirSync(PINS_IMG_DIR, { recursive: true });
    const ext = url.includes(".png") || url.includes("format=png") ? "png" : "jpg";
    const dest = join(PINS_IMG_DIR, `${pinId}.${ext}`);
    execFileSync("curl", ["-sL", "--max-time", "25", "-A", UA["User-Agent"], "-o", dest, url], { timeout: 30000 });
    if (!existsSync(dest) || statSync(dest).size < 15000) {
      try { unlinkSync(dest); } catch {}
      return null;
    }
    return `/images/pins/${pinId}.${ext}`;
  } catch {
    return null;
  }
}

// ---------- پناه آخر: تولید رایگان هم‌موضوع + سلف-هاست (Task 74) ----------
/** تولید عکس با Pollinations برای دقیقاً همان سبک×فضا؛ seed از خود id پین (یکتا) */
async function generatePinImage(pinId, styleSlug, room) {
  if (NO_GEN) return null;
  const styleEn = EN_STYLE[styleSlug] || styleSlug;
  const spaceEn = EN_SPACE[room] || room;
  let h = 0;
  for (const ch of pinId) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const base = h % 100000;
  const prompt = encodeURIComponent(`${styleEn}, ${spaceEn} interior design photography, cozy natural light, realistic photo, no text no watermark`);
  for (const seed of [base, base + 777, base + 313]) {
    try {
      const res = await fetch(`https://image.pollinations.ai/prompt/${prompt}?width=1024&height=768&seed=${seed}&model=flux`, {
        signal: AbortSignal.timeout(50_000), headers: UA,
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 15000) continue;
      mkdirSync(PINS_IMG_DIR, { recursive: true });
      const dest = join(PINS_IMG_DIR, `${pinId}.jpg`);
      writeFileSync(dest, buf);
      await cropBottomStrip(dest); // واترمارک پایین — اگر sharp باشد بریده می‌شود
      return `/images/pins/${pinId}.jpg`;
    } catch { /* seed بعدی */ }
  }
  return null;
}

// ---------- ① قربانیان وفاداری (عکس از فضای دیگر) ----------
const SPACE_ALIAS = { "حیاط و محوطه": "بیرونی" }; // هم‌گام با inspiration-daily
const mismatched = [];
for (const p of pins) {
  if (!p.image || !p.styleSlug || !p.room) continue;
  const places = urlPlaces.get(p.image);
  const okProv =
    !places ||
    places.includes(`${p.styleSlug}:${p.room}`) ||
    (SPACE_ALIAS[p.room] && places.includes(`${p.styleSlug}:${SPACE_ALIAS[p.room]}`)) ||
    places.every((sp) => sp.startsWith("_products:")); // پین محصول‌محور: عکس محصول مجاز است
  if (!okProv) mismatched.push({ p, places });
}

// ---------- ② پین‌های مرده ----------
const deadCandidates = [];
{
  const live = pins.filter((p) => p.image);
  let i = 0;
  await Promise.all(Array.from({ length: 12 }, async () => {
    while (i < live.length) {
      const p = live[i++];
      if (await isDead(p.image)) deadCandidates.push(p);
    }
  }));
}
console.log(`پیش از ترمیم — وفاداری: ${mismatched.length} | مرده: ${deadCandidates.length}`);

/** آیا این پین محصول‌محور است؟ (عکس باید از همان استخر محصول بیاید، نه عکس فضا) */
function isProductPin(p) {
  const prov = typeof p._prov === "string" ? p._prov : "";
  if (prov.startsWith("products:") || prov.startsWith("local|products:")) return true;
  const itsPlaces = urlPlaces.get(p.image) || [];
  return itsPlaces.length > 0 && itsPlaces.every((sp) => sp.startsWith("_products:"));
}

/** ترمیم یک پین: (محصولی؟ استخر همان محصول) → استخر زندهٔ هم‌موضوع → جستجوی زنده با
 *  QA بینایی → تولید رایگان. رزرو استخر هم‌گام است (ضد دو-مصرفی) — امن برای اجرای موازی. */
async function repairPin(p, reason) {
  const bucketStyle = pool[p.styleSlug];
  let replacement = null; // { url, prov }
  let reservedUrl = null;
  const tryReserve = (bucket, provFn) => {
    const c = reserveFromBucket(bucket);
    if (c) { reservedUrl = c.url; replacement = { url: c.url, prov: provFn() }; return true; }
    return false;
  };
  // ① پین محصول‌محور: فقط استخر همان محصول — عکس فضا برای پین محصول نامرتبط است
  const product = isProductPin(p);
  if (product) {
    const prov = typeof p._prov === "string" ? p._prov : "";
    const itsPlaces = urlPlaces.get(p.image) || [];
    const slug = prov.includes("products:") ? prov.split("products:")[1].trim()
      : (itsPlaces[0] || "").replace("_products:", "").trim();
    if (slug && !slug.startsWith("_")) tryReserve(pool._products?.[slug], () => `products:${slug}`);
  }
  // ② استخر زندهٔ همان سبک×فضا (+ alias همان فضا) — فال‌بک مجاز برای پین محصول هم (مثل نسخهٔ قبل)
  if (!replacement) {
    if (!tryReserve(bucketStyle?.[p.room], () => `pool:${p.styleSlug}:${p.room}`))
      tryReserve(bucketStyle?.[SPACE_ALIAS[p.room]], () => `pool:${p.styleSlug}:${SPACE_ALIAS[p.room] || p.room}`);
  }
  if (replacement) {
    const local = selfHost(p.id, replacement.url);
    if (local) {
      seen.delete(p.image);
      p.image = local;
      p._prov = `local|${replacement.prov}`;
      seen.add(local);
      return `${p.id} (${p.styleSlug}/${p.room}): ${reason} → سلف-هاست از استخر (${replacement.prov})`;
    }
    unreserve(reservedUrl);
    replacement = null;
  }
  // ③ جستجوی زندهٔ z-ai با گیت بینایی (فقط سندباکس)
  if (HAS_ZAI) {
    const q = `${EN_STYLE[p.styleSlug] || p.styleSlug} ${EN_SPACE[p.room] || p.room} layout`;
    const cands = searchImage(q).filter((c) => !seen.has(c.url) && c.w >= 600 && (c.h || 900) >= 450);
    for (const c of cands.slice(0, 3)) {
      const tmp = downloadTmp(c.url);
      if (!tmp) continue;
      const v = visionOk(tmp, p.styleSlug, p.room);
      if (v.ok) {
        const local = selfHost(p.id, c.url);
        if (local) {
          seen.delete(p.image);
          p.image = local;
          p._prov = `local|search-fixed:${p.styleSlug}:${p.room}`;
          seen.add(local);
          return `${p.id} (${p.styleSlug}/${p.room}): ${reason} → جستجوی زنده + QA بینایی → سلف-هاست`;
        }
      }
    }
  }
  // ④ تولید رایگان هم‌موضوع (پناه آخر — سلف-هاست، یکتا با seed خود پین)
  const gen = await generatePinImage(p.id, p.styleSlug, p.room);
  if (gen) {
    seen.delete(p.image);
    p.image = gen;
    p._prov = `local|gen:${p.styleSlug}:${p.room}`;
    seen.add(gen);
    return `${p.id} (${p.styleSlug}/${p.room}): ${reason} → تولید رایگان + سلف-هاست`;
  }
  return null;
}

// اجرای موازی با رزرو هم‌گام — نتیجهٔ هر آیتم یا کامل یا هیچ
const failedAfterAll = [];
let fixedCount = 0;
async function repairWorker(queue, label) {
  let n = 0;
  await Promise.all(Array.from({ length: PARALLEL }, async () => {
    while (queue.length) {
      const { p, places } = queue.shift() || {};
      if (!p) break;
      const r = await repairPin(p, label === "fidelity" ? "عکس نامرتبط" : "عکس مرده").catch(() => null);
      if (r) { fixes.push(r); n++; }
      else failedAfterAll.push(`${p.id} (${p.styleSlug}/${p.room}): جایگزین پیدا نشد — ${places ? "عکس اشتباه" : "عکس مرده"} باقی ماند`);
    }
  }));
  return n;
}
fixedCount += await repairWorker(mismatched, "fidelity");
if (Number.isFinite(MAX_FIX) && deadCandidates.length > MAX_FIX) {
  console.log(`(سقف ${MAX_FIX} — از ${deadCandidates.length} مرده، قدیمی‌ترین‌ها به اجرای بعدی)`);
  deadCandidates.length = MAX_FIX; // لیست newest-first است — تازه‌ها اول ترمیم می‌شوند
}
fixedCount += await repairWorker(deadCandidates.map((p) => ({ p, places: urlPlaces.get(p.image) })), "dead");

// ---------- مصرف استخر را از استخر حذف کن (شمارش «مصرف‌نشده» صادق بماند) ----------
if (consumedPoolUrls.size) {
  let removed = 0;
  for (const spaces of Object.values(pool)) {
    for (const [sp, items] of Object.entries(spaces)) {
      if (!Array.isArray(items)) continue;
      const kept = items.filter((it) => !consumedPoolUrls.has(it.url));
      removed += items.length - kept.length;
      spaces[sp] = kept;
    }
  }
  if (!DRY && removed) {
    writeFileSync(POOL_FILE, JSON.stringify(poolDoc, null, 2) + "\n", "utf8");
    console.log(`استخر: ${removed} URL مصرف‌شده حذف شد (مجموعهٔ تازه برای نوبت بعدی)`);
  }
}

console.log(`[qa-repair-pins] ${fixes.length} پین اصلاح شد، ${failedAfterAll.length} ناموفق`);
if (fixes.length) console.log(fixes.slice(0, 40).join("\n"));
if (failedAfterAll.length) console.log("ناموفق‌ها:\n" + failedAfterAll.slice(0, 20).join("\n"));

if (!DRY && fixes.length) {
  writeFileSync(GEN_FILE, JSON.stringify(pins, null, 2) + "\n", "utf8");
  console.log("→ inspirations.generated.json به‌روز شد");
} else if (DRY) {
  console.log("[dry] فایل نوشته نشد");
}

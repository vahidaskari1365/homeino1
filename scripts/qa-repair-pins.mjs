#!/usr/bin/env node
// ============================================================
// HOMEINO — ترمیم وفاداری موضوع + عکس‌های مرده در پین‌های الهام
// دو کلاس خرابی را پیدا و عکس را از منبع پایدارِ همموضوع جایگزین می‌کند:
//   ① پین‌هایی که عکسشان از فضای دیگری است (قربانیان فال‌بک خواهر قدیمی)
//   ② پین‌هایی که عکسشان مرده است (مثل لینک‌های منقضی z-cdn)
// جایگزینی به ترتیب: عکس مصرف‌نشده از POOL[style][room] → جستجوی زندهٔ z-ai
// روی دامنه‌های پایدار + QA بصری.
// اجرا: node scripts/qa-repair-pins.mjs [--dry]
// ============================================================
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry");
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
const pool = JSON.parse(readFileSync(POOL_FILE, "utf8")).pool || {};

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

// دامنه‌های پایدار — لینک‌های z-cdn/chatglm منقضی می‌شوند و دیگر پذیرفته نمی‌شوند
const STABLE_DOMAINS = [
  "images.pexels.com", "images.unsplash.com", "cdn.pixabay.com",
  "upload.wikimedia.org", "live.staticflickr.com", "images.adsttc.com",
  "cdn.home-designing.com",
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

async function inParallel(items, fn, size = 12) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) await fn(items[i++]);
  }));
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

function pickAlive(cands) {
  // فقط عکس زنده — استخر هم پر از لینک‌های منقضی‌شدنی است
  for (const c of cands.slice(0, 4)) {
    if (!isDeadSync(c.url)) return c;
  }
  return null;
}

function isDeadSync(url) {
  try {
    const out = execFileSync("curl", ["-s", "-o", "/dev/null", "-I", "-L", "--max-time", "9", "-A", UA["User-Agent"], "-w", "%{http_code}", url], { encoding: "utf8", timeout: 15000 });
    const code = parseInt(out.trim().split("\n").pop());
    return !(code >= 200 && code < 300 || code === 302 || code === 304);
  } catch {
    return true;
  }
}

const PINS_IMG_DIR = join(ROOT, "public", "images", "pins");

/** عکس را همین حالا (وقتی زنده است) دانلود و داخل ریپو میزبان می‌کند — ضد انقضا */
function selfHost(pinId, url) {
  try {
    const { mkdirSync, statSync } = requireNfs();
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
function requireNfs() {
  return { mkdirSync, statSync, unlinkSync, existsSync };
}

for (const p of pins) {
  if (!p.image || !p.styleSlug || !p.room) continue;
  const places = urlPlaces.get(p.image);
  const SPACE_ALIAS = { "حیاط و محوطه": "بیرونی" }; // هم‌گام با inspiration-daily
  const okProv =
    !places ||
    places.includes(`${p.styleSlug}:${p.room}`) ||
    (SPACE_ALIAS[p.room] && places.includes(`${p.styleSlug}:${SPACE_ALIAS[p.room]}`)) ||
    places.every((sp) => sp.startsWith("_products:")); // پین محصول‌محور: عکس محصول مجاز است
  if (okProv) continue;
  // ① قربانی فال‌بک خواهر — باید عکس درست شود (جایگزین → سلف-هاست)
  const direct = pool[p.styleSlug]?.[p.room] || [];
  let replacement = pickAlive(direct.filter((c) => !seen.has(c.url)));
  let prov = replacement ? `pool:${p.styleSlug}:${p.room}` : null;
  if (!replacement && HAS_ZAI) {
    const q = `${EN_STYLE[p.styleSlug] || p.styleSlug} ${EN_SPACE[p.room] || p.room} layout`;
    const cands = searchImage(q).filter((c) => !seen.has(c.url) && c.w >= 600 && (c.h || 900) >= 450);
    for (const c of cands.slice(0, 3)) {
      const tmp = downloadTmp(c.url);
      if (!tmp) continue;
      const v = visionOk(tmp, p.styleSlug, p.room);
      if (v.ok) { replacement = c; prov = `search-fixed:${p.styleSlug}:${p.room}`; break; }
    }
  }
  if (replacement) {
    const local = selfHost(p.id, replacement.url);
    if (!local) { fails.push(`${p.id}: دانلود جایگزین ناموفق`); continue; }
    fixes.push(`${p.id} (${p.styleSlug}/${p.room}): عکس اشتباه از ${places.join("،")} → سلف-هاست شد`);
    seen.delete(p.image);
    p.image = local;
    p._prov = `local|${prov}`;
    seen.add(local);
  } else {
    fails.push(`${p.id} (${p.styleSlug}/${p.room}): جایگزین پیدا نشد — عکس اشتباه باقی ماند`);
  }
}

// ② پین‌های مرده — لینک‌های منقضی (مثل z-cdn) را در سراسر پین‌ها پیدا کن
const deadCandidates = [];
await inParallel(pins.filter((p) => p.image), async (p) => {
  if (await isDead(p.image)) deadCandidates.push(p);
});
console.log(`مرده‌ها: ${deadCandidates.length} پین`);

for (const p of deadCandidates) {
  // کلاس پین را تشخیص بده: محصول‌محور (عکس از استخر محصول) یا سبک×فضا
  const SPACE_ALIAS2 = { "حیاط و محوطه": "بیرونی" };
  const itsPlaces = urlPlaces.get(p.image) || [];
  const isProductPin =
    (typeof p._prov === "string" && (p._prov.startsWith("products:") || p._prov.startsWith("local|products:"))) ||
    (itsPlaces.length > 0 && itsPlaces.every((sp) => sp.startsWith("_products:")));
  let replacement = null;
  let prov = null;
  if (isProductPin) {
    // جایگزین فقط از همان استخر محصول — عکس فضا برای پین محصول نامرتبط است
    const slug = typeof p._prov === "string" && p._prov.includes("products:")
      ? p._prov.split("products:")[1].trim()
      : (itsPlaces[0] || "").replace("_products:", "").trim();
    const productBucket = POOL?._products?.[slug] || [];
    replacement = pickAlive(productBucket.filter((c) => !seen.has(c.url)));
    prov = replacement ? `products:${slug}` : null;
  }
  if (!replacement) {
    const direct = pool[p.styleSlug]?.[p.room] || pool[p.styleSlug]?.[SPACE_ALIAS2[p.room]] || [];
    replacement = pickAlive(direct.filter((c) => !seen.has(c.url)));
    prov = replacement ? `pool:${p.styleSlug}:${p.room}` : null;
  }
  if (!replacement && HAS_ZAI) {
    const q = `${EN_STYLE[p.styleSlug] || p.styleSlug} ${EN_SPACE[p.room] || p.room} layout`;
    // سلف-هاست می‌کنیم → دامنهٔ پایدار لازم نیست؛ کافیست همین حالا زنده و همموضوع باشد
    const cands = searchImage(q).filter((c) => !seen.has(c.url) && c.w >= 600 && (c.h || 900) >= 450);
    for (const c of cands.slice(0, 4)) {
      const tmp = downloadTmp(c.url);
      if (!tmp) continue;
      const v = visionOk(tmp, p.styleSlug, p.room);
      if (v.ok) { replacement = c; prov = `search-fixed:${p.styleSlug}:${p.room}`; break; }
    }
  }
  if (replacement) {
    const local = selfHost(p.id, replacement.url);
    if (!local) { fails.push(`${p.id}: دانلود جایگزین ناموفق`); continue; }
    fixes.push(`${p.id} (${p.styleSlug}/${p.room}): عکس مرده → سلف-هاست (${prov || ""})`);
    seen.delete(p.image);
    p.image = local;
    p._prov = `local|${prov || ""}`;
    seen.add(local);
  } else {
    fails.push(`${p.id} (${p.styleSlug}/${p.room}): عکس مرده و جایگزین پیدا نشد`);
  }
}

console.log(`[qa-repair-pins] ${fixes.length} پین اصلاح شد، ${fails.length} ناموفق`);
if (fixes.length) console.log(fixes.join("\n"));
if (fails.length) console.log("ناموفق‌ها:\n" + fails.join("\n"));

if (!DRY && fixes.length) {
  writeFileSync(GEN_FILE, JSON.stringify(pins, null, 2) + "\n", "utf8");
  console.log("→ inspirations.generated.json به‌روز شد");
} else if (DRY) {
  console.log("[dry] فایل نوشته نشد");
}

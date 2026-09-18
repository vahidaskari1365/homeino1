#!/usr/bin/env node
// ============================================================
// HOMEINO — سازندهٔ استخر کاور مجله (ابزار سندباکس)
// برای هر دسته ۲ کاور جدید با z-ai می‌سازد، با vision گیت QA بصری دارد،
// خروجی را به public/images/trends/covers می‌ریزد و مانیفست
// scripts/cover-pool.json را می‌سازد (کاورهای موجود + جدید، دسته‌بندی‌شده).
// اجرا: node scripts/build-cover-pool.mjs [--force]
// ============================================================
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "images", "trends", "covers");
const MANIFEST = join(ROOT, "scripts", "cover-pool.json");
const FORCE = process.argv.includes("--force");
const CONCURRENCY = parseInt(process.env.CONC || "4", 10);

// دو پرامپت ایدیتوریال برای هر دسته فعال (۱۲ دسته) — پالت گرم هماهنگ با برند هومینو
const PROMPTS = {
  "رنگ": [
    "Editorial interior design magazine photo: living room with terracotta painted accent wall, cream boucle sofa, warm morning light, architectural photography, no text",
    "Interior magazine photo: painter ladder and large paint color swatches on wall of elegant dining room, soft daylight, muted earthy palette, no text",
  ],
  "مبلمان": [
    "Editorial furniture photography: sculptural curved sofa in bright modern living room, oak floor, professional interior magazine shoot, warm tones, no text",
    "Interior design magazine photo: elegant walnut sideboard with ceramic vases and warm lighting, shallow depth of field, no text",
  ],
  "آشپزخانه": [
    "Editorial kitchen photography: modern kitchen with warm oak wood cabinetry, stone countertop, terracotta accessories, soft morning light, no text",
    "Interior magazine photo: cozy kitchen corner with open oak shelves, ceramic dishes, warm sunlight, professional shoot, no text",
  ],
  "حمام": [
    "Editorial bathroom photography: spa-like wetroom with microcement walls, oak vanity, walk-in glass shower, warm neutral tones, no text",
    "Interior magazine photo: serene bathroom with freestanding bathtub, beige stone tiles, soft diffused light, no text",
  ],
  "متریال": [
    "Editorial material photography: flat lay of interior material samples, oak wood, marble, brass, linen fabric, warm studio light, no text",
    "Interior detail photo: close-up of travertine wall texture with brass wall lamp, warm tones, magazine quality, no text",
  ],
  "سبک زندگی": [
    "Editorial lifestyle photography: cozy reading nook with linen armchair, wool throw, stack of books, warm afternoon light through sheer curtains, no text",
    "Interior magazine photo: calm morning scene, coffee tray on oak coffee table, cream sofa, soft shadows, no text",
  ],
  "سبک‌ها": [
    "Editorial interior photography: japandi style living room, low oak furniture, paper lantern, warm neutral palette, magazine shoot, no text",
    "Interior magazine photo: elegant eclectic living room mixing vintage and modern furniture, warm earthy palette, no text",
  ],
  "هوشمند": [
    "Editorial interior photography: modern living room with subtle smart home wall control panel, warm lighting scenes, minimal design, no text",
    "Interior magazine photo: minimalist hallway with hidden smart lighting strips, warm wood and cream tones, no text",
  ],
  "ویلا و باغ": [
    "Editorial architecture photography: modern villa garden with olive trees, stone path, outdoor lounge, golden hour light, no text",
    "Interior magazine photo: bright garden room conservatory with rattan furniture and lush plants, no text",
  ],
  "حیاط و بیرونی": [
    "Editorial outdoor photography: cozy patio with terracotta tiles, wooden pergola, outdoor sofa with cushions, string lights at dusk, no text",
    "Interior magazine photo: mediterranean courtyard with white walls, blue accents, potted lemon trees, sunny day, no text",
  ],
  "محیط کار": [
    "Editorial interior photography: warm home office with oak desk, ergonomic chair, shelves of books, natural window light, no text",
    "Interior magazine photo: creative studio workspace with moodboard on wall, warm wood tones, daylight, no text",
  ],
  "وسایل ترند": [
    "Editorial product photography: statement curved armchair in terracotta velvet, warm studio backdrop, magazine quality, no text",
    "Interior magazine photo: sculptural floor lamp and ceramic vase styling on oak console table, warm tones, no text",
  ],
};

// کاورهای قدیمی موجود — دستهٔ اصلی هر کدام (برای LRU هم استفاده می‌شوند)
const LEGACY = {
  "رنگ": ["/images/trends/trends-color-year.png", "/images/trends/trends-colors-persian.png"],
  "مبلمان": ["/images/trends/trends-neo-deco.png"],
  "آشپزخانه": ["/images/trends/trends-kitchen-wood.png"],
  "حمام": ["/images/trends/trends-wetroom.png"],
  "متریال": ["/images/trends/trends-chrome-wood.png"],
  "سبک زندگی": ["/images/trends/trends-zoning.png"],
  "سبک‌ها": ["/images/trends/trends-guide-2026.png"],
  "وسایل ترند": ["/images/trends/trends-gem-maxxing.png"],
  "محیط کار": ["/images/trends/trends-patterns-story.png"],
};

const FA_SLUG = {
  "رنگ": "rang", "مبلمان": "mobleman", "آشپزخانه": "ashpazkhaneh", "حمام": "hamam",
  "متریال": "material", "سبک زندگی": "zendegi", "سبک‌ها": "sabkha", "هوشمند": "hooshmand",
  "ویلا و باغ": "vila", "حیاط و بیرونی": "hayat", "محیط کار": "mahitkar", "وسایل ترند": "vasayel",
};

function zaiImage(prompt, out) {
  execFileSync("z-ai", ["image", "-p", prompt, "-o", out, "-s", "1344x768"], { timeout: 240000 });
}

function visionOk(file, categoryFa) {
  try {
    const out = join(OUT_DIR, ".vision-tmp.json");
    execFileSync("z-ai", ["vision", "-i", file, "-p",
      `این عکس برای کاور مقالهٔ مجلهٔ آنلاین دکوراسیون داخلی با موضوع «${categoryFa}» استفاده می‌شود. ` +
      "اگر عکس ① فضای داخلی/خارجی مرتبط با موضوع باشد ② بدون متن، لوگو یا واترمارک باشد ③ کیفیت حرفه‌ای مجله‌ای داشته باشد، فقط JSON بده: {\"ok\":true} وگرنه {\"ok\":false,\"reason\":\"...\"}",
      "-o", out], { timeout: 120000 });
    const j = JSON.parse(readFileSync(out, "utf8"));
    const text = j.choices?.[0]?.message?.content ?? "";
    const m = text.match(/\{[\s\S]*\}/);
    return m ? JSON.parse(m[0]) : { ok: false, reason: "unparseable" };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function pool(tasks, n) {
  const results = [];
  let idx = 0;
  async function worker() {
    while (idx < tasks.length) {
      const my = idx++;
      results[my] = await tasks[my]();
    }
  }
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

async function main() {
  // حالت سریع: مانیفست را از فایل‌های موجود رو دیسک بازسازی کن (بدون فراخوانی API)
  if (process.argv.includes("--manifest-only")) {
    mkdirSync(OUT_DIR, { recursive: true });
    const slugToCat = Object.fromEntries(Object.entries(FA_SLUG).map(([cat, slug]) => [slug, cat]));
    const manifest = {};
    for (const cat of Object.keys(PROMPTS)) manifest[cat] = [];
    for (const f of readdirSync(OUT_DIR)) {
      const m = f.match(/^trends-c-(.+)-\d+\.jpg$/);
      if (!m) continue;
      const cat = slugToCat[m[1]];
      if (cat) manifest[cat].push(`/images/trends/covers/${f}`);
    }
    for (const [cat, files] of Object.entries(LEGACY)) {
      if (!manifest[cat]) manifest[cat] = [];
      for (const f of files) if (!manifest[cat].includes(f)) manifest[cat].unshift(f);
    }
    manifest._default = ["/images/trends/trends-guide-2026.png", ...new Set(Object.values(LEGACY).flat())].slice(0, 8);
    writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
    console.log(`[cover-pool] مانیفست از دیسک بازسازی شد: ${Object.entries(manifest).filter(([k]) => k !== "_default").map(([c, f]) => `${c}:${f.length}`).join(" ، ")}`);
    return;
  }
  mkdirSync(OUT_DIR, { recursive: true });
  const jobs = [];
  for (const [cat, prompts] of Object.entries(PROMPTS)) {
    prompts.forEach((prompt, i) => {
      const file = join(OUT_DIR, `trends-c-${FA_SLUG[cat]}-${i + 1}.jpg`);
      const publicPath = `/images/trends/covers/trends-c-${FA_SLUG[cat]}-${i + 1}.jpg`;
      jobs.push({ cat, prompt, file, publicPath });
    });
  }
  console.log(`[cover-pool] ${jobs.length} کاور برای ${Object.keys(PROMPTS).length} دسته — همزمانی ${CONCURRENCY}`);

  let idx = 0;
  async function buildOne(job) {
    const my = ++idx;
    await new Promise((r) => setTimeout(r, (my % CONCURRENCY) * 5000)); // استقرار تدریجی ضد ۴۲۹
    const label = `${job.cat} #${my}`;
    if (existsSync(join(ROOT, "." + job.publicPath)) && !FORCE) {
      console.log(`  ⏭ ${label} موجود است`);
      return { ...job, ok: true, skipped: true };
    }
    const tmp = job.file.replace(/\.jpg$/, ".png");
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        zaiImage(attempt === 1 ? job.prompt : job.prompt + ", wide angle editorial composition", tmp);
        if (!existsSync(tmp) || statSync(tmp).size < 20000) throw new Error("file too small/missing");
        const v = visionOk(tmp, job.cat);
        if (v.ok) {
          renameSync(tmp, job.file);
          console.log(`  ✓ ${label}`);
          return { ...job, ok: true };
        }
        console.log(`  ↻ ${label} vision رد کرد (${v.reason}) — تلاش ${attempt + 1}`);
      } catch (e) {
        console.log(`  ✗ ${label} تلاش ${attempt}: ${e.message}`);
      }
    }
    return { ...job, ok: false };
  }
  const results = await pool(jobs.map((j) => () => buildOne(j)), CONCURRENCY);
  const ok = results.filter((r) => r.ok && !r.skipped);
  const failed = results.filter((r) => !r.ok);
  console.log(`[cover-pool] ساخته‌شده: ${ok.length} | قبلاً موجود: ${results.filter((r) => r.skipped).length} | ناموفق: ${failed.length}`);

  // مانیفست: کاورهای جدید (در صورت موفقیت) + قدیمی‌ها
  const manifest = {};
  for (const cat of Object.keys(PROMPTS)) manifest[cat] = [];
  for (const r of results) if (r.ok) manifest[r.cat].push(r.publicPath);
  for (const [cat, files] of Object.entries(LEGACY)) {
    if (!manifest[cat]) manifest[cat] = [];
    for (const f of files) if (!manifest[cat].includes(f)) manifest[cat].unshift(f);
  }
  // دسته‌های بدون کاور قدیمی: از عمومی استفاده می‌کنند
  manifest._default = ["/images/trends/trends-guide-2026.png", ...Object.values(LEGACY).flat().slice(0, 5)];
  writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + "\n", "utf8");
  console.log(`[cover-pool] مانیفست → ${MANIFEST}`);
  if (failed.length) {
    console.log(`ناموفق‌ها: ${failed.map((f) => f.cat).join("، ")} — با --force دوباره اجرا کنید`);
    process.exitCode = 2;
  }
}

main().catch((e) => { console.error("[cover-pool] FATAL", e); process.exit(1); });

/**
 * visual-qa — گیت کنترل کیفیت بصری مجله (داخل خط تولید، قبل از انتشار)
 * ============================================================
 * هدف: «بریف بد اصلاً منتشر نشود» — نه اینکه بعداً واچ‌داگ گیرش بیندازد.
 *
 * با پایپ‌لاین کاور (Task 43/51: og منبع → وب هم‌موضوع → تولید → استخر)
 * هم‌زیستی دارد: کاورهای خارجی (og/وب/پین) فقط از نظر «تکراری بودن در یک روز»
 * چک می‌شوند؛ کاورهای استخر پایه (trends-*.png) علاوه بر آن باید به دسته
 * بریف «مرتبط» باشند. لایه‌ها:
 *
 *   ۱) planCovers       — گیت کاور برای بریف‌های تازهٔ یک ران: ارتباط + یکتایی + LRU
 *   ۲) repairConflicts  — ترمیم کاور تکراری «یک روز» / نامرتبط (استخر پایه) در کل فایل
 *                          با تطبیق دوب‌جزئی (محتاترین‌اول + مسیرافزای Kuhn)
 *   ۳) auditFile        — آدیت صادقانهٔ کل فایل (بدون تغییر)
 *   ۴) relevantCoverCandidates / lruCoverPick — کمک‌تابع‌های ترتیب ارتباطی و LRU
 *
 * اجرای مستقل (آدیت+ترمیم فایل فعلی):  node scripts/lib/visual-qa.mjs [--fix]
 * (npm run magazine:qa / magazine:qa:fix)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(__dirname, "..", "..");
export const TRENDS_FILE = path.join(REPO, "src", "content", "trends", "trends.json");

const COVERS_DIR = "/images/trends/";
/** کاور استخر پایه — فقط اینها برچسب بصری دقیق و قاعدهٔ ارتباط سخت دارند */
const BASE_COVER_RE = /^\/images\/trends\/trends-[a-z0-9-]+\.(png|jpg|jpeg|webp)$/;

/**
 * برچسب بصری واقعی هر کاور پایه — بر اساس بازبینی چشمی تصاویر (۲۰۲۶-۰۹-۱۹).
 * کاورهای AI (پوشهٔ covers/) در build-cover-pool.mjs گیت بینایی شده‌اند؛
 * برچسب آنها در حد «هم‌دسته بودن» ثبت می‌شود.
 */
export const COVER_TAGS = {
  "trends-color-year.png": ["پالت رنگ", "دیوار رنگ‌شده", "مبل با کوسن رنگی", "رنگ سال"],
  "trends-neo-deco.png": ["مبل مخمل سبز", "مرمر", "چوب لوکس", "آرت‌دکو"],
  "trends-kitchen-wood.png": ["آشپزخانه چوبی", "کابینت", "جزیره آشپزخانه"],
  "trends-kitchen-stone.png": ["جزیره مرمری", "شیر آب مشکی", "آشپزخانه سنگی مدرن"],
  "trends-kitchen-shelf.png": ["قفسه باز چوبی", "ظروف سفالی", "آشپزخانه اسکاندیناوی"],
  "trends-kitchen-olive.png": ["کابینت زیتونی", "یراق برنجی", "گیاه و ادویه روی کانتر"],
  "trends-patio-living.png": ["پیش‌فضا و پرگولا", "مبلمان بیرونی", "زیتون در گلدان"],
  "trends-garden-terrace.png": ["باغ حیاط پشتی", "مسیر سنگی", "میز ناهارخوری بیرونی"],
  "trends-rooftop-outdoor.png": ["تراس پشت‌بام", "نمای شهر", "مبلمان حصیری بیرونی"],
  "trends-paint-swatches.png": ["قوطی رنگ", "سواچ و پالت رنگی", "ابزار نقاشی ساختمان"],
  "trends-wetroom.png": ["حمام", "وان و دوش", "نورپردازی LED", "گیاه در حمام", "اسپا"],
  "trends-chrome-wood.png": ["چراغ کروم", "کنسول چوبی", "کتاب و اکسسوری", "متریال کروم"],
  "trends-zoning.png": ["گوشهٔ نشیمن", "مبل تک‌نفره", "کتابخانه", "زون‌بندی فضا"],
  "trends-guide-2026.png": ["نشیمن مینیمال", "بژ و خنثی", "نشیمن مدرن خنثی", "سبک ژاپاندی"],
  "trends-gem-maxxing.png": ["کریستال و سنگ تزئینی", "آینه طلایی", "دکور ویترین"],
  "trends-patterns-story.png": ["کاغذدیواری پترن‌دار", "قالی رنگی", "رویه‌های نقش‌دار"],
  "trends-colors-persian.png": ["طاق ایرانی", "سفال و کوزه", "قالی ایرانی", "ویلای ایرانی"],
  // کاورهای ایدیتوریال AI (۱۶ عدد) — برچسب هم‌دسته (چشمی‌شده در build-cover-pool.mjs)
  "covers/trends-c-rang-1.jpg": ["رنگ", "پالت"],
  "covers/trends-c-rang-2.jpg": ["رنگ", "پالت"],
  "covers/trends-c-mobleman-1.jpg": ["مبلمان"],
  "covers/trends-c-mobleman-2.jpg": ["مبلمان"],
  "covers/trends-c-ashpazkhaneh-1.jpg": ["آشپزخانه"],
  "covers/trends-c-ashpazkhaneh-2.jpg": ["آشپزخانه"],
  "covers/trends-c-hamam-1.jpg": ["حمام"],
  "covers/trends-c-hamam-2.jpg": ["حمام"],
  "covers/trends-c-material-1.jpg": ["متریال"],
  "covers/trends-c-material-2.jpg": ["متریال"],
  "covers/trends-c-zendegi-1.jpg": ["سبک زندگی"],
  "covers/trends-c-zendegi-2.jpg": ["سبک زندگی"],
  "covers/trends-c-sabkha-1.jpg": ["سبک‌ها"],
  "covers/trends-c-sabkha-2.jpg": ["سبک‌ها"],
  "covers/trends-c-hooshmand-1.jpg": ["هوشمند"],
  "covers/trends-c-hooshmand-2.png": ["هوشمند"],
};

const pub = (file) => (file.startsWith("/") ? file : COVERS_DIR + file);
/** ده واریانت همان استخر محصول (cN-01…cN-10) — همگی هم‌دسته‌اند */
function pinVariants(n) {
  return Array.from({ length: 10 }, (_, i) => `/images/product-pins/c${n}-${String(i + 1).padStart(2, "0")}.jpg`);
}

/**
 * دسته → کاورهای مجاز به ترتیب اولویت. هر دسته ≥۳ گزینه دارد تا در یک رانِ
 * حداکثر ۴ بریفی همیشه بتوان کاور «یکتا و مرتبط» گذاشت.
 */
export const CATEGORY_COVERS = {
  "رنگ": ["trends-color-year.png", "trends-paint-swatches.png", "covers/trends-c-rang-1.jpg", "covers/trends-c-rang-2.jpg", "trends-patterns-story.png", "trends-guide-2026.png"],
  "مبلمان": ["trends-neo-deco.png", "trends-zoning.png", "covers/trends-c-mobleman-1.jpg", "covers/trends-c-mobleman-2.jpg", "trends-guide-2026.png"],
  "آشپزخانه": ["trends-kitchen-wood.png", "trends-kitchen-stone.png", "trends-kitchen-shelf.png", "trends-kitchen-olive.png", "covers/trends-c-ashpazkhaneh-1.jpg", "covers/trends-c-ashpazkhaneh-2.jpg", "trends-chrome-wood.png"],
  "حمام": ["trends-wetroom.png", "covers/trends-c-hamam-1.jpg", "covers/trends-c-hamam-2.jpg", "trends-guide-2026.png", "trends-colors-persian.png"],
  "متریال": ["trends-chrome-wood.png", "trends-neo-deco.png", "covers/trends-c-material-1.jpg", "covers/trends-c-material-2.jpg", "trends-guide-2026.png"],
  "سبک زندگی": ["trends-zoning.png", "trends-guide-2026.png", "covers/trends-c-zendegi-1.jpg", "covers/trends-c-zendegi-2.jpg", "trends-wetroom.png"],
  "سبک‌ها": ["trends-guide-2026.png", "covers/trends-c-sabkha-1.jpg", "covers/trends-c-sabkha-2.jpg", "trends-patterns-story.png", "trends-neo-deco.png", "trends-colors-persian.png", "trends-gem-maxxing.png", "trends-zoning.png"],
  "هوشمند": ["trends-chrome-wood.png", "covers/trends-c-hooshmand-1.jpg", "covers/trends-c-hooshmand-2.png", "trends-zoning.png", "trends-wetroom.png"],
  "تزئین": ["trends-gem-maxxing.png", "trends-patterns-story.png", "trends-colors-persian.png"],
  "نقش": ["trends-patterns-story.png", "trends-colors-persian.png", "trends-neo-deco.png"],
  "ویلا و باغ": ["trends-colors-persian.png", "trends-garden-terrace.png", "trends-patio-living.png", "trends-zoning.png", "trends-wetroom.png"],
  "حیاط و بیرونی": ["trends-colors-persian.png", "trends-patio-living.png", "trends-garden-terrace.png", "trends-rooftop-outdoor.png", "trends-zoning.png"],
  "محیط کار": ["trends-zoning.png", "trends-chrome-wood.png", "trends-guide-2026.png"],
  "وسایل ترند": ["trends-chrome-wood.png", "trends-gem-maxxing.png", "trends-neo-deco.png"],
  // دسته‌های محصول‌محور — استخر عکس همان دسته (همهٔ واریانت‌ها هم‌دسته‌اند)
  "فرش و قالیچه": pinVariants(2),
  "کف‌پوش": pinVariants(3),
  "روشنایی و لوستر": pinVariants(4),
  "تابلو و دیوارکوب": pinVariants(5),
  "گلدان و گیاه": pinVariants(6),
  "پرده و منسوجات": pinVariants(7),
  "دکوری و اکسسوری": pinVariants(8),
  "کمد و ذخیره‌سازی": pinVariants(9),
  "دیوارپوش": pinVariants(10),
};

const PLACEHOLDER_RE = /(\.\.\.|\u2026|\bTBD\b|lorem|ipsum)/i; // ... یا … یا TBD
const PERSIAN_RE = /[\u0600-\u06FF]/;
const SENTENCE_END_RE = /[.!?\u061F\u06D4]/g; // . ! ? ؟ ۔

export function qaIssues(brief) {
  const issues = [];
  const title = String(brief.title || "").trim();
  const summary = String(brief.summary || "").trim();
  const takeaway = String(brief.takeaway || "").trim();

  if (title.length < 10) issues.push("عنوان خیلی کوتاه است");
  if (title.length > 110) issues.push("عنوان بلندتر از سقف ۱۱۰ کاراکتر است");
  if (!PERSIAN_RE.test(title)) issues.push("عنوان فارسی نیست");
  if (PLACEHOLDER_RE.test(title)) issues.push("عنوان جای‌نگهدار دارد");

  if (summary.length < 200) issues.push("خلاصه کوتاه‌تر از حداقل ۲۰۰ کاراکتر است");
  if (summary.length > 1600) issues.push("خلاصه بلندتر از سقف ۱۶۰۰ کاراکتر است");
  if (PLACEHOLDER_RE.test(summary)) issues.push("خلاصه جای‌نگهدار دارد");
  const sentences = (summary.match(SENTENCE_END_RE) || []).length;
  if (sentences < 2) issues.push("خلاصه کمتر از ۳ جمله است");

  if (takeaway.length < 20) issues.push("پیام کاربردی («برای خانه ایرانی») خیلی کوتاه است");
  if (PLACEHOLDER_RE.test(takeaway)) issues.push("پیام کاربردی جای‌نگهدار دارد");

  if (!Array.isArray(brief.tags) || brief.tags.filter(Boolean).length < 2) {
    issues.push("کمتر از ۲ برچسب");
  }
  if (!/^https:\/\//.test(String(brief.source?.url || ""))) issues.push("لینک منبع https نیست");

  return issues;
}

/** فایل کاور واقعاً روی دیسک هست؟ (کاورهای runtime مانند src/ همیشه «هستند») */
function coverExists(publicPath) {
  if (!publicPath) return false;
  if (!publicPath.startsWith("/images/")) return true; // مسیر خارجی/CDN
  const m = publicPath.match(/^\/images\/trends\/src\//);
  if (m) return true; // در زمان تولید دانلود می‌شود
  return fs.existsSync(path.join(REPO, "public", publicPath));
}

/** ترتیب LRU کاورها بر اساس «آخرین استفاده» در آرشیو (کم‌استفاده‌تر = اولویت بالاتر) */
function lruOrder(existingBriefs) {
  const lastUsed = new Map();
  for (const b of existingBriefs) {
    const file = String(b.cover || "");
    if (!file) continue;
    const t = Date.parse(`${b.date}T12:00:00Z`) || 0;
    if (!lastUsed.has(file) || lastUsed.get(file) < t) lastUsed.set(file, t);
  }
  return (candidates) =>
    [...candidates].sort((a, b) => (lastUsed.get(a) ?? -1) - (lastUsed.get(b) ?? -1));
}

/**
 * گیت کاور برای بریف‌های تازهٔ یک ران:
 *   - فقط کاور مرتبط با دسته (از CATEGORY_COVERS، با فیلتر وجود فایل)
 *   - یکتا در کل ران (دو بریف یک روز هرگز کاور مشترک نمی‌گیرند)
 *   - بین مجازها، کم‌استفاده‌ترینِ روزهای اخیر (LRU) انتخاب می‌شود
 * خروجی: { assignments: [cover|null], rejects: [{title, reason}] }
 */
export function planCovers(drafts, existingBriefs = []) {
  const lru = lruOrder(existingBriefs);
  const usedInRun = new Set();
  const assignments = [];
  const rejects = [];

  for (const d of drafts) {
    const allowed = (CATEGORY_COVERS[d.category] || []).map(pub).filter(coverExists);
    if (allowed.length === 0) {
      rejects.push({ title: d.title, reason: `دسته «${d.category}» کاور مرتبطِ در دسترس ندارد` });
      assignments.push(null);
      continue;
    }
    const free = lru(allowed.filter((c) => !usedInRun.has(c)));
    if (free.length === 0) {
      rejects.push({
        title: d.title,
        reason: `همه کاورهای مجاز دسته «${d.category}» در این ران مصرف شده — برای جلوگیری از کاور تکراری منتشر نمی‌شود`,
      });
      assignments.push(null);
      continue;
    }
    const pick = free[0];
    usedInRun.add(pick);
    assignments.push(pick);
  }
  return { assignments, rejects };
}

/**
 * ترمیم فایل کامل — دو نوع خطا را درمان می‌کند:
 *   ① کاور تکراری در «یک روز» (هر منبعی)
 *   ② کاور استخر پایه که به دسته بریف مرتبط نیست
 * کاورهای خارجی (og/وب/پین) از قاعدهٔ ارتباط معاف‌اند — از خود منبع می‌آیند.
 * الگوریتم: محتاترین بریف اول + تطبیق دوب‌جزئی (Kuhn) برای بیشترین پوشش.
 */
export function repairConflicts(briefs) {
  const perDate = new Map(); // date → Map(cover → count)
  for (const b of briefs) {
    if (!perDate.has(b.date)) perDate.set(b.date, new Map());
    const m = perDate.get(b.date);
    m.set(b.cover, (m.get(b.cover) || 0) + 1);
  }

  const repairs = [];
  const unresolved = [];
  const assignments = new Map(); // index → new cover

  const byDateIdx = new Map();
  briefs.forEach((b, i) => {
    if (!byDateIdx.has(b.date)) byDateIdx.set(b.date, []);
    byDateIdx.get(b.date).push({ b, i });
  });

  for (const [date, items] of byDateIdx) {
    const dayCounts = perDate.get(date);
    const offenders = [];
    const keeperCovers = new Set();

    for (const { b, i } of items) {
      const allowed = (CATEGORY_COVERS[b.category] || []).map(pub);
      const isBase = BASE_COVER_RE.test(String(b.cover || ""));
      const isDup = (dayCounts.get(b.cover) || 0) > 1;
      const isMismatch = isBase && allowed.length > 0 && !allowed.includes(b.cover);
      if (isDup || isMismatch) offenders.push({ b, i, allowed, isDup, isMismatch });
      else keeperCovers.add(b.cover);
    }
    if (offenders.length === 0) continue;

    // کاندیدها: مجازِ دسته (موجود روی دیسک) منهای کاورِ نگه‌دارنده‌ها
    const candidates = offenders.map((o) => ({
      ...o,
      cands: o.allowed.filter((c) => !keeperCovers.has(c) && coverExists(c)),
    }));
    candidates.sort((a, b) => a.cands.length - b.cands.length); // محتاترین اول

    // تطبیق Kuhn — بیشینهٔ تخصیص یکتا
    const owner = new Map(); // cover → offender key
    const tryAssign = (o, visited) => {
      for (const c of o.cands) {
        if (visited.has(c)) continue;
        visited.add(c);
        if (!owner.has(c) || tryAssign(candidates[owner.get(c)], visited)) {
          owner.set(c, o.key);
          o.assigned = c;
          return true;
        }
      }
      return false;
    };
    candidates.forEach((o, oi) => { o.key = oi; });
    for (const o of candidates) tryAssign(o, new Set());

    for (const o of candidates) {
      if (o.assigned && o.assigned !== o.b.cover) {
        assignments.set(o.i, o.assigned);
        repairs.push({ date, title: o.b.title, from: o.b.cover, to: o.assigned, why: o.isDup ? "duplicate" : "mismatch" });
      } else if (!o.assigned) {
        unresolved.push({ date, title: o.b.title, cover: o.b.cover, reason: "کاور آزادِ مرتبطی برای آن روز نماند" });
      }
    }
  }

  const out = briefs.map((b, i) => (assignments.has(i) ? { ...b, cover: assignments.get(i) } : b));
  return { briefs: out, repairs, unresolved };
}

/** آدیت کامل فایل فعلی — گزارش صادقانه بدون تغییر */
export function auditFile(briefs) {
  const problems = [];
  const byDate = new Map();
  for (const b of briefs) {
    if (!byDate.has(b.date)) byDate.set(b.date, []);
    byDate.get(b.date).push(b);
  }
  for (const [date, list] of byDate) {
    const covers = list.map((b) => b.cover);
    const seen = new Set();
    const dupCovers = new Set();
    for (const c of covers) {
      if (seen.has(c)) dupCovers.add(c);
      seen.add(c);
    }
    for (const c of dupCovers) {
      problems.push({ date, kind: "cover_duplicate", cover: c, count: covers.filter((x) => x === c).length });
    }
  }
  // کاور پایهٔ ناشناخته/نامرتبط — فقط برای استخر پایه؛ og/وب/پین معاف‌اند
  for (const b of briefs) {
    const c = String(b.cover || "");
    if (!BASE_COVER_RE.test(c)) continue;
    const file = c.replace(COVERS_DIR, "");
    if (!COVER_TAGS[file]) {
      problems.push({ date: b.date, kind: "cover_unknown", cover: c, title: b.title });
      continue;
    }
    const allowed = CATEGORY_COVERS[b.category] || [];
    if (allowed.length > 0 && !allowed.includes(file)) {
      problems.push({ date: b.date, kind: "cover_mismatch", cover: c, category: b.category });
    }
  }
  return problems;
}

/** ترتیب ارتباطی کاورهای فال‌بک برای یک دسته — کمک‌تابع پایپ‌لاین */
export function relevantCoverCandidates(category) {
  return (CATEGORY_COVERS[category] || []).map(pub);
}

/** بین کاندیدها کم‌استفاده‌ترینِ آرشیو (LRU) — به‌جای انتخاب تصادفی */
export function lruCoverPick(candidates, existingBriefs) {
  const lru = lruOrder(existingBriefs);
  const ordered = lru(candidates.filter(coverExists));
  return ordered[0] ?? null;
}

/** CLI مستقل: node scripts/lib/visual-qa.mjs [--fix] */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const fix = process.argv.includes("--fix");
  const db = JSON.parse(fs.readFileSync(TRENDS_FILE, "utf8"));
  const briefs = db.briefs ?? [];
  console.log(`[visual-qa] آدیت ${briefs.length} بریف …`);
  const problems = auditFile(briefs);
  if (problems.length === 0) {
    console.log("✅ فایل سالم است — کاور تکراری/نامرتبطی نیست");
  } else {
    for (const p of problems) console.log(`❌ ${p.date} — ${p.kind} — ${p.cover || ""} ${p.title ? `«${p.title.slice(0, 50)}»` : ""}`);
  }
  if (fix && problems.length) {
    const { briefs: fixed, repairs, unresolved } = repairConflicts(briefs);
    const after = auditFile(fixed).filter((p) => p.kind === "cover_duplicate");
    if (after.length === 0) {
      fs.writeFileSync(TRENDS_FILE, `${JSON.stringify({ briefs: fixed }, null, 2)}\n`, "utf8");
      console.log(`🔧 ${repairs.length} کاور ترمیم شد و فایل به‌روز شد`);
      for (const r of repairs) console.log(`   ${r.date} «${r.title.slice(0, 40)}» : ${r.from.split("/").pop()} → ${r.to.split("/").pop()} (${r.why})`);
      for (const u of unresolved) console.log(`⚠ حل‌نشده ${u.date} «${u.title.slice(0, 40)}» — ${u.reason}`);
    } else {
      console.log("⚠ پس از ترمیم هم تداخل ماند — دستی بررسی شود:", after);
      process.exit(1);
    }
  }
}

#!/usr/bin/env node
// ============================================================
// HOMEINO — ناظر سایت (site-watchdog) — Task 43
// ============================================================
// ایجنت سرپرست: کل سایت و بقیهٔ ایجنت‌ها را زیر نظر دارد و
// «تأیید نهایی سلامت» را صادر می‌کند. روزی دو بار + اجرای دستی.
//
// چک‌ها:
//   ① صفحات پروداکشن (۸ صفحه: ۲۰۰ + محتوای فارسی + زمان پاسخ)
//   ② APIهای حیاتی (health/products/categories/ai-status)
//   ③ پروب زندهٔ AI (چت سبک — بدون خرج زنجیرهٔ تولید عکس)
//   ④ سلامت محتوا: بریف‌ها (تعداد/تازگی)، یکتایی کاورها (مسیر+md5)،
//      نبود کاور جنریک pool، وجود فایل همهٔ کاورها، پین‌های الهام،
//      مقالهٔ مجله، باقیماندهٔ استخر عکس
//   ⑤ وضعیت آخرین اجرای هر ورک‌فلوی ایجنت (GitHub API)
//   ⑥ تازگی دیپلوی پروداکشن (Vercel API — اختیاری با VERCEL_TOKEN)
//   ⑦ یادآور انقضای توکن مانیتورینگ (PAT_EXPIRES_AT)
//
// خروجی: لاگ اجرا (site-watchdog.json → صفحه /agents) + Step Summary
// + ایسوی خودکار روی خطا و بستن خودش بعد از رفع.
// آلارم = خروج ۱. فقط GITHUB_TOKEN داخلی لازم دارد.
// اجرا: node scripts/site-watchdog.mjs
// ============================================================
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const now = Date.now();
const RUN_STARTED = now;
const SITE = process.env.SITE_URL || "https://homeino.vercel.app";
const ISSUE_TITLE = "🚨 ناظر هومینو — سایت یا ایجنت‌ها مشکل دارند";
const md5 = (p) => createHash("md5").update(readFileSync(p)).digest("hex");

function gh(args) {
  return execFileSync("gh", args, { encoding: "utf8", timeout: 60_000 });
}

/** gh امن — نبود gh یا خطای دسترسی، سایت را قرمز نمی‌کند (در Actions همیشه هست) */
function ghSafe(args) {
  try {
    return { ok: true, out: gh(args) };
  } catch (e) {
    const missing = /ENOENT|not found/i.test(String(e?.message || ""));
    return { ok: false, missing, out: "", err: e?.message || String(e) };
  }
}

const checks = [];
const add = (group, name, ok, detail, fix) => checks.push({ group, name, ok: Boolean(ok), detail, fix: fix || "" });

async function fetchWithTimeout(url, ms = 20_000, opts = {}) {
  const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(ms), headers: { "User-Agent": "HomeinoSiteWatchdog/1.0", ...(opts.headers || {}) } });
  return res;
}

// ---------- ① صفحات پروداکشن ----------
const PAGES = [
  { path: "/", marker: "هومینو" },
  { path: "/trends", marker: "ترند" },
  { path: "/magazine", marker: "مجله" },
  { path: "/inspiration", marker: "الهام" },
  { path: "/products", marker: "محصول" },
  { path: "/category/furniture", marker: "مبلمان" },
  { path: "/agents", marker: "ایجنت" },
  { path: "/about", marker: "هومینو" },
];
{
  let okCount = 0;
  const bad = [];
  const times = [];
  for (const p of PAGES) {
    const t0 = Date.now();
    try {
      const res = await fetchWithTimeout(SITE + p.path, 25_000);
      const body = await res.text();
      const ms = Date.now() - t0;
      times.push(ms);
      const ok = res.status === 200 && body.includes(p.marker);
      if (ok) okCount++;
      else bad.push(`${p.path} (${res.status}${body.includes(p.marker) ? "" : "، بدون محتوا"})`);
    } catch (e) {
      bad.push(`${p.path} (${e.name === "TimeoutError" ? "timeout" : "خطا"})`);
    }
  }
  const avg = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
  add("سایت", "صفحات پروداکشن", okCount === PAGES.length, `${okCount}/${PAGES.length} صفحه سالم — میانگین پاسخ ${avg}ms${bad.length ? " — مشکل: " + bad.join("، ") : ""}`, bad.length ? "لاگ آخرین دیپلوی ورسل و وضعیت دیتابیس را چک کنید" : "");
}

// ---------- ② APIهای حیاتی ----------
{
  let dbOk = false, aiEngine = "نامشخص", productCount = 0, categoryCount = 0, aiActive = false;
  try {
    const h = await (await fetchWithTimeout(`${SITE}/api/health`, 20_000)).json();
    dbOk = h?.ok === true && (h?.checks?.db === "ok" || h?.db === "ok");
    aiEngine = h?.checks?.ai || h?.ai || h?.active || "نامشخص";
  } catch {}
  try {
    const ps = await (await fetchWithTimeout(`${SITE}/api/products`, 25_000)).json();
    productCount = ps?.data?.meta?.total ?? ps?.data?.items?.length ?? ps?.data?.length ?? 0;
  } catch {}
  try {
    const cs = await (await fetchWithTimeout(`${SITE}/api/categories`, 20_000)).json();
    categoryCount = cs?.data?.length ?? (Array.isArray(cs) ? cs.length : 0);
  } catch {}
  try {
    const st = await (await fetchWithTimeout(`${SITE}/api/ai/status`, 20_000)).json();
    aiActive = Boolean(st?.active && st.active !== "none");
  } catch {}
  add("سایت", "اتصال دیتابیس (health)", dbOk, dbOk ? "db: ok" : "health پاسخ سالم نداد — اتصال دیتابیس برقرار نیست", "رشتهٔ DATABASE_URL ورسل و وضعیت ساپابیس (Pause نشده باشد) را چک کنید");
  add("سایت", "کاتالوگ محصولات", productCount >= 20, `${productCount} محصول از API`, "ایجنت‌های seed و مایگریشن‌های drizzle را اجرا کنید");
  add("سایت", "دسته‌بندی‌ها", categoryCount >= 5, `${categoryCount} دسته از API`, "seed کاتالوگ را دوباره اجرا کنید");
  add("سایت", "موتور AI", aiActive, `موتور فعال: ${aiEngine}`, "کلیدهای LLM (سیکرت LLM_KEYS_JSON) را بررسی کنید");
}

// ---------- ③ پروب زندهٔ AI (اکشن بی‌لاگین advice — سرویس محصول + دیتابیس) ----------
{
  try {
    const res = await fetchWithTimeout(`${SITE}/api/ai`, 40_000, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "advice", payload: { topic: "pair", slug: "console-line" } }),
    });
    const j = await res.json().catch(() => null);
    const hasAdvice = Boolean(j?.advice?.text || (typeof j?.advice === "string" && j.advice.length > 10));
    add("سایت", "پروب زندهٔ سرویس AI (advice)", res.status === 200 && hasAdvice, `HTTP ${res.status} — ${hasAdvice ? "پاسخ واقعی گرفت (متن پیشنهاد ست‌شدن محصول)" : "بدون محتوا"}`, hasAdvice ? "" : "سرویس product-advice و اتصال دیتابیس را بررسی کنید");
  } catch (e) {
    add("سایت", "پروب زندهٔ سرویس AI (advice)", false, `خطا: ${e.name === "TimeoutError" ? "timeout" : e.message}`, "سرویس product-advice را بررسی کنید");
  }
}

// ---------- ④ سلامت محتوا (فایل‌های ریپو) ----------
let pinImages = new Set();
let pinList = [];
try {
  pinList = JSON.parse(readFileSync(join(ROOT, "src/data/inspirations.generated.json"), "utf8"));
  for (const p of pinList) pinImages.add(p.image);
  const agentPins = pinList.filter((p) => p.author?.type === "agent" && p.createdAt);
  const last = agentPins.length ? Math.max(...agentPins.map((p) => Date.parse(p.createdAt))) : 0;
  const hours = Math.floor((now - last) / 36e5);
  add("محتوا", "پین‌های الهام", hours <= 36, `آخرین پین ${hours} ساعت پیش — ${agentPins.length} پین ایجنت`, "ورک‌فلوی inspiration-daily را دستی اجرا و لاگش را ببینید");
} catch (e) {
  add("محتوا", "پین‌های الهام", false, "خطا: " + e.message, "فایل inspirations.generated.json را بررسی کنید");
}

let briefs = [];
try {
  const t = JSON.parse(readFileSync(join(ROOT, "src/content/trends/trends.json"), "utf8"));
  briefs = t.briefs || [];
  const last = briefs.length ? Date.parse(briefs[0].date + "T12:00:00Z") : 0;
  const hours = Math.floor((now - last) / 36e5);
  add("محتوا", "بریف‌های ترند", briefs.length >= 50 && hours <= 48, `${briefs.length} بریف — آخرین ${hours} ساعت پیش`, "ورک‌فلوی magazine-daily را دستی اجرا کنید و لاگ LLM را ببینید");
} catch (e) {
  add("محتوا", "بریف‌های ترند", false, "خطا: " + e.message, "فایل trends.json را بررسی کنید");
}

// کاورها: وجود فایل + یکتایی مسیر + یکتایی بایت (md5) + ممنوعیت استخر جنریک
{
  const seenPath = new Map();
  const seenMd5 = new Map();
  const missing = [], dupPath = [], dupMd5 = [], pool = [], hotlink = [];
  for (const b of briefs) {
    if (!b?.cover) { missing.push(b.slug + " (بدون کاور)"); continue; }
    if (!b.cover.startsWith("/images/")) hotlink.push(b.slug);
    if (seenPath.has(b.cover)) dupPath.push(`${b.slug}==${seenPath.get(b.cover)}`);
    else seenPath.set(b.cover, b.slug);
    const p = join(ROOT, "public", b.cover);
    if (!existsSync(p)) { missing.push(`${b.slug} → ${b.cover}`); continue; }
    const h = md5(p);
    if (seenMd5.has(h)) dupMd5.push(`${b.slug}==${seenMd5.get(h)}`);
    else seenMd5.set(h, b.slug);
    if (b.cover.includes("/product-pins/") || b.coverSource === "pool") pool.push(b.slug);
  }
  add("محتوا", "فایل کاورها", missing.length === 0, missing.length ? `${missing.length} کاور گمشده: ${missing.slice(0, 4).join("، ")}` : `${seenPath.size} کاور همه موجود`, "scripts/trend-cover-repair.mjs را اجرا کنید");
  add("محتوا", "یکتایی کاورها (تکراری‌نابودِ Task 43)", dupPath.length === 0 && dupMd5.length === 0, dupPath.length || dupMd5.length ? `تکراری: ${[...dupPath, ...dupMd5].slice(0, 4).join("، ")}` : "هیچ دو بریفی کاور مشترک ندارند (مسیر و بایت)", "scripts/trend-cover-repair.mjs را اجرا کنید");
  add("محتوا", "کاور هم‌موضوع (نه جنریک)", pool.length === 0, pool.length ? `${pool.length} بریف روی استخر جنریک: ${pool.slice(0, 5).join("، ")}` : "همهٔ کاورها اختصاصی/هم‌موضوع‌اند", "زنجیرهٔ کاور (og→وب→Openverse→تولید) در magazine-daily باید تعمیر شود؛ scripts/trend-cover-repair.mjs");
  if (hotlink.length) add("محتوا", "هات‌لین ممنوع", false, `${hotlink.length} بریف کاور خارجی دارد: ${hotlink.slice(0, 4).join("، ")}`, "کاور باید دانلود و داخل ریپو ذخیره شود");
}

// ارتباط بصری کاورها — QA ثبت‌شدهٔ مدل بینایی: کاور کم‌ارتباط = آلارم (Task 50).
// قاعدهٔ یکدست با trend-cover-repair: نامقبول = ≤۷، یا ۶–۷ همراه پرمتن (textHeavy تنها ۸–۹ را نمی‌کشد).
try {
  const qa = JSON.parse(readFileSync(join(ROOT, "scripts/trend-cover-qa-report.json"), "utf8"));
  const bad = [];
  let verified = 0, unverified = 0;
  for (const b of briefs) {
    if (!b?.cover || !b.cover.includes("/trends/src/")) continue; // کاور استخر جنریک جداگانه آلارم دارد
    const v = qa[b.slug];
    if (v && !v.error && v.cover === b.cover) {
      if (v.score <= 7 && (v.score < 6 || v.textHeavy)) bad.push(`${b.slug} (QA=${v.score}${v.textHeavy ? "+پرمتن" : ""})`);
      else verified++;
    } else {
      unverified++; // کاور تازه یا بازبینی‌نشده — اطلاعاتی، آلارم نه
    }
  }
  add("محتوا", "ارتباط بصری کاورها (QA بینایی)", bad.length === 0,
    bad.length ? `${bad.length} کاور کم‌ارتباط/پرمتن: ${bad.slice(0, 4).join("، ")}` : `${verified} کاور تأیید بصری دارد — همه هم‌موضوع`,
    "scripts/trend-cover-repair.mjs را اجرا کنید (تعویض خودکار با گیت QA)");
  add("محتوا", "پوشش QA کاورها", true,
    unverified.length ? `${unverified.length} کاور هنوز تأیید بصری ندارد (تازه): ${unverified.slice(0, 5).join("، ")}` : "همهٔ کاورها بازبینی بصری شده‌اند",
    unverified.length ? "scripts/trend-cover-repair.mjs --qa-only را در سندباکس اجرا کنید" : "");
} catch (e) {
  add("محتوا", "ارتباط بصری کاورها (QA بینایی)", false, "خطا: " + e.message, "trend-cover-qa-report.json را بررسی کنید");
}

// یکتایی عکس پین‌های الهام — هیچ عکسی نباید بین دو پین مشترک باشد (Task 50)
{
  const seenPin = new Map();
  const pinDups = [];
  for (const p of pinList || []) {
    if (!p?.image) continue;
    if (seenPin.has(p.image)) pinDups.push(`${p.id || "?"}==${seenPin.get(p.image)}`);
    else seenPin.set(p.image, p.id || "?");
  }
  add("محتوا", "یکتایی پین‌های الهام", pinDups.length === 0,
    pinDups.length ? `${pinDups.length} عکس مشترک: ${pinDups.slice(0, 4).join("، ")}` : `${seenPin.size} پین همه یکتا`,
    "ایجنت الهام (inspiration-daily) را بازبینی کنید — انتخاب عکس باید از استخر بدون تکرار باشد");
}

// کاور نباید بایت‌به‌بایت عکس یک پین محصول باشد (استخر جنریک نباید خود را قایم کند — Task 50)
{
  const pinMd5 = new Map();
  for (const img of pinImages) {
    if (!img?.startsWith("/images/")) continue;
    const p = join(ROOT, "public", img);
    if (!existsSync(p)) continue;
    pinMd5.set(md5(p), img);
  }
  const clash = [];
  for (const b of briefs) {
    if (!b?.cover?.startsWith("/images/")) continue;
    const p = join(ROOT, "public", b.cover);
    if (!existsSync(p)) continue;
    const owner = pinMd5.get(md5(p));
    if (owner && owner !== b.cover) clash.push(`${b.slug}==${owner}`);
  }
  add("محتوا", "کاور ≠ عکس پین محصول", clash.length === 0,
    clash.length ? `${clash.length} کاور روی فایل پین: ${clash.slice(0, 4).join("، ")}` : "هیچ کاوری عکس پین محصول را مصرف نکرده",
    "زنجیرهٔ کاور باید عکس یکتا و هم‌موضوع بسازد — scripts/trend-cover-repair.mjs");
}

// مقالهٔ مجله
try {
  const arts = JSON.parse(readFileSync(join(ROOT, "src/content/magazine/articles.json"), "utf8"));
  const last = arts.length ? Date.parse((arts[0].dateISO || arts[0].date) + "T12:00:00Z") : 0;
  const hours = Math.floor((now - last) / 36e5);
  add("محتوا", "مقالهٔ مجله", hours <= 72, `آخرین مقاله ${hours} ساعت پیش — ${arts.length} مقاله`, "نوبت اول روزانهٔ magazine-daily (شامل مقاله) را چک کنید");
} catch (e) {
  add("محتوا", "مقالهٔ مجله", false, "خطا: " + e.message, "articles.json را بررسی کنید");
}

// استخر عکس الهام
try {
  const poolDoc = JSON.parse(readFileSync(join(ROOT, "scripts/inspiration-pool.json"), "utf8"));
  let remaining = 0;
  for (const spaces of Object.values(poolDoc.pool || {})) {
    for (const items of Object.values(spaces)) remaining += items.filter((p) => !pinImages.has(p.url)).length;
  }
  add("محتوا", "استخر عکس الهام", remaining >= 40, `${remaining} عکس مصرف‌نشده — شارژ با scripts/expand-inspiration-pool.py`, "expand-inspiration-pool.py را در سندباکس اجرا کنید");
} catch (e) {
  add("محتوا", "استخر عکس الهام", false, "خطا: " + e.message, "");
}

// ---------- ⑤ آخرین اجرای ورک‌فلوها ----------
{
  const repo = process.env.GITHUB_REPOSITORY || "vahidaskari1365/homeino1";
  // ناظر خودش را چک نمی‌کند (پارادوکس اولین اجرا) — سلامتش را خروجی ورک‌فلو نشان می‌دهد
  const WORKFLOWS = [
    { id: "magazine-daily.yml", name: "ایجنت مجله/ترند", maxAgeH: 36 },
    { id: "inspiration-daily.yml", name: "ایجنت الهام", maxAgeH: 36 },
    { id: "agentshield-weekly.yml", name: "سپر هفتگی AI", maxAgeH: 24 * 9 },
  ];
  for (const wf of WORKFLOWS) {
    const r = ghSafe(["api", `repos/${repo}/actions/workflows/${wf.id}/runs?per_page=3`, "--jq", `[.workflow_runs[] | {conclusion, created_at, status}]`]);
    if (!r.ok) {
      if (r.missing) add("ایجنت‌ها", wf.name, true, `قابل بررسی نبود (gh در دسترس نیست) — در Actions بررسی می‌شود`);
      else add("ایجنت‌ها", wf.name, false, "خطای API: " + r.err, "دسترسی GITHUB_TOKEN به Actions را چک کنید");
      continue;
    }
    try {
      const runs = JSON.parse(r.out);
      const last = runs.find((x) => x.status === "completed");
      if (!last) { add("ایجنت‌ها", wf.name, false, "هیچ اجرای کاملی ثبت نشده", `Actions → ${wf.id}`); continue; }
      const ageH = Math.floor((now - Date.parse(last.created_at)) / 36e5);
      const ok = last.conclusion === "success" && ageH <= wf.maxAgeH;
      add("ایجنت‌ها", wf.name, ok, `آخرین اجرا ${ageH} ساعت پیش — نتیجه: ${last.conclusion}`, ok ? "" : `لاگ Actions → ${wf.id} را ببینید و دوباره اجرا کنید`);
    } catch (e) {
      add("ایجنت‌ها", wf.name, false, "خطای پارس: " + e.message, "");
    }
  }
}

// ---------- ⑥ تازگی دیپلوی ورسل (اختیاری) ----------
if (process.env.VERCEL_TOKEN) {
  try {
    const res = await fetchWithTimeout("https://api.vercel.com/v6/deployments?app=homeino&target=production&limit=1", 20_000, {
      headers: { Authorization: `Bearer ${process.env.VERCEL_TOKEN}` },
    });
    const j = await res.json();
    const d = j?.deployments?.[0];
    const ageH = d ? Math.floor((now - d.createdAt) / 36e5) : null;
    // دیپلوی تازه‌ی در حال بیلد هم یعنی خط لوله سالم است — فقط خطا/رکود آلارم است
    const state = d?.state || "?";
    const building = ["BUILDING", "INITIALIZING", "QUEUED"].includes(state);
    const ok = Boolean(d) && (state === "READY" || (building && ageH !== null && ageH <= 2)) && ageH !== null && ageH <= 72;
    add("زیرساخت", "دیپلوی پروداکشن", ok, d ? `آخرین دیپلوی ${ageH} ساعت پیش — ${state}` : "دیپلویی یافت نشد", "ورسل → deployments را چک کنید");
  } catch (e) {
    add("زیرساخت", "دیپلوی پروداکشن", false, "خطا: " + e.message, "اعتبار VERCEL_TOKEN را چک کنید");
  }
} else {
  add("زیرساخت", "دیپلوی پروداکشن", true, "VERCEL_TOKEN ست نیست — چک رد شد (اختیاری)");
}

// ---------- ⑦ انقضای توکن مانیتورینگ ----------
const patExp = process.env.PAT_EXPIRES_AT || "";
if (patExp) {
  const days = Math.floor((Date.parse(patExp + "T00:00:00Z") - now) / 864e5);
  add("زیرساخت", "انقضای توکن مانیتورینگ", days > 7, days > 0 ? `${days} روز مانده (تا ${patExp})` : `منقضی شده (${patExp})`, "PAT جدید بسازید و متغیر مخزن PAT_EXPIRES_AT را به‌روز کنید");
} else {
  add("زیرساخت", "انقضای توکن مانیتورینگ", true, "PAT_EXPIRES_AT تنظیم نشده — بی‌اثر");
}

// ---------- گزارش ----------
const failed = checks.filter((c) => !c.ok);
const alarm = failed.length > 0;
const icon = (ok) => (ok ? "✅" : "❌");
const stamp = new Date().toISOString().replace("T", " ").slice(0, 16) + " UTC";
const verdict = alarm
  ? `❌ ${failed.length} مشکل پیدا شد — ناظر هنوز تأیید نمی‌کند`
  : "✅ همه‌چیز سالم است — ناظر هومینو تأیید می‌کند";

const mdTable = [
  `# گزارش ناظر سایت هومینو`,
  ``,
  `آخرین بررسی: \`${stamp}\` — ${verdict}`,
  ``,
  `| گروه | چک | وضعیت | جزئیات |`,
  `|---|---|---|---|`,
  ...checks.map((c) => `| ${c.group} | ${c.name} | ${icon(c.ok)} | ${c.detail} |`),
  ``,
  ...(alarm
    ? [`**اقدام لازم:**`, ...failed.filter((f) => f.fix).map((f) => `- **${f.name}:** ${f.fix}`)]
    : []),
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, mdTable + "\n"); } catch {}
}

// لاگ اجرا برای صفحه /agents
await logContentAgentRun(ROOT, {
  agentKey: "site-watchdog",
  ok: !alarm,
  durationMs: Date.now() - RUN_STARTED,
  summary: alarm
    ? `${failed.length} مشکل: ${failed.map((f) => f.name).slice(0, 3).join("، ")}`
    : "تأیید کامل — سایت، APIها، محتوا و ایجنت‌ها همه سالم",
  detail: {
    checks: checks.map((c) => ({ group: c.group, name: c.name, ok: c.ok, detail: c.detail })),
    failed: failed.map((f) => ({ name: f.name, detail: f.detail, fix: f.fix })),
    verdict,
  },
});

// ایسوی خودکار — هرگز نبود gh نباید ناظر را بترکاند
const body = mdTable + `\n\n> این ایسو خودکار ساخته/به‌روز می‌شود. بعد از رفع، اجرای بعدی ناظر آن را می‌بندد.`;
let existing = null;
const listRes = ghSafe(["issue", "list", "--state", "open", "--json", "number,title", "--limit", "50"]);
if (listRes.ok) {
  try {
    const list = JSON.parse(listRes.out);
    existing = (list || []).find((i) => i.title === ISSUE_TITLE);
  } catch {}
}
if (alarm && listRes.ok && !existing) {
  ghSafe(["issue", "create", "--title", ISSUE_TITLE, "--body", body]);
  console.log("🚨 ایسوی آلارم ساخته شد");
} else if (alarm && listRes.ok && existing) {
  ghSafe(["issue", "edit", String(existing.number), "--body", body]);
  console.log(`🚨 ایسوی #${existing.number} به‌روز شد`);
} else if (!alarm && listRes.ok && existing) {
  ghSafe(["issue", "close", String(existing.number), "--comment", "✅ ناظر هومینو: همه‌چیز سالم شد — بسته شد."]);
  console.log(`✅ ایسوی #${existing.number} بسته شد`);
} else if (alarm) {
  console.log("🚨 آلارم فعال — ساخت ایسو ممکن نبود (gh در دسترس نیست)");
}

for (const c of checks) console.log(`${icon(c.ok)} [${c.group}] ${c.name}: ${c.detail}`);
console.log(alarm ? `\n${verdict}` : `\n${verdict}`);
process.exit(alarm ? 1 : 0);

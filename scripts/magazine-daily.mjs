#!/usr/bin/env node
/**
 * magazine-daily — سامانه روزانه «ترندهای روز هومینو»
 * ============================================================
 * هر روز اجرا می‌شود (GitHub Actions cron یا دستی: `npm run magazine:daily`) و:
 *   1. فیدهای RSS معتبرترین نشریات دیزاین دنیا را می‌خواند
 *   2. مطالب تازه را با امتیازدهی کلیدواژه انتخاب می‌کند
 *   3. متن هر مطلب را (best-effort) استخراج می‌کند
 *   4. با LLM یک «بریف ترند» فارسیِ کاملاً بازنویسی‌شده می‌سازد
 *      (هرگز ترجمه/کپی تحت‌اللفظی نیست — فقط واقعیت‌ها + روایت مستقل)
 *   5. خروجی را به src/content/trends/trends.json اضافه می‌کند (با نگه‌داری ۱۲۰ روز)
 *
 * LLM: زنجیره چندلایه (رایگان و بدون کلید تا کلید اختصاصی):
 *   1) env سازگار-OpenAI (LLM_BASE_URL + LLM_API_KEY [+ LLM_MODEL]) — مثلاً کلید GLM کاربر
 *   2) OMNIROUTE_BASE_URL — گیت‌وی خودمیزبان OmniRoute (مدل auto، فال‌بک چند ارائه‌دهنده)
 *   3) زنجیره رایگانِ بدون‌کلید OpenCode Zen (glm/kimi/qwen/deepseek-tier مدل‌های -free)
 * در سندباکس z-ai-web-dev-sdk هم امتحان می‌شود. اگر همه شکست خوردند: خروجی بدون تغییر، exit 0
 * و لاگ اجرا صادقانه علت را می‌نویسد.
 * کاور: اول og:image خودِ منبع؛ اگر نبود عکس واقعی وبِ هم‌موضوع (z-ai)؛ آخرِ کار استخر کاور با چرخشِ بدون‌تکرار.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";
import { callLlm } from "./lib/llm-chain.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_FILE = path.join(REPO, "src", "content", "trends", "trends.json");
// مقاله کامل روزانه مجله — مجله را زنده نگه می‌دارد (بریف فقط مال صفحه ترندهاست)
const MAG_FILE = path.join(REPO, "src", "content", "magazine", "articles.json");
const RETENTION_DAYS = 120;
const MAX_BRIEFS_PER_RUN = 4;
const DAYS_BACK = 3;

// فیدهای تأییدشده (تست‌شده در 2026-09-06) + fallbackهای Google News
const FEEDS = [
  "https://www.architecturaldigest.com/feed/rss",
  "https://www.livingetc.com/feeds.xml",
  "https://www.homesandgardens.com/feed/rss",
  "https://www.idealhome.co.uk/feeds.xml",
  "https://www.dwell.com/@dwell/rss",
  "https://www.design-milk.com/feed",
  "https://www.wallpaper.com/feeds.xml",
  "https://www.surfacemag.com/feed",
  "https://news.google.com/rss/search?q=interior+design+trends+when:2d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=home+decor+color+OR+kitchen+OR+furniture+when:2d&hl=en-US&gl=US&ceid=US:en",
];

const KEYWORDS = [
  ["trend", 3], ["color", 2], ["paint", 2], ["kitchen", 3], ["bathroom", 3],
  ["furniture", 3], ["interior", 3], ["decor", 3], ["living room", 2],
  ["bedroom", 2], ["rug", 1], ["lighting", 1], ["sofa", 2], ["wood", 1],
  ["materials", 2], ["renovation", 2], ["designer", 1], ["styling", 2],
  ["minimalis", 2], ["wellness", 1], ["sustainab", 2], ["small space", 2],
  // گسترش: ویلا، حیاط، محیط کار و وسایل ترند
  ["villa", 2], ["vacation home", 2], ["patio", 2], ["backyard", 2],
  ["outdoor living", 3], ["garden design", 2], ["balcony", 1], ["rooftop", 1],
  ["home office", 3], ["workspace", 2], ["desk", 1], ["studio apartment", 2],
  ["color of the year", 3], ["palett", 2], ["accent wall", 2],
  ["statement piece", 2], ["curved furniture", 2], ["vintage", 1], ["antique", 1],
  ["japandi", 2], ["quiet luxury", 2], [" maximal", 2], ["biophilic", 2],
];

const CATEGORIES_FA = ["رنگ", "مبلمان", "آشپزخانه", "حمام", "متریال", "سبک زندگی", "سبک‌ها", "هوشمند", "ویلا و باغ", "حیاط و بیرونی", "محیط کار", "وسایل ترند"];
const COVER_BY_CATEGORY = {
  "رنگ": "/images/trends/trends-color-year.png",
  "مبلمان": "/images/trends/trends-neo-deco.png",
  "آشپزخانه": "/images/trends/trends-kitchen-wood.png",
  "حمام": "/images/trends/trends-wetroom.png",
  "متریال": "/images/trends/trends-chrome-wood.png",
  "سبک زندگی": "/images/trends/trends-zoning.png",
  "سبک‌ها": "/images/trends/trends-guide-2026.png",
  "هوشمند": "/images/trends/trends-zoning.png",
  "تزئین": "/images/trends/trends-gem-maxxing.png",
  "نقش": "/images/trends/trends-patterns-story.png",
  "ویلا و باغ": "/images/trends/trends-colors-persian.png",
  "حیاط و بیرونی": "/images/trends/trends-zoning.png",
  "محیط کار": "/images/trends/trends-patterns-story.png",
  "وسایل ترند": "/images/trends/trends-chrome-wood.png",
};
const DEFAULT_COVER = "/images/trends/trends-guide-2026.png";

// ---------- عکسِ خودِ منبع (og:image) — عکس تکراری ممنوع ----------
const SRC_IMG_DIR = path.join(REPO, "public", "images", "trends", "src");

function decodeEntities(s) {
  return String(s || "")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/>/g, ">")
    .replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&#x2F;/gi, "/");
}

/** استخراج og:image (فال‌بک: twitter:image) از HTML صفحه منبع */
function extractOgImage(html, baseUrl) {
  if (!html) return null;
  const pats = [
    /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
  ];
  for (const p of pats) {
    const m = html.match(p);
    if (!m) continue;
    const raw = decodeEntities(m[1]).trim();
    if (!/^https?:/i.test(raw) && !raw.startsWith("//") && !raw.startsWith("/")) continue;
    try { return new URL(raw, baseUrl).href; } catch { return null; }
  }
  return null;
}

/** لینک‌های news.google.com ریدایرکت JS دارند — آدرس واقعی ناشر از داخل HTML درمی‌آید */
async function resolveRealSourceUrl(url) {
  if (!/news\.google\.com/i.test(url)) return url;
  const html = await fetchText(url, 9000);
  if (!html) return url;
  const m = html.match(/data-n-au=["']([^"']+)["']/i)
    || html.match(/href=["'](https?:\/\/[^"']+)["'][^>]*jslog/i)
    || html.match(/https?:\/\/(?!news\.google|www\.google|accounts\.google|policies\.google)[a-z0-9.-]+\.[a-z]{2,}[^"'<>\s]+/i);
  if (!m) return url;
  try {
    const u = new URL(decodeEntities(m[1]));
    if (/google\./i.test(u.hostname)) return url;
    return u.href;
  } catch { return url; }
}

/** ابعاد واقعی عکس از خود بایت‌ها — PNG/JPEG/WebP/GIF بدون وابستگی (در CI هم کار می‌کند) */
function probeImageDims(buf) {
  try {
    if (buf.length > 24 && buf.readUInt32BE(0) === 0x89504e47) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i + 9 < buf.length) {
        if (buf[i] !== 0xff) { i++; continue; }
        const m = buf[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
        if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
        i += 2 + buf.readUInt16BE(i + 2);
      }
      return null;
    }
    if (buf.length > 30 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
      const fmt = buf.toString("ascii", 12, 16);
      if (fmt === "VP8 ") return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff };
      if (fmt === "VP8L") { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1 }; }
      if (fmt === "VP8X") return { w: 1 + (buf[24] | (buf[25] << 8) | (buf[26] << 16)), h: 1 + (buf[27] | (buf[28] << 8) | (buf[29] << 16)) };
      return null;
    }
    if (buf.length > 10 && buf.toString("ascii", 0, 3) === "GIF") return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8) };
    return null;
  } catch { return null; }
}

/** دانلود عکس og به public — مسیر عمومی برمی‌گردد یا null */
async function downloadSourceImage(imgUrl, destBase) {
  try {
    const res = await fetch(imgUrl, {
      headers: { ...UA, Referer: new URL(imgUrl).origin, Accept: "image/*" },
      signal: AbortSignal.timeout(18000),
    });
    if (!res.ok) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    if (!type.startsWith("image/") || /svg|icon/.test(type)) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 6000) return null; // آیکون/اسپرایت‌ها را رد کن
    // گیت ابعاد: لوگو/آواتار/آیکون جای عکس مطلب را نمی‌گیرد (مثل لوگوی گوگل‌نیوز ۳۰۰×۳۰۰)
    const dims = probeImageDims(buf);
    if (dims) {
      if (dims.w < 500 || dims.h < 320) return null;
    } else if (buf.length < 25000) {
      return null; // فرمت ناشناخته و حجیم‌نشده = مشکوک به لوگو
    }
    const ext = type.includes("png") ? "png" : type.includes("webp") ? "webp" : type.includes("avif") ? "avif" : "jpg";
    const dest = `${destBase}.${ext}`;
    fs.writeFileSync(dest, buf);
    return `/images/trends/src/${path.basename(dest)}`;
  } catch { return null; }
}

/** کل زنجیره: URL منبع → og:image → فایل محلی */
async function coverFromSource(sourceUrl, slug) {
  const real = await resolveRealSourceUrl(sourceUrl);
  const html = real === sourceUrl ? null : await fetchText(real, 11000);
  const og = extractOgImage(html, real);
  if (!og) return { cover: null, realUrl: real };
  const cover = await downloadSourceImage(og, path.join(SRC_IMG_DIR, slug));
  return { cover, realUrl: real };
}

// ---------- فال‌بک دوم: عکس واقعی وبِ هم‌موضوع (ز-ای) — فقط جایی که CLI هست ----------
function hasZai() {
  try { return spawnSync("which", ["z-ai"], { encoding: "utf8" }).status === 0; } catch { return false; }
}
const HAS_ZAI = hasZai();

function zAiImageSearch(query) {
  if (!HAS_ZAI) return [];
  try {
    const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", "4", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
    const j = JSON.parse(raw.slice(raw.indexOf("{")));
    // پیش‌نمایش آژانس‌های استوک همیشه واترمارک دارد — اصلاً کاندید نشود
    const STOCK_DOMAINS = /(dreamstime|shutterstock|gettyimages|istockphoto|123rf|alamy|depositphotos|stock\.adobe|freepik|bigstockphoto|colourbox|agefotostock|photos\.com|stockcake|vecteezy)\.?/i;
    return (j.results || [])
      .filter((r) => !STOCK_DOMAINS.test(r.original_url || ""))
      .map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200, h: parseInt(r.original_height) || 800 }));
  } catch { return []; }
}

/** جستجوی وب برای موضوع مطلب و دانلود اولین عکس تازه — یا null */
async function topicCover(query, slug, usedUrls) {
  const hits = zAiImageSearch(query).filter((p) => p.w >= 600 && !usedUrls?.has(p.url));
  for (const hit of hits) {
    const cover = await downloadSourceImage(hit.url, path.join(SRC_IMG_DIR, slug));
    if (cover) {
      usedUrls?.add(hit.url);
      console.log(`  cover ✓ وب هم‌موضوع (منبع: ${hit.source})`);
      return cover;
    }
  }
  return null;
}

const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoMagazineBot/1.0; +https://homeino.ir)" };

async function fetchText(url, timeoutMs = 12000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers: UA, signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** پارس سبک RSS/Atom — بدون وابستگی خارجی */
function parseFeed(xml) {
  const items = [];
  const blocks = [...xml.matchAll(/<(item|entry)[\s\S]*?<\/\1>/g)].map((m) => m[0]);
  for (const b of blocks) {
    const pick = (tag) => {
      const m = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      if (!m) return "";
      let v = m[1];
      const cdata = v.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
      if (cdata) v = cdata[1];
      v = v.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'")
        .replace(/&quot;/g, '"').replace(/\s+/g, " ").trim();
      return v;
    };
    const title = pick("title");
    let link = "";
    const linkTag = b.match(/<link[^>]*href="([^"]+)"[^>]*\/?>/i);
    if (linkTag) link = linkTag[1];
    if (!link) link = pick("link");
    const pub = pick("pubDate") || pick("published") || pick("updated");
    const desc = (pick("description") || pick("content") || pick("summary")).slice(0, 600);
    if (title && link) items.push({ title, link, pub, desc });
  }
  return items;
}

function itemDate(item) {
  const t = item.pub ? Date.parse(item.pub) : NaN;
  return Number.isNaN(t) ? null : new Date(t);
}

function scoreItem(item) {
  const text = `${item.title} ${item.desc}`.toLowerCase();
  let s = 0;
  for (const [kw, w] of KEYWORDS) if (text.includes(kw)) s += w;
  return s;
}

function stripHtml(html) {
  return (html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">").replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function toJalaliFa(date) {
  try {
    const parts = new Intl.DateTimeFormat("fa-IR-u-ca-persian", {
      year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(date);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
    return `${get("year")}/${get("month")}/${get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function isoDay(d) {
  return d.toISOString().slice(0, 10);
}

function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = (fenced ? fenced[1] : text).trim();
  // ۱) کل متن مستقیم پارس شود
  try {
    return JSON.parse(raw);
  } catch {
    /* ادامه */
  }
  // ۲) اولین {...} کامل
  const objStart = raw.indexOf("{");
  const objEnd = raw.lastIndexOf("}");
  if (objStart !== -1 && objEnd > objStart) {
    try {
      return JSON.parse(raw.slice(objStart, objEnd + 1));
    } catch {
      /* ادامه */
    }
  }
  // ۳) اولین [...] کامل
  const arrStart = raw.indexOf("[");
  const arrEnd = raw.lastIndexOf("]");
  if (arrStart !== -1 && arrEnd > arrStart) {
    try {
      return JSON.parse(raw.slice(arrStart, arrEnd + 1));
    } catch {
      return null;
    }
  }
  return null;
}

const BRIEF_PROMPT = (item, sourceText, dateFa) => [
  {
    role: "system",
    content:
      "تو سردبیر ارشد مجله فارسی «هومینو» (homeino.ir) هستی؛ مرجع ترند دیزاین خانه برای مخاطب ایرانی. " +
      "وظیفه‌ات نوشتن بریف‌های ترندِ کاملاً اورجینال به فارسی روان است. قواعد غیرقابل‌عبور:\n" +
      "1) هرگز متن منبع را ترجمهٔ تحت‌اللفظی یا کپی نکن؛ فقط واقعیت‌ها و ایده‌ها را بردار و با روایت و واژگان خودت بنویس.\n" +
      "2) لحن مجله‌ای، گرم و دقیق؛ برای مخاطب فارسی‌زبان که می‌خواهد خانه‌اش را به‌روز کند.\n" +
      "3) مقادیر JSON را کامل و واقعی بنویس؛ هرگز «...» یا متن الگو به‌جای مقدار ننویس.\n" +
      "4) خروجی نهایی فقط داخل یک بلوک ```json ``` باشد و هیچ متن خارج از آن ننویس.",
  },
  {
    role: "user",
    content:
      `از مطلب زیر یک بریف ترند فارسی بساز.\n\nعنوان منبع: ${item.title}\nناشر: ${item.publisher}\n` +
      `خلاصه فید: ${item.desc}\n\nمتن استخراج‌شده (ممکن است ناقص باشد):\n"""\n${(sourceText || "").slice(0, 2600)}\n"""\n\n` +
      "الگوی خروجی — یک آبجکت JSON و فقط آن:\n" +
      '{"title": "...", "summary": "...", "takeaway": "...", "category": "...", "tags": ["...","..."]}\n' +
      "قواعد فیلدها:\n" +
      "- title: فارسی، حداکثر ~۶۰ کاراکتر، بدون علامت تعجب اغراق‌آمیز.\n" +
      "- summary: ۳ تا ۵ جملهٔ پیوسته (۱۱۰ تا ۱۷۰ واژه)؛ حقایق مشخص (رنگ‌ها، متریال، اعداد، نام برندها اگر هست) + چرایی اهمیتش الان.\n" +
      "- takeaway: ۱ تا ۲ جمله با شروع مفهومی «برای خانه ایرانی»؛ پیشنهاد کاربردی و کم‌هزینه.\n" +
      `- category: دقیقاً یکی از ${JSON.stringify(CATEGORIES_FA)}.\n` +
      "- tags: ۳ تا ۴ برچسب فارسی کوتاه.\n" +
      `تاریخ امروز (شمسی برای ارجاع ذهنی خودت): ${dateFa}`,
  },
];

function slugify(title, date) {
  const ascii = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
  const suffix = ascii && ascii.length > 6 ? ascii : Math.random().toString(36).slice(2, 8);
  return `${date}-${suffix}`;
}

async function main() {
  console.log(`[magazine-daily] ${new Date().toISOString()} — starting`);
  const RUN_STARTED = Date.now();
  const db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  const existing = db.briefs ?? [];
  const existingUrls = new Set(existing.map((b) => b.source?.url).filter(Boolean));
  const existingTitles = new Set(existing.map((b) => b.title.replace(/\s+/g, "")));
  const now = new Date();
  const cutoff = Date.now() - DAYS_BACK * 24 * 3600 * 1000;

  // ۰) سقف روزانه — اسلات‌های catch-up بعد از یک ران موفق فقط صادقانه خارج می‌شوند
  //    (dedupe با URL/عنوان هست، ولی این‌طوری نوبت جبرانی بدون تلاشِ بیهوده و بدون
  //    کامیتِ لاگِ خالی تمام می‌شود و حجم محتوای روز هم قابل‌پیش‌بینی می‌ماند)
  //    ⚠ اما «مقالهٔ امروز» حتی در catch-up باید تضمین شود — قبل از خروج چک می‌شود.
  const DAILY_BRIEF_TARGET = 4;
  const madeToday = existing.filter((b) => b.date === isoDay(now)).length;
  if (madeToday >= DAILY_BRIEF_TARGET) {
    console.log(`[magazine-daily] ${madeToday} brief(s) already published today — catch-up run checks article only`);
    await ensureTodayArticle(existing, toJalaliFa(now), isoDay(now));
    return;
  }

  // 1) جمع‌آوری کاندیدها از همه فیدها
  const candidates = [];
  for (const feed of FEEDS) {
    const xml = await fetchText(feed);
    if (!xml) {
      console.log(`  feed failed: ${feed}`);
      continue;
    }
    const items = parseFeed(xml);
    const host = new URL(feed).hostname.replace("www.", "").split("/")[0];
    for (const it of items) {
      const d = itemDate(it);
      const isRecent = d ? d.getTime() >= cutoff : true;
      if (!isRecent || existingUrls.has(it.link)) continue;
      candidates.push({ ...it, publisher: host, score: scoreItem(it), date: d ?? now });
    }
  }
  console.log(`  candidates: ${candidates.length}`);

  // 2) انتخاب برترها
  const seenTitles = new Set();
  const selected = candidates
    .sort((a, b) => b.score - a.score)
    .filter((c) => {
      const key = c.title.toLowerCase().replace(/\W+/g, "");
      if (seenTitles.has(key)) return false;
      seenTitles.add(key);
      return c.score >= 3;
    })
    .slice(0, MAX_BRIEFS_PER_RUN);

  if (selected.length === 0) {
    console.log("[magazine-daily] nothing new — trying article from today's briefs");
    await ensureTodayArticle(existing, toJalaliFa(now), isoDay(now));
    return;
  }

  const dateFa = toJalaliFa(now);
  const today = isoDay(now);

  // چرخش کاور fallback — دو بریفِ یک‌روزه کاور تکراری نگیرند
  const usedCovers = new Set();
  const usedWebImgs = new Set();
  const pickFallbackCover = (category) => {
    const values = [...new Set(Object.values(COVER_BY_CATEGORY))];
    const base = COVER_BY_CATEGORY[category] ?? DEFAULT_COVER;
    const candidates = [base, ...values.filter((v) => v !== base), DEFAULT_COVER].filter(Boolean);
    const pick = candidates.find((c) => !usedCovers.has(c))
      ?? candidates[(existing.length + usedCovers.size) % candidates.length];
    usedCovers.add(pick);
    return pick;
  };

  // 3) تولید بریف‌ها
  const created = [];
  let leadCtx = null; // زمینه مقاله روزانه — از بریف اول
  for (const item of selected) {
    // لینک‌های گوگل‌نیوز اول به آدرس واقعی ناشر حل می‌شوند — هم متن بهتر، هم og:image واقعی
    const realUrl = await resolveRealSourceUrl(item.link);
    const pageHtml = await fetchText(realUrl, 11000);
    const sourceText = stripHtml(pageHtml).slice(0, 3000);
    let parsed = null;
    try {
      const out = await callLlm(BRIEF_PROMPT(item, sourceText, dateFa));
      const arr = extractJson(out);
      if (Array.isArray(arr) && arr.length) parsed = arr[0];
      else if (arr && typeof arr === "object") parsed = arr;
    } catch (e) {
      console.log(`  LLM failed for "${item.title.slice(0, 50)}": ${e.message}`);
    }

    if (!parsed || !parsed.title || !parsed.summary) {
      console.log(`  skipped (no valid brief): ${item.title.slice(0, 60)}`);
      continue;
    }
    const summary = String(parsed.summary).trim();
    if (summary.length < 200) {
      console.log(`  skipped (too short): ${item.title.slice(0, 60)}`);
      continue;
    }
    const title = String(parsed.title).trim().slice(0, 110);
    const normTitle = title.replace(/\s+/g, "");
    if (existingTitles.has(normTitle)) continue;

    const category = CATEGORIES_FA.includes(parsed.category) ? parsed.category : "سبک زندگی";
    const slug = slugify(/[a-z]/i.test(parsed.title) ? parsed.title : title, today);
    // کاور: اول خودِ منبع (og:image)، بعد عکس وبِ هم‌موضوع، آخر استخر بدون تکرار
    const og = extractOgImage(pageHtml, realUrl);
    let cover = og ? await downloadSourceImage(og, path.join(SRC_IMG_DIR, slug)) : null;
    if (cover) console.log(`  cover ✓ از خود منبع (${og.slice(0, 90)}…)`);
    if (!cover) cover = (await topicCover(`${item.title} interior design`, slug, usedWebImgs)) ?? pickFallbackCover(category);
    created.push({
      slug,
      date: today,
      dateFa,
      title,
      summary,
      takeaway: String(parsed.takeaway || "").trim() || "با تغییرهای کوچک شروع کنید؛ اثرش بزرگ‌تر از هزینه‌اش است.",
      category,
      cover,
      source: { name: item.publisher, url: item.link },
      readTime: 2,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).slice(0, 24)).slice(0, 4) : [],
    });
    console.log(`  brief ✓ ${title.slice(0, 60)}`);
    if (!leadCtx) leadCtx = { brief: created[created.length - 1], item, realUrl, sourceText };
  }

  if (created.length === 0) {
    await ensureTodayArticle(existing, dateFa, today);
    const via = callLlm.lastVia ?? null;
    const summary = via
      ? "بریف جدیدی تولید نشد — مطلب تازه‌ای در فیدها نبود، همه تکراری بودند یا خروجی معتبر نبود"
      : "هیچ مسیر LLM در دسترس نبود (زنجیره رایگان شکست خورد) — در اجرای بعدی دوباره تلاش می‌شود";
    console.log(`[magazine-daily] no briefs produced — file unchanged (${via ? "no valid briefs" : "llm unreachable"})`);
    await logContentAgentRun(REPO, {
      agentKey: "magazine-editor",
      ok: false,
      durationMs: Date.now() - RUN_STARTED,
      summary,
      detail: { added: 0, total: existing.length, reason: via ? "no_valid_briefs" : "llm_unreachable", via },
    });
    return;
  }

  // 4) ادغام + نگه‌داری + نوشتن
  const merged = [...created, ...existing]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .filter((b) => Date.parse(`${b.date}T00:00:00Z`) >= Date.now() - RETENTION_DAYS * 24 * 3600 * 1000);

  fs.writeFileSync(DATA_FILE, `${JSON.stringify({ briefs: merged }, null, 2)}\n`, "utf8");
  console.log(`[magazine-daily] ✓ ${created.length} new brief(s) → total ${merged.length}`);

  // 5) مقاله کامل روزانه مجله — صفحه مجله هم مثل ترندها هر روز نفس تازه دارد
  //    بعد از بریف‌ها سهمیهٔ رایگان گرم است؛ دو دقیقه استراحت تا 429 نخوریم
  let articleNote = "";
  let articleAdded = 0;
  if (leadCtx) {
    try {
      await new Promise((s) => setTimeout(s, 120_000));
      const art = await generateDailyArticle(leadCtx, { dateFa, today });
      if (art) {
        articleAdded = 1;
        articleNote = ` + ۱ مقاله کامل مجله («${art.title.slice(0, 40)}…»)`;
      }
    } catch (e) {
      console.log(`[magazine-daily] article step failed: ${e.message}`);
    }
  }

  await logContentAgentRun(REPO, {
    agentKey: "magazine-editor",
    ok: true,
    durationMs: Date.now() - RUN_STARTED,
    summary: `${created.length} بریف ترند جدید (${created.map((b) => b.category).join("، ")})${articleNote}${callLlm.lastVia ? ` — از طریق ${callLlm.lastVia}` : ""}`,
    detail: {
      added: created.length,
      articlesAdded: articleAdded,
      total: merged.length,
      via: callLlm.lastVia ?? "unknown",
      titles: created.map((b) => b.title).slice(0, 4),
      sources: [...new Set(created.map((b) => b.source?.name).filter(Boolean))].slice(0, 4),
    },
  });
}

// ---------- مقاله کامل روزانه مجله ----------
const ARTICLE_PROMPT = (brief, sourceText, dateFa) => [
  {
    role: "system",
    content:
      "تو سردبیر ارشد مجله فارسی «هومینو» (homeino.ir) هستی؛ مرجع دیزاین و دکوراسیون خانه برای مخاطب ایرانی. " +
      "وظیفه‌ات نوشتن مقاله‌های کامل، اورجینال و خواندنی به فارسی روان است. قواعد غیرقابل‌عبور:\n" +
      "1) هرگز متن منبع را ترجمهٔ تحت‌اللفظی یا کپی نکن؛ فقط واقعیت‌ها و ایده‌ها را بردار و با روایت خودت بنویس.\n" +
      "2) لحن مجله‌ای گرم و دقیق؛ عمیق‌تر از یک بریف: چرایی ترند، پیش‌زمینه، کاربرد در خانه ایرانی، اشتباه‌های رایج.\n" +
      "3) مقادیر JSON را کامل و واقعی بنویس؛ هرگز «...» یا متن الگو به‌جای مقدار ننویس.\n" +
      "4) خروجی نهایی فقط داخل یک بلوک ```json ``` باشد و هیچ متن خارج از آن ننویس.",
  },
  {
    role: "user",
    content:
      `از این بریف ترند یک مقاله کامل مجله‌ای بساز.\n\nبریف:\nعنوان: ${brief.title}\nخلاصه: ${brief.summary}\nبرای خانه ایرانی: ${brief.takeaway}\nدسته: ${brief.category}\n\n` +
      `متن منبع (ممکن است ناقص باشد):\n"""\n${(sourceText || "").slice(0, 2400)}\n"""\n\n` +
      "الگوی خروجی — یک آبجکت JSON و فقط آن:\n" +
      '{"title": "...", "excerpt": "...", "category": "...", "paragraphs": ["...","..."]}\n' +
      "قواعد فیلدها:\n" +
      "- title: فارسی، تازه و متفاوت از عنوان بریف، حداکثر ~۷۰ کاراکتر.\n" +
      "- excerpt: ۱ تا ۲ جمله جذاب (۳۰ تا ۵۵ واژه) برای کارت مقاله.\n" +
      `- category: دقیقاً یکی از ${JSON.stringify(CATEGORIES_FA)}.\n` +
      "- paragraphs: ۴ تا ۶ پاراگراف؛ هر پاراگراف ۳ تا ۴ جملهٔ پیوسته (۵۰ تا ۸۰ واژه)؛ بدون شماره‌گذاری و بدون تیتر داخل متن؛ " +
      "سیر مقاله: ورود به ماجرا → چرایی اهمیت → کاربرد در خانه‌های ایرانی → جمع‌بندی.\n" +
      "- کل خروجی را در حد ۹۰۰ تا ۱۳۰۰ واژه نگه دار؛ از طول اضافه خودداری کن تا پاسخ ناقص نشود.\n" +
      `تاریخ امروز (شمسی، برای ارجاع ذهنی خودت): ${dateFa}`,
  },
];

/** نرمال‌سازی: paragraphs رشته‌ای → آرایه؛ حذف مقادیر تهی */
function repairArticleJson(obj) {
  if (!obj || typeof obj !== "object") return null;
  if (typeof obj.paragraphs === "string") {
    obj.paragraphs = obj.paragraphs.split(/\n{2,}|\n/).map((s) => s.trim()).filter(Boolean);
  }
  if (!Array.isArray(obj.paragraphs)) return null;
  obj.paragraphs = obj.paragraphs.map((p) => String(p).trim()).filter((p) => p.length > 40);
  if (!obj.title) return null;
  return obj;
}

/** تعمیر JSON نیمه‌بریده (قطع‌شدگی توکن): بستن آرایه/آبجکت تا جایی که ممکن باشد */
function extractJsonLenient(text) {
  if (!text) return null;
  let raw = text;
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) raw = fenced[1];
  const start = raw.indexOf("{");
  if (start === -1) return null;
  raw = raw.slice(start);
  const candidates = [raw];
  // برش تا آخرین »,« کامل + بستن‌های حدسی
  const lastQuoteComma = Math.max(raw.lastIndexOf('",'), raw.lastIndexOf('”,'));
  if (lastQuoteComma > 0) candidates.push(raw.slice(0, lastQuoteComma + 1));
  const lastNewlineQuote = raw.lastIndexOf('",\n');
  if (lastNewlineQuote > 0) candidates.push(raw.slice(0, lastNewlineQuote + 1));
  const closers = ['', '"]}', '"}]', '"}', '}'];
  for (const base of candidates) {
    for (const c of closers) {
      try {
        const j = JSON.parse(base + c);
        if (j && typeof j === "object") return j;
      } catch { /* بعدی */ }
    }
  }
  return null;
}

/** تضمین مقالهٔ امروز — از بریف موجود امروز، حتی در اجرای catch-up */
async function ensureTodayArticle(existing, dateFa, today) {
  let prev = [];
  try {
    prev = JSON.parse(fs.readFileSync(MAG_FILE, "utf8"));
    if (!Array.isArray(prev)) prev = [];
  } catch { prev = []; }
  if (prev.some((a) => a.dateISO === today)) {
    console.log("[magazine-daily] article already published today — nothing to do");
    return null;
  }
  const brief = existing.find((b) => b.date === today);
  if (!brief) {
    console.log("[magazine-daily] no brief for today — article impossible");
    return null;
  }
  const started = Date.now();
  await new Promise((s) => setTimeout(s, 20_000)); // سهمیه نفس بکشد
  try {
    const realUrl = await resolveRealSourceUrl(brief.source?.url ?? "");
    const html = await fetchText(realUrl, 11000);
    const art = await generateDailyArticle(
      { brief, item: null, realUrl, sourceText: stripHtml(html).slice(0, 3000) },
      { dateFa, today },
    );
    if (art) {
      await logContentAgentRun(REPO, {
        agentKey: "magazine-editor",
        ok: true,
        durationMs: Date.now() - started,
        summary: `۱ مقاله کامل مجله از بریف امروز («${art.title.slice(0, 40)}…»)`,
        detail: { added: 0, articlesAdded: 1, total: existing.length, via: callLlm.lastVia ?? "unknown" },
      });
    }
    return art;
  } catch (e) {
    console.log(`[magazine-daily] ensureTodayArticle failed: ${e.message}`);
    return null;
  }
}

/** ساخت ۱ مقاله کامل در روز از روی بریف تازهٔ صدر فهرست + نوشتن src/content/magazine/articles.json */
async function generateDailyArticle(leadCtx, { dateFa, today }) {
  let prev = [];
  try {
    prev = JSON.parse(fs.readFileSync(MAG_FILE, "utf8"));
    if (!Array.isArray(prev)) prev = [];
  } catch { prev = []; }

  // سقف روزانه — اجرای جبرانی دوباره مقاله نمی‌سازد
  if (prev.some((a) => a.dateISO === today || a.id === `mag-${today.replace(/-/g, "")}`)) {
    console.log("[magazine-daily] article already published today — skipped");
    return null;
  }

  const brief = leadCtx.brief;
  const out1 = await callLlm(ARTICLE_PROMPT(brief, leadCtx.sourceText, dateFa), { maxTokens: 3000 });
  let parsed = repairArticleJson(extractJson(out1) ?? extractJsonLenient(out1));
  if (!parsed) {
    // تلاش دوم — خواسته‌ی کوتاه‌تر با بودجه‌ی توکنِ اثبات‌شده
    console.log("[magazine-daily] article: first attempt invalid — retrying shorter");
    await new Promise((s) => setTimeout(s, 30_000)); // سهمیه نفس بکشد
    const retryMsg = [
      ...ARTICLE_PROMPT(brief, leadCtx.sourceText, dateFa).slice(0, -1),
      { role: "user", content: "پاسخ قبلی معتبر نبود. این‌بار فقط و فقط یک بلوک ```json ``` برگردان با «۴ پاراگرافِ ۳ جمله‌ای» و هیچ متن اضافه‌ای بیرون از JSON ننویس." },
    ];
    const out2 = await callLlm(retryMsg, { maxTokens: 2400 });
    parsed = repairArticleJson(extractJson(out2) ?? extractJsonLenient(out2));
  }
  if (!parsed || !parsed.title || !Array.isArray(parsed.paragraphs)) {
    console.log("[magazine-daily] article: invalid LLM output — skipped");
    return null;
  }

  const paragraphs = parsed.paragraphs.map((p) => String(p).trim()).filter(Boolean);
  const totalChars = paragraphs.join(" ").length;
  if (paragraphs.length < 3 || totalChars < 550) {
    console.log(`[magazine-daily] article: too short (${paragraphs.length} §, ${totalChars} chars) — skipped`);
    return null;
  }

  const title = String(parsed.title).trim().slice(0, 120);
  const existingSlugs = new Set(prev.map((a) => a.slug));
  let slug = slugify(/[a-z]/i.test(title) ? title : title.replace(/\s+/g, "-"), today);
  let n = 2;
  while (existingSlugs.has(slug)) slug = `${slug}-${n++}`;

  const readTime = Math.min(9, Math.max(4, Math.round(totalChars / 900)));

  const article = {
    id: `mag-${today.replace(/-/g, "")}`,
    slug,
    title,
    excerpt: String(parsed.excerpt || brief.summary).trim().slice(0, 260),
    cover: brief.cover,
    category: CATEGORIES_FA.includes(parsed.category) ? parsed.category : brief.category,
    author: "تحریریه هومینو",
    date: dateFa,
    dateISO: today,
    readTime,
    content: paragraphs.slice(0, 8),
    sources: [{ name: brief.source.name, url: brief.source.url }],
  };

  const mergedA = [article, ...prev]
    .filter((a, i, arr) => arr.findIndex((x) => x.slug === a.slug) === i)
    .filter((a) => !a.dateISO || Date.parse(`${a.dateISO}T00:00:00Z`) >= Date.now() - RETENTION_DAYS * 24 * 3600 * 1000)
    .slice(0, 90);

  fs.mkdirSync(path.dirname(MAG_FILE), { recursive: true });
  fs.writeFileSync(MAG_FILE, `${JSON.stringify(mergedA, null, 2)}\n`, "utf8");
  console.log(`[magazine-daily] ✓ article published → ${article.slug} (${mergedA.length} total)`);
  return article;
}

main().catch((e) => {
  console.error("[magazine-daily] FATAL", e);
  process.exit(1);
});

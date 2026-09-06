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
 * کاور: از استخر کاورهای موجود بر اساس دسته انتخاب می‌شود (بدون وابستگی خارجی).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logContentAgentRun } from "./lib/agent-runs-log.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const DATA_FILE = path.join(REPO, "src", "content", "trends", "trends.json");
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

const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoMagazineBot/1.0; +https://homeino.ir)" };

// ============================================================
// زنجیره رایگان بدون‌کلید (تست‌شده زنده 2026-09-06)
// منبع کشف: awesome-freellm-apis + کاتالوگ no-auth اومی‌روت (OpenCode Free)
// هر کاندیدا: endpoint سازگار-OpenAI + مدل + بودجه توکن (nemotron به فضای فکرکردن نیاز دارد)
// ============================================================
const FREE_CHAIN = [
  { id: "opencode:ling-3.0-flash-fin-free", base: "https://opencode.ai/zen/v1", model: "ling-3.0-flash-fin-free", maxTokens: 3000 },
  { id: "opencode:nemotron-3.5-lightning-free", base: "https://opencode.ai/zen/v1", model: "nemotron-3.5-lightning-free", maxTokens: 6000 },
  { id: "opencode:mimo-v2.5-free", base: "https://opencode.ai/zen/v1", model: "mimo-v2.5-free", maxTokens: 3000 },
  { id: "opencode:big-pickle", base: "https://opencode.ai/zen/v1", model: "big-pickle", maxTokens: 3000 },
  { id: "opencode:deepseek-v4-flash-free", base: "https://opencode.ai/zen/v1", model: "deepseek-v4-flash-free", maxTokens: 3000 },
];

async function chatCompletion(base, model, apiKey, messages, maxTokens, timeoutMs = 100_000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
    const res = await fetch(`${base.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: maxTokens }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      const retriable = res.status === 429 || res.status >= 500;
      const body = await res.text().catch(() => "");
      return { error: `HTTP ${res.status}: ${body.slice(0, 120)}`, retriable };
    }
    const json = await res.json();
    const content = json?.choices?.[0]?.message?.content ?? "";
    const finish = json?.choices?.[0]?.finish_reason;
    return { content, finish };
  } catch (e) {
    return { error: e?.name === "AbortError" ? "timeout" : e?.message ?? "fetch failed", retriable: true };
  } finally {
    clearTimeout(t);
  }
}

async function callLlm(messages) {
  const { LLM_API_KEY, LLM_BASE_URL, LLM_MODEL, OMNIROUTE_BASE_URL, OMNIROUTE_API_KEY } = process.env;
  const attempts = [];
  // 1) کلید اختصاصی کاربر (هر سرویس سازگار-OpenAI؛ اولویت با آن)
  if (LLM_API_KEY && LLM_BASE_URL) {
    attempts.push({ id: `env:${LLM_MODEL || "default"}`, base: LLM_BASE_URL, model: LLM_MODEL || "gpt-4o-mini", key: LLM_API_KEY, maxTokens: 1600 });
  }
  // 2) گیت‌وی خودمیزبان OmniRoute (فال‌بک داخلی چند ارائه‌دهنده، مدل auto)
  if (OMNIROUTE_BASE_URL) {
    attempts.push({ id: "omniroute:auto", base: OMNIROUTE_BASE_URL, model: "auto", key: OMNIROUTE_API_KEY || "", maxTokens: 3000 });
  }
  // 3) زنجیره رایگان بدون‌کلید
  attempts.push(...FREE_CHAIN.map((c) => ({ id: c.id, base: c.base, model: c.model, key: "", maxTokens: c.maxTokens })));

  for (const a of attempts) {
    for (let tryNo = 0; tryNo < 2; tryNo++) {
      const r = await chatCompletion(a.base, a.model, a.key, messages, a.maxTokens);
      if (r.content && r.content.trim()) {
        if (tryNo > 0 || a !== attempts[0]) console.log(`  llm via ${a.id}${tryNo ? " (retry)" : ""}`);
        callLlm.lastVia = a.id;
        return r.content;
      }
      if (r.error && !r.retriable) {
        console.log(`  llm ${a.id}: ${r.error}`);
        break; // مدل بعدی
      }
      if (tryNo === 0) await new Promise((s) => setTimeout(s, 8_000)); // فاصله برای 429/5xx
      else console.log(`  llm ${a.id}: ${r.error ?? "empty"}`);
    }
  }
  // سندباکس: z-ai-web-dev-sdk (در node_modules بالادست نصب است)
  try {
    const mod = await import("z-ai-web-dev-sdk");
    const ZAI = mod.default ?? mod;
    const zai = await ZAI.create();
    const res = await zai.chat.completions.create({ messages, temperature: 0.7 });
    const out = res?.choices?.[0]?.message?.content ?? "";
    if (out) {
      callLlm.lastVia = "zai-sdk";
      return out;
    }
  } catch { /* LLM در دسترس نیست */ }
  callLlm.lastVia = null;
  return null;
}

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
    console.log("[magazine-daily] nothing new — done");
    return;
  }

  const dateFa = toJalaliFa(now);
  const today = isoDay(now);

  // 3) تولید بریف‌ها
  const created = [];
  for (const item of selected) {
    const pageHtml = await fetchText(item.link, 9000);
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
    created.push({
      slug: slugify(/[a-z]/i.test(parsed.title) ? parsed.title : title, today),
      date: today,
      dateFa,
      title,
      summary,
      takeaway: String(parsed.takeaway || "").trim() || "با تغییرهای کوچک شروع کنید؛ اثرش بزرگ‌تر از هزینه‌اش است.",
      category,
      cover: COVER_BY_CATEGORY[category] ?? DEFAULT_COVER,
      source: { name: item.publisher, url: item.link },
      readTime: 2,
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t) => String(t).slice(0, 24)).slice(0, 4) : [],
    });
    console.log(`  brief ✓ ${title.slice(0, 60)}`);
  }

  if (created.length === 0) {
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
  await logContentAgentRun(REPO, {
    agentKey: "magazine-editor",
    ok: true,
    durationMs: Date.now() - RUN_STARTED,
    summary: `${created.length} بریف ترند جدید (${created.map((b) => b.category).join("، ")})${callLlm.lastVia ? ` — از طریق ${callLlm.lastVia}` : ""}`,
    detail: {
      added: created.length,
      total: merged.length,
      via: callLlm.lastVia ?? "unknown",
      titles: created.map((b) => b.title).slice(0, 4),
      sources: [...new Set(created.map((b) => b.source?.name).filter(Boolean))].slice(0, 4),
    },
  });
}

main().catch((e) => {
  console.error("[magazine-daily] FATAL", e);
  process.exit(1);
});

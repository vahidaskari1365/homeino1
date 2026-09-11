#!/usr/bin/env node
/**
 * seed-courtyard-pins — بک‌فیل یک‌باره پین‌های «حیاط و محوطه»
 * ============================================================
 * فضا «حیاط و محوطه» تازه به فیلترهای الهام اضافه شده؛ این اسکریپت یک‌بار
 * چند پین واقعی محوطه/حیاط (جستجوی زنده z-ai) با متن تحریریه می‌سازد تا
 * بخش از اولین روز خالی نباشد. اجرای بعدی‌ها با inspiration-daily.mjs است.
 * اجرا: node scripts/seed-courtyard-pins.mjs [--dry]
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(__dirname, "..");
const GEN_FILE = path.join(REPO, "src", "data", "inspirations.generated.json");
const DRY = process.argv.includes("--dry");
const UA = { "User-Agent": "Mozilla/5.0 (compatible; HomeinoInspirationBot/1.0; +https://homeino.ir)" };

// ترکیب سبک × کوئری محوطه — هر پین یک زاویه متفاوت از «حیاط و محوطه»
const PLAN = [
  {
    slug: "modern", q: "modern courtyard patio design concrete green",
    title: "حیاط مدرن؛ بتن، نور و خطوط سبز",
    description: "محوطه‌ای که با زبان مدرن چیده شده: کف بتنی بزرگ‌فرمت، خطوط تمیز و بسته‌های سبز هندسی. مبلمان بیرونی کم‌ارتفاع با فرم ساده، فضایی ساخته که هم برای مهمانی شبانه آماده است و هم یک قهوه‌ی صبحگاهی آرام. نورپردازی مخفی کف و دیوار، شب‌ها محوطه را به یک اتاق باز تبدیل می‌کند.",
    items: ["مبل حیاطی کم‌ارتفاع", "گلدان‌های هندسی درشت", "نور مخفی کف", "میز کمِ بتنی", "چمن مصنوعی یا باغچه نواری"],
    styleNote: "مدرن یعنی حذف اضافات و اعتنا به فرم؛ در محوطه هم همین است: متریال صادق (بتن، فلز مشکی) و سبزی حساب‌شده.",
  },
  {
    slug: "minimal", q: "minimalist garden terrace landscape design",
    title: "تراس مینیمال با روح سبز",
    description: "سادگیِ حساب‌شده در فضای باز: دو متریال، یک پالت، و سبزی به‌عنوان تنها تزئین. کف چوبی یکدست، نیمکت مخفی‌شده در باغچه و absence کامل شلوغی، تراس را بزرگ‌تر و آرام‌تر نشان می‌دهد. ایده‌ی اصلی برای خانه‌های شهری: کم آوردن، اما درست آوردن.",
    items: ["دک چوبی یکدست", "نیمکت توکار", "گلدان سرامیک مات", "نور مخفی پله", "شاخه‌های سبز بلند"],
    styleNote: "مینیمال در محوطه یعنی «یک ایده‌ی قوی»: همین‌جا هم کف، هم نشیمن و هم سبزی یک زبان مشترک دارند.",
  },
  {
    slug: "classic", q: "classic courtyard fountain landscape stone",
    title: "حیاط کلاسیک با آبنمای سنگی",
    description: "تقارن، سنگ و صدای آب؛ سه‌گانه‌ی حیاط کلاسیک. آبنمای سنگی در مرکز، مسیر سنگی متقارن و بوته‌های هرس‌شده، فضایی می‌سازد که وقار دارد و برای خانه‌های با حیاط میانی فوق‌العاده است. مبلمان فلزی سبک و گلدان‌های کلاسیک، بدون سنگینی، هویت را کامل می‌کنند.",
    items: ["آبنمای سنگی", "مسیر سنگی متقارن", "مبلمان فلزی سبک", "گلدان‌های پایه‌دار", "نور کف آبنما"],
    styleNote: "کلاسیک به تقارن و سنگ‌کاری اعتقاد دارد؛ در حیاط، همین دو عنصر فضایی باشکوه اما زندگی‌پذیر می‌سازند.",
  },
  {
    slug: "boho", q: "boho backyard patio textiles plants",
    title: "پاتیو بوهو؛ رنگ، بافت و گیاه",
    description: "لایه‌لایه‌ی بافت: فرش بیرونی نقش‌دار، کوسن‌های رنگی، مکرمه و شاخ‌وبرگ پرپشت. این پاتیو نشان می‌دهد محوطه هم می‌تواند شخصیت داشته باشد — همان‌قدر که پذیرایی‌تان دارد. صندلی‌های راطان و میز کم، گوشه‌ی نشیمنی ساخته‌اند که دعوت‌کننده‌ی ساعت‌ها نشستن است.",
    items: ["فرش بیرونی نقش‌دار", "صندلی راطان", "کوسن‌های رنگی", "آویزهای گیاهی", "میز کم چوبی"],
    styleNote: "بوهو در فضای باز جولان‌گاه اصلی‌اش را دارد: ترکیب آزاد الگو و رنگ، به شرطی که سبزی و بافت طبیعی ستون فقرات باشند.",
  },
  {
    slug: "mediterranean", q: "mediterranean courtyard white walls blue arches",
    title: "حیاط مدیترانه‌ای؛ سفید، آبی و نور",
    description: "دیوارهای سفید گچی، طاق‌های آبی و کاشی‌های فیروزه‌ای — زبانی که با معماری جنوب ایران هم‌خانواده است. کف سنگی روشن، سایه‌بان چوبی و گلدان‌های سرامیکی، حیاطی ساخته‌اند که خنک و روشن به نظر می‌رسد حتی در گرم‌ترین روز. ایده‌ای قدیمی برای خنک‌ماندن، بازخوانی‌شده با چشم امروزی.",
    items: ["دیوار گچی سفید", "طاق آبی", "کاشی فیروزه‌ای", "سایه‌بان چوبی", "گلدان‌های سرامیکی"],
    styleNote: "مدیترانه‌ای روی «سایه و سفیدی» بنا شده است؛ ترکیبی که در اقلیم گرم ایران عملاً هم جواب می‌دهد.",
  },
  {
    slug: "contemporary", q: "contemporary outdoor landscape lighting design",
    title: "محوطه معاصر با نورپردازی لایه‌ای",
    description: "در محوطه‌های معاصر، نور خودش متریال است: ردیف چراغ‌های کوتاه مسیر، نور بالاسوی درختان و هاله‌ی گرم کنار نشیمن، صحنه را شب می‌سازند. چیدمان روز یک چمن حساب‌شده و مسیر سنگی ساده است؛ اما شب‌ها است که این محوطه واقعاً می‌درخشد.",
    items: ["چراغ مسیر کوتاه", "نور بالاسری درخت", "مسیر سنگی", "چمن حساب‌شده", "نشیمن دیواری توکار"],
    styleNote: "معاصر یعنی گفت‌وگوی امروز با متریال و فناوری؛ اینجا نور، نقش دیوار و رنگ را در فضای داخلی بازی می‌کند.",
  },
];

function zAiImageSearch(query) {
  const raw = execFileSync("z-ai", ["image-search", "-q", query, "--count", "6", "--gl", "us", "--no-rank"], { timeout: 150000, encoding: "utf8" });
  const j = JSON.parse(raw.slice(raw.indexOf("{")));
  return (j.results || []).map((r) => ({ url: r.original_url, source: r.source || "وب", w: parseInt(r.original_width) || 1200, h: parseInt(r.original_height) || 800 }));
}

async function main() {
  const gen = JSON.parse(fs.readFileSync(GEN_FILE, "utf8"));
  const seenImgs = new Set(gen.map((p) => p.image));
  const today = new Date().toISOString().slice(0, 10);
  const added = [];

  for (const [i, plan] of PLAN.entries()) {
    process.stdout.write(`→ ${plan.slug} (${plan.q}) ... `);
    let picked = null;
    try {
      const hits = zAiImageSearch(plan.q).filter((p) => p.w >= 700 && !seenImgs.has(p.url));
      for (const hit of hits) {
        try {
          const res = await fetch(hit.url, { headers: { ...UA, Accept: "image/*" }, signal: AbortSignal.timeout(15000) });
          if (!res.ok) continue;
          const type = (res.headers.get("content-type") || "").toLowerCase();
          if (!type.startsWith("image/") || /svg|icon/.test(type)) continue;
          const buf = Buffer.from(await res.arrayBuffer());
          if (buf.length < 8000) continue;
          picked = { hit, bytes: buf.length };
          break;
        } catch { continue; }
      }
    } catch (e) {
      console.log(`✗ search: ${e.message}`);
      continue;
    }
    if (!picked) { console.log("✗ عکس تازه پیدا نشد"); continue; }
    seenImgs.add(picked.hit.url);
    added.push({
      id: `ag-${today.replace(/-/g, "")}-cy${String(i).padStart(2, "0")}`,
      title: plan.title,
      image: picked.hit.url,
      styleSlug: plan.slug,
      room: "حیاط و محوطه",
      tags: ["حیاط", "محوطه", "فضای بیرونی", "لنداسکیپ"],
      productIds: [],
      description: plan.description,
      items: plan.items,
      styleNote: plan.styleNote,
      source: { label: picked.hit.source },
      author: { name: "ایجنت هومینو", type: "agent" },
      createdAt: new Date().toISOString(),
      _via: "llm",
    });
    console.log(`✓ ${picked.hit.source} (${Math.round(picked.bytes / 1024)}KB)`);
    await new Promise((r) => setTimeout(r, 500));
  }

  if (DRY) { console.log(`\n[dry] ${added.length} پین — فایل نوشته نشد`); return; }
  if (added.length) {
    fs.writeFileSync(GEN_FILE, `${JSON.stringify([...added, ...gen], null, 2)}\n`, "utf8");
  }
  console.log(`\n${added.length} پین حیاط و محوطه اضافه شد → مجموع ${gen.length + added.length}`);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });

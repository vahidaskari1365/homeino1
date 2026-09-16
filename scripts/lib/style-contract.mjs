// ============================================================
// style-contract — قرارداد نگارش انسانی هومینو (تک‌منبع)
// ============================================================
// ادغام و بومی‌سازی فارسیِ دو اسکیل MIT:
//   • no-ai-slop   github.com/petergyang/no-ai-slop   — ۲۰+ الگوی نوشتار ماشینی (AI slop)
//   • i-have-adhd  github.com/ayghri/i-have-adhd      — مستقیم، مرحله‌ای، بدون سرویس‌کاری
//
// مصرف‌کنندگان:
//   • scripts/magazine-daily.mjs    — بریف‌های ترند + مقالهٔ روزانه (تزریق + گیت + بازنویسی)
//   • scripts/inspiration-daily.mjs — پین‌های الهام (تزریق + گیت)
//   • src/lib/ai/styleContract.test.ts — تست رفتار + گارد سیم‌کشی
//
// قرارداد کارکرد:
//   ۱) متنِ قواعد (WRITING_CONTRACT) به پرامپت سیستم ایجنت‌های محتوا تزریق می‌شود.
//   ۲) خروجی تولیدشده با slopVerdict سنجیده می‌شود.
//   ۳) «سخت» (HARD) = الگوی ماشینی قطعی → یک بار بازنویسی با تذکر؛ اگر ماند،
//      محتوا منتشر نمی‌شود (هومینو محتوای قالبیِ ماشینی منتشر نمی‌کند).
//   ۴) «نرم» (SOFT) = نشانهٔ هشدار برای لاگ؛ به‌تنهایی دلیل رد نیست.
// ============================================================

/** قواعد نگارش — به انتهای پرامپت سیستم ایجنت‌های محتوایی تزریق می‌شود. */
export const WRITING_CONTRACT = [
  "— قرارداد نگارش هومینو (الزامی و غیرقابل‌عبور) —",
  "۱. مستقیم شروع کن: جملهٔ اول خودِ نکته است؛ مقدمه‌چینی قالبی ممنوع («در دنیای امروز…»، «با پیشرفت تکنولوژی…»، «وقتی صحبت از دکوراسیون می‌شود…»).",
  "۲. مشخص بنویس، نه انتزاعی: رنگ، متریال، ابعاد، عدد و نام به‌جای صفات توخالی؛ ادعا را نشان بده، نه اینکه اهمیتش را اعلام کنی.",
  "۳. ادعای بی‌منبع ممنوع: «کارشناسان می‌گویند»، «مطالعات نشان می‌دهد» فقط با نام منبع؛ وگرنه حذف کن.",
  "۴. لحن انسانی و متنوع: جمله‌های هم‌طول و هم‌ساخت پشت‌سرهم ممنوع؛ فعل معلوم به‌جای مجهول بی‌دلیل.",
  "۵. اغراق و تملق ممنوع: «بی‌نظیر»، «باورنکردنی»، تعارف اضافه، ایموجی در تیتر، علامت تعجب پیاپی.",
  "۶. جمع‌بندی تکراری ممنوع: با آخرین نکتهٔ عملی تمام کن؛ «در نهایت باید گفت…» و «سخن پایانی» نداریم.",
  "۷. واژهٔ درست را مترادف‌گردی نکن؛ اگر یک نام درست است، همان بماند.",
].join("\n");

// ---------- سنجش ماشینی ----------

/** نرمال‌سازی مقایسه: حذف فاصله/نیم‌فاصله/کشیده + یکدست‌سازی ی/ک عربی — فارسی LLMها ناپایدار تایپ می‌کنند
 * (بی‌شک / بی شک / بدون‌شک همه یکسان سنجیده می‌شوند). ایندکسِ برگشتی تقریبی است و فقط برای گزارش است. */
function normalizeFa(text) {
  return String(text ?? "")
    .replace(/[\s\u200c\u200f\u200e\u0640]/g, "")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک");
}

/** HARD فارسی — وجودشان یعنی الگوی ماشینی قطعی (مترادف بومی‌شدهٔ الگوهای no-ai-slop). */
export const SLOP_HARD_FA = [
  // مقدمه‌چینی «در دنیای...» / «با پیشرفت...»
  "در دنیای امروز",
  "در دنیای امروزی",
  "در عصر حاضر",
  "در عصر دیجیتال",
  "در عصر فناوری",
  "با پیشرفت تکنولوژی",
  "با پیشرفت فناوری",
  "با پیشرفت روزافزون",
  // «وقتی صحبت از...» = when it comes to
  "وقتی صحبت از",
  "وقتی نوبت به",
  // «در دنیای دکوراسیون» = in the world of
  "در دنیای دکوراسیون",
  "در دنیای طراحی",
  "در جهان طراحی",
  // تذکرهای اداری
  "شایان ذکر است",
  "لازم به ذکر است",
  "گفتنی است",
  "قابل ذکر است",
  "همانطور که میدانید",
  // اعتمادسازی توخالی
  "بدون شک",
  "بی شک",
  // جمع‌بندی/اختتامیهٔ قالبی
  "در نهایت باید گفت",
  "در پایان باید گفت",
  "در پایان ذکر این نکته",
  "سخن پایانی",
  "سخن آخر",
  "کلام آخر",
  "جمعبندی اینکه",
  // اختتامیهٔ وبلاگی
  "امیدواریم این مطلب",
  "امیدوارم این مطلب",
  "امیدوارم مفید بوده",
  "امیدواریم مفید بوده",
  "از این مطلب لذت",
  // استناد عروسکی
  "کارشناسان میگویند",
  "متخصصان میگویند",
  "مطالعات نشان میدهد",
  "محققان ثابت کرده",
  // کنجکاوی‌سازی مصنوعی
  "جالب است بدانید",
  "نکته جالب اینکه",
];

/** HARD انگلیسی — از فهرست ممنوعهٔ no-ai-slop (lowercase؛ case-insensitive سنجیده می‌شود). */
export const SLOP_HARD_EN = [
  "it's important to note",
  "it is important to note",
  "it's worth noting",
  "in today's fast-paced world",
  "in today's world",
  "in the world of",
  "in the ever-evolving",
  "delve into",
  "a testament to",
  "stands as a testament",
  "marks a pivotal moment",
  "plays a vital role",
  "underscores its significance",
  "experts agree",
  "studies show",
  "in conclusion",
  "hope this helps",
  "game changer",
  "game-changer",
  "paradigm shift",
  "cutting-edge",
  "what nobody tells you",
  "here's the thing",
  "let's dive in",
  "the future isn't coming",
  "at the end of the day",
];

/** SOFT فارسی — اغراق/قالب‌گرمی سبک؛ فقط هشدار، نه رد. */
export const SLOP_SOFT_FA = [
  "بینظیر",
  "باورنکردنی",
  "شگفتانگیز",
  "فوقالعاده",
  "چشم نواز",
  "دلنشین",
  "در یک نگاه",
  "نکته کلیدی",
  "در نهایت",
  "شیک و مدرن",
];

/** SOFT انگلیسی — فعل‌ها/قیدهای پرطمطراق no-ai-slop (lowercase). */
export const SLOP_SOFT_EN = [
  "additionally",
  "furthermore",
  "moreover",
  "ultimately",
  "robust",
  "seamless",
  "elevate",
  "foster",
  "leverage",
  "utilize",
  "harness",
  "streamline",
  "empower",
  "underscores",
  "highlighting",
  "showcasing",
  "pivotal",
  "realm",
  "tapestry",
];

/** ادغام‌شده‌ها — برای تست‌ها و گزارش. */
export const SLOP_HARD = [...SLOP_HARD_FA, ...SLOP_HARD_EN];
export const SLOP_SOFT = [...SLOP_SOFT_FA, ...SLOP_SOFT_EN];

/** @typedef {{phrase: string, lang: "fa"|"en", tier: "hard"|"soft", index: number}} SlopHit */

/**
 * سنجش متن از منظر الگوهای ماشینی.
 * @param {string} text
 * @returns {{clean: boolean, hard: SlopHit[], soft: SlopHit[]}}
 */
export function slopVerdict(text) {
  const source = String(text ?? "");
  const lower = source.toLowerCase();
  const faNorm = normalizeFa(source);
  const scan = (phrases, lang, tier) => {
    const hits = [];
    for (const phrase of phrases) {
      // فارسی روی متن نرمال‌شده (نیم‌فاصله‌ناپذیر)؛ انگلیسی روی lowercase
      const haystack = lang === "fa" ? faNorm : lower;
      const needle = lang === "fa" ? normalizeFa(phrase) : phrase;
      const index = haystack.indexOf(needle);
      if (index !== -1) hits.push({ phrase, lang, tier, index });
    }
    return hits;
  };
  const hard = [...scan(SLOP_HARD_FA, "fa", "hard"), ...scan(SLOP_HARD_EN, "en", "hard")];
  const soft = [...scan(SLOP_SOFT_FA, "fa", "soft"), ...scan(SLOP_SOFT_EN, "en", "soft")];
  return { clean: hard.length === 0, hard, soft };
}

/**
 * تذکر ویرایشی برای بازنویسی — به ادامهٔ پرامپت کاربر چسبانده می‌شود.
 * @param {SlopHit[]} hits
 * @returns {string}
 */
export function buildSlopRetryHint(hits) {
  const phrases = (hits ?? []).filter((h) => h && h.phrase).map((h) => `«${h.phrase}»`);
  if (!phrases.length) return "";
  return `این الگوهای ماشینی در متن قبلی بود: ${phrases.join("، ")}. آن‌ها را حذف کن و با جمله‌بندی انسانی و متنوع بازنویسی کن؛`;
}

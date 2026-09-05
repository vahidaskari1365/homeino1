// ============================================================
// HOMEINO — PERSIAN SHOPPING/DESIGN VOCABULARY (NLU)
//
// A deterministic extractor for the interior-design domain. It is used:
//   • by the Shopping Assistant agent (and to validate LLM output)
//   • by the preference engine (to read search queries)
//   • by the AI Designer bridge (SKU / category / style detection)
//
// Every value it returns is a real catalog vocabulary key (category slug,
// style slug, color name, room key) — never a free-form invention.
// ============================================================

export const STYLE_KEYWORDS: Record<string, string[]> = {
  modern: ["مدرن", "modern", "نوگرا"],
  minimal: ["مینیمال", "minimal", "ساده", "خلوت"],
  scandinavian: ["اسکاندیناوی", "scandinavian", "نوردیک"],
  japandi: ["ژاپندی", "japandi", "ژاپن"],
  classic: ["کلاسیک", "classic", "سلطنتی"],
  neoclassical: ["نئوکلاسیک", "neoclassical", "نئو کلاسیک"],
  industrial: ["صنعتی", "industrial", "لوфт"],
  boho: ["بوهو", "boho", "بوهیمین"],
  rustic: ["روستیک", "rustic", "روستایی", "چوبی طبیعی"],
  mediterranean: ["مدیترانه", "mediterranean", "ساحلی"],
  contemporary: ["معاصر", "contemporary", "امروزی"],
  "art-deco": ["آرت دکو", "art deco", "art-deco", "دکو"],
};

/** Color names match the catalog vocabulary (see data/products COLORS). */
export const COLOR_KEYWORDS: Record<string, string[]> = {
  کرم: ["کرم", "cream", "شیری", "استخوانی"],
  سفید: ["سفید", "white"],
  ذغالی: ["ذغالی", "charcoal", "زغالی", "طوسی تیره", "خاکستری تیره"],
  طوسی: ["طوسی", "خاکستری", "grey", "gray"],
  تراکوتا: ["تراکوتا", "terracotta", "آجری"],
  "سبز مریم‌گلی": ["سبز مریم گلی", "سبز مریم‌گلی", "sage", "سبز ملایم"],
  سبز: ["سبز", "green", "یشمی"],
  شنی: ["شنی", "sand", "بژ", "beige", "خاکی"],
  سرمه‌ای: ["سرمه ای", "سرمه‌ای", "navy", "آبی تیره"],
  آبی: ["آبی", "blue"],
  طلایی: ["طلایی", "gold", "برنجی", "طلائی"],
  آلبالویی: ["آلبالویی", "plum", "شرابی", "زرشکی", "دودی"],
  قهوه‌ای: ["قهوه ای", "قهوه‌ای", "brown", "شکلاتی", "گردویی"],
  صورتی: ["صورتی", "pink", "چرک صورتی"],
  مشکی: ["مشکی", "black", "سیاه"],
  نارنجی: ["نارنجی", "orange"],
  زرد: ["زرد", "yellow", "خردلی"],
  بنفش: ["بنفش", "purple", "یاسی"],
};

export const ROOM_KEYWORDS: Record<string, string[]> = {
  living: ["پذیرایی", "نشیمن", "حال", "living", "اتاق نشیمن", "مهمان"],
  bedroom: ["اتاق خواب", "خواب", "bedroom"],
  kitchen: ["آشپزخانه", "kitchen", "ناهارخوری"],
  office: ["اداری", "دفتر", "میز تحریر", "کار", "office", "workspace"],
  bathroom: ["حمام", "سرویس بهداشتی", "دستشویی", "bathroom"],
  outdoor: ["تراس", "حیاط", "باغ", "بالکن", "outdoor"],
  kids: ["اتاق کودک", "کودک", "بچه", "نوجوان", "kids"],
};

/** category slug → keywords; subcategory slug → keywords */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  furniture: ["مبلمان", "مبل", "furniture"],
  decor: ["دکوراسیون", "دکوری", "اکسسوری", "decor"],
  lighting: ["نورپردازی", "چراغ", "لوستر", "آباژور", "lighting", "لامپ"],
  rugs: ["فرش", "قالیچه", "قالی", "rug", "carpet", "گلیم"],
  textiles: ["پرده", "کوسن", "پتو", "رومیزی", "textile", "parde"],
  kitchen: ["آشپزخانه", "ظروف", "kitchen"],
  bedroom: ["اتاق خواب", "تخت", "bedroom"],
  workspace: ["میز تحریر", "اداری", "workspace", "دفتر"],
  outdoor: ["فضای باز", "تراس", "outdoor"],
};

export const SUBCATEGORY_KEYWORDS: Record<string, string[]> = {
  // «مبل راحتی» is a lounge/recliner chair in the catalog (SOF-1025) — it
  // belongs to armchair, not to the sofa (کاناپه) family.
  sofa: ["کاناپه", "مبل ال", "مبل", "sofa", "couch"],
  armchair: ["مبل راحتی", "مبل تکی", "صندلی راحتی", "armchair", "برجیر", "راحتی"],
  chair: ["صندلی", "chair"],
  "coffee-table": ["میز جلو مبلی", "جلومبلی", "coffee table", "عسلی"],
  "dining-table": ["میز ناهارخوری", "ناهارخوری", "dining"],
  "dining-chair": ["صندلی ناهارخوری", "dining chair"],
  "wall-art": ["تابلو", "wall art", "تابلو دیواری"],
  mirror: ["آینه", "mirror"],
  vase: ["گلدان", "vase", "واز"],
  accessories: ["اکسسوری", "accessories"],
  sculpture: ["مجسمه", "sculpture"],
  candle: ["شمع", "candle"],
  ceiling: ["چراغ سقفی", "لوستر", "ceiling"],
  "floor-lamp": ["آباژور", "floor lamp", "چراغ پایه‌دار"],
  "wall-lamp": ["چراغ دیواری", "wall lamp", "دیوارکوب"],
  "table-lamp": ["چراغ رومیزی", "table lamp"],
  decorative: ["نور دکوراتیو", "ریسه", "decorative"],
  carpet: ["فرش", "carpet"],
  rug: ["قالیچه", "rug"],
  flooring: ["کفپوش", "flooring"],
  curtain: ["پرده", "curtain"],
  cushion: ["کوسن", "cushion"],
  throw: ["پتو", "throw", "شال مبل"],
  "table-runner": ["رومیزی", "runner"],
  dinnerware: ["ظروف", "بشقاب"],
  cookware: ["لوازم آشپزخانه", "cookware", "قابلمه"],
  organizer: ["نظم‌دهنده", "organizer", "جاکفشی"],
  bed: ["تخت", "تختخواب", "bed"],
  wardrobe: ["کمد", "wardrobe"],
  desk: ["میز تحریر", "میز کار", "desk"],
};

export const MATERIAL_KEYWORDS: Record<string, string[]> = {
  چوب: ["چوب", "wood", "راش", "بلوط", "گردو", "ونگه"],
  فلز: ["فلز", "metal", "استیل", "آهن", "برنج"],
  پارچه: ["پارچه", "fabric", "کتان", "مخمل", "کتانی", "linen", "velvet"],
  چرم: ["چرم", "leather"],
  سنگ: ["سنگ", "stone", "مرمر", "گرانیت"],
  شیشه: ["شیشه", "glass"],
  سرامیک: ["سرامیک", "ceramic"],
  حصیر: ["حصیر", "rattan", "بامبو"],
  پلاستیک: ["پلاستیک", "polymer", "پلیمر"],
};

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

export function toLatinDigits(input: string): string {
  return (input ?? "").replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d))).replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)));
}

function normalize(input: string): string {
  return toLatinDigits(input ?? "")
    .toLowerCase()
    .replace(/[\u200c]/g, " ")
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/\s+/g, " ")
    .trim();
}

function matchKeys(text: string, vocabulary: Record<string, string[]>): string[] {
  const hits: string[] = [];
  for (const [key, keywords] of Object.entries(vocabulary)) {
    if (keywords.some((k) => text.includes(normalize(k)))) hits.push(key);
  }
  return hits;
}

export function matchColorNames(text: string): string[] {
  const hits = matchKeys(text, COLOR_KEYWORDS);
  // "سبز مریم‌گلی" also matches "سبز" — keep the more specific one only.
  return hits.filter((h) => !hits.some((other) => other !== h && h.length < other.length && other.includes(h.slice(0, 2))));
}

export function matchStyles(text: string): string[] {
  return matchKeys(text, STYLE_KEYWORDS);
}

export function matchRooms(text: string): string[] {
  return matchKeys(text, ROOM_KEYWORDS);
}

export function matchMaterials(text: string): string[] {
  return matchKeys(text, MATERIAL_KEYWORDS);
}

/**
 * Best single hit per vocabulary: the key whose matched keyword is the
 * LONGEST (ties go to the first key in declaration order). This makes
 * «میز جلو مبلی» win over «مبل», «مبل راحتی» win over «مبل», etc.
 */
function bestMatch(text: string, vocabulary: Record<string, string[]>): string | undefined {
  let bestKey: string | undefined;
  let bestLen = -1;
  for (const [key, keywords] of Object.entries(vocabulary)) {
    const hit = keywords.find((k) => text.includes(normalize(k)));
    if (hit) {
      const len = normalize(hit).length;
      if (len > bestLen) {
        bestKey = key;
        bestLen = len;
      }
    }
  }
  return bestKey;
}

export function matchCategories(text: string): { categorySlug?: string; subCategorySlug?: string } {
  return { categorySlug: bestMatch(text, CATEGORY_KEYWORDS), subCategorySlug: bestMatch(text, SUBCATEGORY_KEYWORDS) };
}

// ------------------------------------------------------------
// Budget extraction — Persian money phrases
// ------------------------------------------------------------
export interface BudgetRange {
  min?: number;
  max?: number;
  currency: "تومان";
  raw: string;
}

const MULTIPLIERS: [RegExp, number][] = [
  [/میلیارد/g, 1_000_000_000],
  [/میلیون/g, 1_000_000],
  [/هزار/g, 1_000],
  [/million/g, 1_000_000],
];

/** Parse «زیر ۵۰ میلیون», «بین ۲۰ تا ۴۰ میلیون», «تا ۵٬۰۰۰٬۰۰۰ تومان», «حدود ۳۰ میلیون». */
export function extractBudget(input: string): BudgetRange | null {
  const text = normalize(input);
  if (!/\d/.test(text)) return null;

  // find every number token with an optional multiplier word right after it
  const numbers: { value: number; index: number }[] = [];
  const numberRe = /(\d[\d,٬.\s]*\d|\d+)/g;
  let match: RegExpExecArray | null;
  while ((match = numberRe.exec(text))) {
    const rawNumber = match[1].replace(/[,٬.\s]/g, "");
    if (!rawNumber) continue;
    const value = Number(rawNumber);
    if (!Number.isFinite(value) || value <= 0) continue;
    const tail = text.slice(match.index, match.index + match[0].length + 12);
    let multiplier = 1;
    for (const [re, mult] of MULTIPLIERS) {
      re.lastIndex = 0;
      if (re.test(tail)) {
        multiplier = mult;
        break;
      }
    }
    numbers.push({ value: value * multiplier, index: match.index });
  }
  if (!numbers.length) return null;

  // «بین X تا Y»
  if (/بین/.test(text) && numbers.length >= 2) {
    const [a, b] = numbers.slice(0, 2).map((n) => n.value);
    return { min: Math.min(a, b), max: Math.max(a, b), currency: "تومان", raw: text };
  }
  // «زیر / کمتر از / تا / حداکثر X»
  if (/(زیر|کمتر از|تا|حداکثر|نه بیشتر از|max|under)/.test(text)) {
    const value = numbers[0].value;
    return { max: value, currency: "تومان", raw: text };
  }
  // «بالای / بیشتر از / حداقل X»
  if (/(بالای|بیشتر از|حداقل|از|min|over)/.test(text)) {
    const value = numbers[0].value;
    return { min: value, currency: "تومان", raw: text };
  }
  // «حدود X» / bare number → ±20% window
  const value = numbers[0].value;
  return { min: Math.round(value * 0.8), max: Math.round(value * 1.2), currency: "تومان", raw: text };
}

/** Extract an explicit SKU/code token like «SOF-1024» or «کد محصول 1024». */
export function extractSku(input: string): string | null {
  const text = toLatinDigits(input ?? "");
  const explicit = text.match(/\b([A-Z]{2,5}[-_]?\d{2,8})\b/i);
  if (explicit) return explicit[1].toUpperCase();
  const withLabel = text.match(/(?:sku|کد محصول|کد کالا)\s*[:\-]?\s*([A-Za-z0-9\-_]{3,24})/i);
  if (withLabel) return withLabel[1].toUpperCase();
  return null;
}

export interface ShoppingIntent {
  /** Raw normalized query for keyword search. */
  q: string;
  categorySlug?: string;
  subCategorySlug?: string;
  styleSlugs: string[];
  colors: string[];
  rooms: string[];
  materials: string[];
  budget: BudgetRange | null;
  sku: string | null;
  /** Is this a purchase-intent message at all? */
  isShopping: boolean;
  /** 0..1 — how much of the request we could actually parse. */
  confidence: number;
  /** Human-readable Persian summary of what was understood. */
  summary: string;
}

const SHOPPING_VERBS = [
  "بخر", "خرید", "پیدا کن", "پیشنهاد", "معرفی", "میخوام", "می‌خوام", "می خواهم", "لازم دارم", "دنبال",
  "قیمت", "موجود", "سفارش", "want", "buy", "find", "recommend", "price", "need", "suggest",
];

const DESIGN_ONLY = ["طراحی کن", "رندر", "عکس", "بازطراحی", "دکور کن", "چیدمان کن"];

export function extractShoppingIntent(input: string): ShoppingIntent {
  const text = normalize(input);
  const { categorySlug, subCategorySlug } = matchCategories(text);
  const styleSlugs = matchStyles(text);
  const colors = matchColorNames(text);
  const rooms = matchRooms(text);
  const materials = matchMaterials(text);
  const budget = extractBudget(text);
  const sku = extractSku(input);

  const hasProductNoun = Boolean(categorySlug || subCategorySlug);
  const hasVerb = SHOPPING_VERBS.some((v) => text.includes(normalize(v)));
  const isDesignOnly = DESIGN_ONLY.some((v) => text.includes(normalize(v))) && !hasVerb;
  const isShopping = !isDesignOnly && (hasProductNoun || hasVerb || Boolean(sku));

  const signals = [hasProductNoun, styleSlugs.length > 0, colors.length > 0, budget !== null, rooms.length > 0, hasVerb].filter(Boolean).length;
  const confidence = Math.min(1, 0.25 + signals * 0.15);

  // Display names are Persian words, never English slugs — the summary is
  // shown to customers and reused as continuation context.
  const styleName = (s: string): string => STYLE_KEYWORDS[s]?.[0] ?? s;
  const roomName = (r: string): string => ROOM_KEYWORDS[r]?.[0] ?? r;

  const parts: string[] = [];
  if (subCategorySlug || categorySlug) parts.push(SUBCATEGORY_KEYWORDS[subCategorySlug ?? ""]?.[0] ?? CATEGORY_KEYWORDS[categorySlug ?? ""]?.[0] ?? "محصول");
  if (styleSlugs.length) parts.push(`سبک ${styleSlugs.map(styleName).join(" و ")}`);
  if (colors.length) parts.push(`رنگ ${colors.join(" و ")}`);
  if (rooms.length) parts.push(`برای ${rooms.map(roomName).join(" و ")}`);
  if (budget?.max) parts.push(`تا ${budget.max.toLocaleString("fa-IR")} تومان`);
  else if (budget?.min) parts.push(`از ${budget.min.toLocaleString("fa-IR")} تومان`);

  return {
    q: text,
    categorySlug,
    subCategorySlug,
    styleSlugs,
    colors,
    rooms,
    materials,
    budget,
    sku,
    isShopping,
    confidence,
    summary: parts.length ? parts.join("، ") : "درخواست عمومی",
  };
}

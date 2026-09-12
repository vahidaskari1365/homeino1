// ============================================================
// homeino-categories — پیکربندی مشترک دسته‌های محصول هومینو
// (magazine-daily + inspiration-daily)
//
// هدف: پوشش کامل «همه دسته‌های محصول سایت» در موتورهای محتوای خودکار
// تا سئوی هر دسته (ترندها/الهام/مجله) و پیشنهادشدن در دستیارهای
// هوشمند (GEO) به‌طور روزانه تغذیه شود.
//
// منبع حقیقت دسته‌ها: src/data/categories.ts (۹ دسته رسمی) —
// این فایل همان‌ها را به ۱۰ «دسته محتوایی» باز می‌کند (دیوارپوش
// به‌عنوان موضوع داغ سئو اضافه شده؛ تولید محتواست نه فهرست محصول).
// ============================================================

/**
 * دسته‌های محتوایی محصول — برای پین‌های الهامِ محصول‌محور
 * room = نزدیک‌ترین فضای صفحه الهام (تکسونومی ثابت فیلتر سایت)
 */
export const PRODUCTS = [
  { slug: "مبل و مبلمان", en: "sofa couch armchair furniture arrangement", room: "پذیرایی" },
  { slug: "فرش و قالیچه", en: "area rug carpet interior", room: "پذیرایی" },
  { slug: "کف‌پوش", en: "wood flooring parquet interior", room: "پذیرایی" },
  { slug: "روشنایی و لوستر", en: "pendant light chandelier lamp interior", room: "پذیرایی" },
  { slug: "تابلو و دیوارکوب", en: "wall art gallery wall frame decor", room: "پذیرایی" },
  { slug: "گلدان و گیاه", en: "vase houseplant greenery interior", room: "پذیرایی" },
  { slug: "پرده و منسوجات", en: "curtain drapery window treatment interior", room: "پذیرایی" },
  { slug: "دکوری و اکسسوری", en: "decor accessories mirror candle shelf styling", room: "پذیرایی" },
  { slug: "کمد و ذخیره‌سازی", en: "wardrobe closet storage organization", room: "اتاق خواب" },
  { slug: "دیوارپوش", en: "wallpaper wall panel interior", room: "پذیرایی" },
];

/**
 * کلیدواژه‌های صنفی برای دسته‌بندی خودکارِ آیتم فید
 * (magazine-daily: هر کاندید به پرامتن‌ترین دسته‌اش می‌رود تا
 * انتخاب روزانه «متنوع بین دسته‌ها» باشد)
 */
export const CATEGORY_KEYWORDS = {
  "مبلمان": [["furniture", 3], ["sofa", 3], ["couch", 2], ["armchair", 2], ["seating", 2], ["upholst", 2], [" sectional", 2], ["مبل", 3]],
  "فرش و قالیچه": [["rug", 4], ["carpet", 4], ["rugs", 4], ["persian rug", 4], ["kilim", 3], ["فرش", 3], ["قالیچه", 3]],
  "کف‌پوش": [["flooring", 4], ["hardwood floor", 3], ["parquet", 3], ["terrazzo", 3], ["floor design", 2], ["کف‌پوش", 3]],
  "روشنایی و لوستر": [["lighting", 4], ["lamp", 3], ["chandelier", 4], ["pendant light", 3], ["sconce", 2], ["luminaire", 3], ["led ", 2], ["لوستر", 3], ["آباژور", 2]],
  "تابلو و دیوارکوب": [["wall art", 4], ["gallery wall", 4], ["art print", 3], ["painting", 2], ["poster", 1], ["تابلو", 3]],
  "گلدان و گیاه": [["vase", 4], ["houseplant", 4], ["planter", 3], ["plant decor", 3], ["greenery", 2], ["flor", 1], ["گلدان", 3], ["گیاه", 2]],
  "پرده و منسوجات": [["curtain", 4], ["draper", 3], ["window treatment", 4], ["sheer", 2], ["textile", 2], ["linen", 1], ["cushion", 2], ["throw", 1], ["پرده", 3], ["کوسن", 2]],
  "دکوری و اکسسوری": [["accessor", 3], ["mirror decor", 3], ["candle", 2], ["sculpture", 2], ["shelf styling", 3], ["mantel", 2], ["objets", 2], ["دکوری", 3], ["آینه", 2]],
  "کمد و ذخیره‌سازی": [["wardrobe", 4], ["closet", 4], ["storage", 3], ["shelving", 3], ["cabinet", 2], ["organiz", 2], ["کمد", 3]],
  "دیوارپوش": [["wallpaper", 4], ["wall covering", 4], ["wall panel", 3], ["wallpanel", 3], ["mural", 3], ["wainscot", 3], ["دیوارپوش", 3]],
  "رنگ": [["color", 3], ["paint", 3], ["palette", 2], ["color of the year", 4], ["accent wall", 2]],
  "آشپزخانه": [["kitchen", 4], ["countertop", 2], ["backsplash", 3], ["pantry", 2]],
  "حمام": [["bathroom", 4], ["wetroom", 3], ["shower", 2]],
  "متریال": [["material", 2], ["marble", 2], ["wood ", 2], ["stone", 1], ["ceramic", 2], ["veneer", 2], ["burl ", 2]],
  "سبک‌ها": [["japandi", 3], ["minimalis", 3], ["maximal", 3], ["biophilic", 3], ["midcentury", 3], ["art deco", 3], ["scandinavian", 2], ["rustic", 2], ["industrial", 2], ["boho", 2], ["quiet luxury", 3]],
  "هوشمند": [["smart home", 4], ["automat", 2]],
  "ویلا و باغ": [["villa", 3], ["vacation home", 3], ["cottage", 2], ["garden design", 3]],
  "حیاط و بیرونی": [["patio", 3], ["backyard", 3], ["outdoor", 3], ["balcony", 2], ["rooftop", 2], ["terrace", 2]],
  "محیط کار": [["home office", 4], ["workspace", 3], ["desk", 2], ["studio apartment", 2]],
  "سبک زندگی": [["wellness", 2], ["small space", 2], ["renovation", 2], ["organization", 1]],
  "وسایل ترند": [["statement piece", 3], ["curved furniture", 3], ["vintage", 2], ["antique", 2], ["collectible", 2]],
};

/** فیدهای خبری صنفی (Google News) — در کنار فیدهای عمومی نشریات */
export const CATEGORY_FEEDS = [
  "https://news.google.com/rss/search?q=rug+OR+carpet+trends+interior+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=lighting+design+OR+chandelier+OR+lamp+trend+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=wallpaper+OR+%22wall+panel%22+trend+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=curtain+OR+%22window+treatment%22+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=%22wall+art%22+OR+%22gallery+wall%22+decor+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=vase+OR+houseplant+OR+planter+decor+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=flooring+design+trend+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=wardrobe+OR+closet+storage+ideas+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=sofa+OR+furniture+trend+when:3d&hl=en-US&gl=US&ceid=US:en",
  "https://news.google.com/rss/search?q=home+decor+accessories+trend+when:3d&hl=en-US&gl=US&ceid=US:en",
];

/**
 * دسته‌بندی خودکار آیتم فید → نام دسته محتوایی (یا null)
 * امتیاز هر دسته = مجموع وزن کلیدواژه‌های حاضر در عنوان/توضیح
 */
export function itemCategory(item) {
  const text = `${item.title || ""} ${item.desc || ""}`.toLowerCase();
  let best = null, bestScore = 0;
  for (const [cat, kws] of Object.entries(CATEGORY_KEYWORDS)) {
    let s = 0;
    for (const [kw, w] of kws) if (text.includes(kw)) s += w;
    if (s > bestScore) { best = cat; bestScore = s; }
  }
  return best;
}

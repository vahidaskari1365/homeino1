import type { Product } from "@/types";
import { IMG } from "./media";

const COLORS = {
  cream: { name: "کرم", hex: "#e7dccb" },
  charcoal: { name: "ذغالی", hex: "#2b2722" },
  terracotta: { name: "تراکوتا", hex: "#c2703f" },
  sage: { name: "سبز مریم‌گلی", hex: "#7c8467" },
  sand: { name: "شنی", hex: "#cdbfa6" },
  navy: { name: "سرمه‌ای", hex: "#4a6b7c" },
  gold: { name: "طلایی", hex: "#b8915a" },
  white: { name: "سفید", hex: "#fbf9f4" },
  plum: { name: "آلبالویی", hex: "#6b4d5a" },
};

export const products: Product[] = [
  {
    id: "p1", sku: "SOF-1024", slug: "sofa-helia", name: "کاناپه هلیم ۳ نفره", brand: "نور مبلمان", storeId: "st1",
    categorySlug: "furniture", subCategorySlug: "sofa", styleSlugs: ["modern", "scandinavian"],
    price: 48500000, oldPrice: 62000000, currency: "تومان", rating: 4.8, reviewsCount: 142, purchaseCount: 443,
    images: [IMG.living2, IMG.living6, IMG.living7],
    colors: [COLORS.cream, COLORS.charcoal, COLORS.sage], materials: ["پارچه کتان", "چوب راش", "فوم سرد"],
    dimensions: "۲۲۰ × ۹۰ × ۸۵ سانتی‌متر",
    description: "کاناپه‌ی هلیم با طراحی مینیمال و پارچه‌ی کتان نرم، ترکیبی از راحتی و ظرافت است. پایه‌های چوبی راش گرما را به فضا می‌آورند.",
    specs: [{ label: "نوع", value: "۳ نفره" }, { label: "پایه", value: "چوب راش" }, { label: "تضمین", value: "۲۴ ماه" }],
    inStock: true, stockCount: 8, trending: true, aiRecommended: true, tags: ["پذیرایی", "مدرن"],
  },
  {
    id: "p2", sku: "SOF-1025", slug: "sofa-lumi", name: "مبل راحتی لوومی", brand: "نور مبلمان", storeId: "st1",
    categorySlug: "furniture", subCategorySlug: "armchair", styleSlugs: ["modern", "art-deco"],
    price: 18900000, currency: "تومان", rating: 4.7, reviewsCount: 88, purchaseCount: 281,
    images: [IMG.living3, IMG.living9],
    colors: [COLORS.terracotta, COLORS.charcoal], materials: ["حریر مصنوعی", "فلز"],
    dimensions: "۸۵ × ۸۰ × ۹۰ سانتی‌متر",
    description: "مبل راحتی لوومی با خطوط منحنی و روکش مخمل، برای یک گوشه‌ی دنج و شیک در پذیرایی.",
    specs: [{ label: "نوع", value: "تک‌نفره" }, { label: "پایه", value: "فلز" }],
    inStock: true, stockCount: 12, trending: true, tags: ["پذیرایی", "راحتی"],
  },
  {
    id: "p3", sku: "TBL-2041", slug: "coffee-table-oak", name: "میز جلو مبلی بلوط", brand: "آرا اتاق خواب", storeId: "st7",
    categorySlug: "furniture", subCategorySlug: "coffee-table", styleSlugs: ["scandinavian", "japandi"],
    price: 7800000, oldPrice: 9500000, currency: "تومان", rating: 4.6, reviewsCount: 54, purchaseCount: 179,
    images: [IMG.living9, IMG.decor7],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["چوب بلوط", "MDF"],
    dimensions: "۱۱۰ × ۶۰ × ۳۸ سانتی‌متر",
    description: "میز جلو مبلی با سطح چوب بلوط طبیعی و پایه‌های ظریف، کاملاً منطبق با سبک اسکاندیناوی.",
    specs: [{ label: "متریال", value: "چوب بلوط" }],
    inStock: true, stockCount: 20, isNew: true, tags: ["میز", "چوب"],
  },
  {
    id: "p4", sku: "TBL-2042", slug: "dining-set-sara", name: "میز و صندلی ناهارخوری سارا", brand: "نور مبلمان", storeId: "st1",
    categorySlug: "furniture", subCategorySlug: "dining-table", styleSlugs: ["modern", "contemporary"],
    price: 63000000, currency: "تومان", rating: 4.9, reviewsCount: 73, purchaseCount: 236,
    images: [IMG.living9, IMG.living2],
    colors: [COLORS.charcoal, COLORS.sand], materials: ["چوب راش", "پارچه"],
    dimensions: "میز ۱۸۰ × ۹۰ + ۶ صندلی",
    description: "ست کامل ناهارخوری شامل میز و ۶ صندلی، مناسب جمع‌شدن‌های خانوادگی با ظاهری مدرن.",
    specs: [{ label: "ظرفیت", value: "۶ نفر" }],
    inStock: true, stockCount: 5, tags: ["ناهارخوری", "ست"],
  },
  {
    id: "p5", sku: "CHR-3011", slug: "chair-mio", name: "صندلی مِئو", brand: "آتلیه نور", storeId: "st10",
    categorySlug: "furniture", subCategorySlug: "chair", styleSlugs: ["classic", "neoclassical"],
    price: 6200000, currency: "تومان", rating: 4.5, reviewsCount: 41, purchaseCount: 140,
    images: [IMG.decor8],
    colors: [COLORS.plum, COLORS.gold], materials: ["مخمل", "چوب گردو"],
    description: "صندلی تکی با روکش مخمل و پایه‌ی چوب گردو، یک لمس کلاسیک و لوکس برای هر فضا.",
    specs: [{ label: "جنس", value: "مخمل" }],
    inStock: true, stockCount: 16, tags: ["صندلی", "کلاسیک"],
  },
  {
    id: "p6", sku: "DEC-4011", slug: "vase-ceramic-blue", name: "گلدان سرامیکی لاجوردی", brand: "کاسه‌بو آشپزخانه", storeId: "st6",
    categorySlug: "decor", subCategorySlug: "vase", styleSlugs: ["boho", "mediterranean"],
    price: 1450000, oldPrice: 2100000, currency: "تومان", rating: 4.8, reviewsCount: 120, purchaseCount: 377,
    images: [IMG.decor9, IMG.decor6],
    colors: [COLORS.navy, COLORS.white], materials: ["سرامیک دست‌ساز"],
    dimensions: "ارتفاع ۳۲ سانتی‌متر",
    description: "گلدان سرامیکی دست‌ساز با گل‌ولای لاجوردی، هر قطعه منحصربه‌فرد و اثری از دست هنرمند.",
    specs: [{ label: "ساخت", value: "دستی" }],
    inStock: true, stockCount: 40, trending: true, tags: ["گلدان", "سرامیک"],
  },
  {
    id: "p7", sku: "DEC-4012", slug: "mirror-arch", name: "آینه طاقی برنزی", brand: "آتلیه نور", storeId: "st10",
    categorySlug: "decor", subCategorySlug: "mirror", styleSlugs: ["modern", "neoclassical"],
    price: 4900000, currency: "تومان", rating: 4.7, reviewsCount: 36, purchaseCount: 125,
    images: [IMG.decor8],
    colors: [COLORS.gold, COLORS.charcoal], materials: ["فلز برنزی", "آینه"],
    dimensions: "۱۶۰ × ۸۰ سانتی‌متر",
    description: "آینه‌ی طاقی با قاب برنزی، نقطه‌ی کانونیِ ظریف برای دیوار پذیرایی یا راهرو.",
    specs: [{ label: "قاب", value: "فلز برنزی" }],
    inStock: true, stockCount: 9, tags: ["آینه", "دیوار"],
  },
  {
    id: "p8", sku: "ART-5011", slug: "wall-art-line", name: "تابلو خطی مدرن", brand: "چاپان دکور", storeId: "st2",
    categorySlug: "decor", subCategorySlug: "wall-art", styleSlugs: ["minimal", "modern"],
    price: 2800000, currency: "تومان", rating: 4.4, reviewsCount: 22, purchaseCount: 83,
    images: [IMG.decor6],
    colors: [COLORS.charcoal, COLORS.cream], materials: ["بوم", "چوب"],
    dimensions: "۹۰ × ۱۲۰ سانتی‌متر",
    description: "تابلوی انتزاعی با خطوط ساده، برای کامل‌کردن یک دیوار خالی و خلق حس آرامش.",
    specs: [{ label: "نوع", value: "بوم کشیده" }],
    inStock: true, stockCount: 25, tags: ["تابلو", "هنر"],
  },
  {
    id: "p9", sku: "LAMP-552", slug: "lamp-wood-minimal", name: "چراغ رومیزی چوبی مینیمال", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "table-lamp", styleSlugs: ["japandi", "minimal"],
    price: 3900000, oldPrice: 5200000, currency: "تومان", rating: 4.9, reviewsCount: 167, purchaseCount: 518,
    images: [IMG.decor3, IMG.decor4, IMG.decor5],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["چوب راش", "کتان"],
    dimensions: "ارتفاع ۴۵ سانتی‌متر",
    description: "چراغ رومیزی با پایه‌ی چوبی و شید کتانی، نوری گرم و آرامش‌بخش برای گوشه‌ی مطالعه.",
    specs: [{ label: "نور", value: "LED گرم" }, { label: "اتصال", value: "کابل برق" }],
    inStock: true, stockCount: 30, trending: true, aiRecommended: true, tags: ["نور", "رومیزی"],
  },
  {
    id: "p10", sku: "LGT-6012", slug: "floor-lamp-arc", name: "آباژور قوسی لوکس", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "floor-lamp", styleSlugs: ["art-deco", "contemporary"],
    price: 8900000, currency: "تومان", rating: 4.6, reviewsCount: 48, purchaseCount: 161,
    images: [IMG.decor3],
    colors: [COLORS.gold, COLORS.charcoal], materials: ["فلز", "مرمر"],
    dimensions: "ارتفاع ۱۸۰ سانتی‌متر",
    description: "آباژور قوسی با پایه‌ی مرمر و بدنه‌ی فلزی، یک قطعه‌ی مجسمه‌وار که نور را روی مبل می‌پراکند.",
    specs: [{ label: "پایه", value: "مرمر" }],
    inStock: true, stockCount: 7, isNew: true, tags: ["آباژور", "لوکس"],
  },
  {
    id: "p11", sku: "LGT-6013", slug: "ceiling-light-sphere", name: "چراغ سقفی کروی", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "ceiling", styleSlugs: ["modern", "minimal"],
    price: 5400000, currency: "تومان", rating: 4.5, reviewsCount: 33, purchaseCount: 116,
    images: [IMG.living5],
    colors: [COLORS.white, COLORS.gold], materials: ["فلز", "شیر"],
    description: "چراغ سقفی کروی با پخش نور ملایم، مناسب پذیرایی و راهرو با سقف کوتاه.",
    specs: [{ label: "نور", value: "ملایم" }],
    inStock: true, stockCount: 18, tags: ["سقفی", "نور"],
  },
  {
    id: "p12", sku: "RUG-7011", slug: "rug-berber", name: "قالیچه بربری دست‌بافت", brand: "فرش سرا", storeId: "st4",
    categorySlug: "rugs", subCategorySlug: "rug", styleSlugs: ["boho", "rustic"],
    price: 9800000, oldPrice: 13000000, currency: "تومان", rating: 4.8, reviewsCount: 95, purchaseCount: 302,
    images: [IMG.decor10, IMG.living3],
    colors: [COLORS.cream, COLORS.terracotta], materials: ["پشم", "نخ طبیعی"],
    dimensions: "۲۰۰ × ۱۵۰ سانتی‌متر",
    description: "قالیچه بربری با الگوهای هندسی و رنگ‌های زمینی، گرمی و کاراکتری منحصربه‌فرد به فضا می‌دهد.",
    specs: [{ label: "بافت", value: "دستی" }, { label: "متریال", value: "پشم" }],
    inStock: true, stockCount: 6, trending: true, tags: ["قالیچه", "پشم"],
  },
  {
    id: "p13", sku: "RUG-7012", slug: "carpet-modern-geo", name: "فرش مدرن هندسی", brand: "فرش سرا", storeId: "st4",
    categorySlug: "rugs", subCategorySlug: "carpet", styleSlugs: ["modern", "contemporary"],
    price: 14500000, currency: "تومان", rating: 4.6, reviewsCount: 51, purchaseCount: 170,
    images: [IMG.living8],
    colors: [COLORS.charcoal, COLORS.cream], materials: ["پلی‌پروپیلن", "نخ حریر"],
    dimensions: "۳۰۰ × ۲۰۰ سانتی‌متر",
    description: "فرش ماشینی با طرح هندسی مدرن و رنگ‌های خنثی، برای پذیرایی‌های امروزی.",
    specs: [{ label: "بافت", value: "ماشینی" }],
    inStock: true, stockCount: 14, tags: ["فرش", "مدرن"],
  },
  {
    id: "p14", sku: "CUR-8011", slug: "curtain-linen", name: "پرده کتان بلند", brand: "نون تکستایل", storeId: "st5",
    categorySlug: "textiles", subCategorySlug: "curtain", styleSlugs: ["scandinavian", "minimal"],
    price: 3200000, currency: "تومان", rating: 4.5, reviewsCount: 44, purchaseCount: 149,
    images: [IMG.living6],
    colors: [COLORS.cream, COLORS.sand, COLORS.sage], materials: ["کتان", "پنبه"],
    dimensions: "طول ۲۶۰ سانتی‌متر (جفتی)",
    description: "پرده‌ی کتان با ریزش طبیعی، نور را نرم فیلتر می‌کند و حس آرامش اسکاندیناوی می‌سازد.",
    specs: [{ label: "نوع", value: "جفتی" }],
    inStock: true, stockCount: 22, isNew: true, tags: ["پرده", "کتان"],
  },
  {
    id: "p15", sku: "TEX-8012", slug: "cushion-set-earth", name: "ست کوسن پالت خاکی", brand: "نون تکستایل", storeId: "st5",
    categorySlug: "textiles", subCategorySlug: "cushion", styleSlugs: ["boho", "rustic"],
    price: 1850000, oldPrice: 2400000, currency: "تومان", rating: 4.7, reviewsCount: 130, purchaseCount: 407,
    images: [IMG.living3, IMG.living6],
    colors: [COLORS.terracotta, COLORS.sand, COLORS.cream], materials: ["کتان", "ولور"],
    dimensions: "ست ۴ تایی ۴۵×۴۵",
    description: "ست چهار تایی کوسن با بافت‌های متنوع و رنگ‌های زمینی، برای لایه‌لایه‌کردن مبل.",
    specs: [{ label: "تعداد", value: "۴ عدد" }],
    inStock: true, stockCount: 35, trending: true, tags: ["کوسن", "ست"],
  },
  {
    id: "p16", sku: "TEX-8013", slug: "throw-knit", name: "پوشالی بافت‌دار", brand: "نون تکستایل", storeId: "st5",
    categorySlug: "textiles", subCategorySlug: "throw", styleSlugs: ["scandinavian", "rustic"],
    price: 1200000, currency: "تومان", rating: 4.6, reviewsCount: 67, purchaseCount: 218,
    images: [IMG.living6],
    colors: [COLORS.cream, COLORS.charcoal], materials: ["اکریلیک", "پشم"],
    description: "پوشالی نرم بافت‌دار برای روی مبل یا تخت، گرما و بافت را به فضا اضافه می‌کند.",
    specs: [{ label: "بافت", value: "دست‌باف شبیه" }],
    inStock: true, stockCount: 28, tags: ["پوشالی", "گرم"],
  },
  {
    id: "p17", sku: "KIT-9011", slug: "dinnerware-stone", name: "ست ظروف استون‌ور", brand: "کاسه‌بو آشپزخانه", storeId: "st6",
    categorySlug: "kitchen", subCategorySlug: "dinnerware", styleSlugs: ["minimal", "japandi"],
    price: 4200000, currency: "تومان", rating: 4.8, reviewsCount: 156, purchaseCount: 485,
    images: [IMG.bed3],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["سرامیک استون‌ور"],
    dimensions: "ست ۱۲ تایی (۴ نفره)",
    description: "ست ظروف استون‌ور با رنگ مات و طبیعی، میز ناهار را به یک تجربه‌ی زیبا تبدیل می‌کند.",
    specs: [{ label: "تعداد", value: "۱۲ تکه" }],
    inStock: true, stockCount: 19, trending: true, tags: ["ظروف", "ست"],
  },
  {
    id: "p18", sku: "KIT-9012", slug: "kitchen-organizer-wood", name: "نظم‌دهنده چوبی آشپزخانه", brand: "کاسه‌بو آشپزخانه", storeId: "st6",
    categorySlug: "kitchen", subCategorySlug: "organizer", styleSlugs: ["scandinavian", "minimal"],
    price: 980000, currency: "تومان", rating: 4.4, reviewsCount: 39, purchaseCount: 134,
    images: [IMG.decor7],
    colors: [COLORS.sand], materials: ["چوب بامبو"],
    description: "نظم‌دهنده‌ی بامبویی برای کشو و کابینت، سادگی و نظم را به آشپزخانه می‌آورد.",
    specs: [{ label: "متریال", value: "بامبو" }],
    inStock: true, stockCount: 50, tags: ["نظم", "آشپزخانه"],
  },
  {
    id: "p19", sku: "BED-1011", slug: "bed-nordic", name: "تخت نوردیک چوبی", brand: "آرا اتاق خواب", storeId: "st7",
    categorySlug: "bedroom", subCategorySlug: "bed", styleSlugs: ["scandinavian", "minimal"],
    price: 22500000, oldPrice: 28000000, currency: "تومان", rating: 4.7, reviewsCount: 62, purchaseCount: 203,
    images: [IMG.bed2, IMG.bed9],
    colors: [COLORS.sand, COLORS.white], materials: ["چوب راش", "MDF"],
    dimensions: "۱۶۰ × ۲۰۰ سانتی‌متر",
    description: "تخت نوردیک با پایه‌های چوبی کم‌رنگ و هددبرد ساده، آرامش یک اتاق خواب اسکاندیناویایی.",
    specs: [{ label: "سایز", value: "۱۶۰" }],
    inStock: true, stockCount: 6, aiRecommended: true, tags: ["تخت", "چوب"],
  },
  {
    id: "p20", sku: "BED-1012", slug: "nightstand-oak", name: "میز کنار تخت بلوط", brand: "آرا اتاق خواب", storeId: "st7",
    categorySlug: "bedroom", subCategorySlug: "nightstand", styleSlugs: ["scandinavian", "japandi"],
    price: 3400000, currency: "تومان", rating: 4.6, reviewsCount: 28, purchaseCount: 101,
    images: [IMG.bed3],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["چوب بلوط"],
    dimensions: "۴۵ × ۴۰ × ۵۵ سانتی‌متر",
    description: "میز کنار تخت فشرده با کشو، جا برای چراغ، کتاب و وسایل روزمره.",
    specs: [{ label: "کشو", value: "۱ عدد" }],
    inStock: true, stockCount: 24, tags: ["میز", "اتاق خواب"],
  },
  {
    id: "p21", sku: "BED-1013", slug: "bedding-linen-set", name: "روتختی کتان ساده", brand: "نون تکستایل", storeId: "st5",
    categorySlug: "bedroom", subCategorySlug: "bedding", styleSlugs: ["minimal", "scandinavian"],
    price: 2600000, currency: "تومان", rating: 4.5, reviewsCount: 71, purchaseCount: 230,
    images: [IMG.bed9],
    colors: [COLORS.cream, COLORS.sage, COLORS.charcoal], materials: ["کتان شسته"],
    description: "ست روتختی کتان شسته‌شده با حس نرم و طبیعی، برای خوابی راحت و ظاهری شیک.",
    specs: [{ label: "نخ", value: "کتان" }],
    inStock: true, stockCount: 33, isNew: true, tags: ["روتختی", "کتان"],
  },
  {
    id: "p22", sku: "WRD-1014", slug: "wardrobe-slim", name: "کمد باریک ایستاده", brand: "آرا اتاق خواب", storeId: "st7",
    categorySlug: "bedroom", subCategorySlug: "wardrobe", styleSlugs: ["modern", "minimal"],
    price: 18900000, currency: "تومان", rating: 4.4, reviewsCount: 19, purchaseCount: 74,
    images: [IMG.bed8],
    colors: [COLORS.charcoal, COLORS.sand], materials: ["MDF", "فلز"],
    dimensions: "۱۲۰ × ۶۰ × ۲۰۰ سانتی‌متر",
    description: "کمد ایستاده‌ی باریک برای فضاهای کوچک، با دستگیره‌های مخفی و ظاهر مینیمال.",
    specs: [{ label: "طبقه", value: "۳" }],
    inStock: false, stockCount: 0, tags: ["کمد", "مینیمال"],
  },
  {
    id: "p23", sku: "DSK-2011", slug: "desk-natural", name: "میز کار طبیعی", brand: "ورک‌نست", storeId: "st8",
    categorySlug: "workspace", subCategorySlug: "desk", styleSlugs: ["scandinavian", "japandi"],
    price: 6700000, currency: "تومان", rating: 4.7, reviewsCount: 58, purchaseCount: 191,
    images: [IMG.decor7, IMG.decor3],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["چوب راش", "فلز"],
    dimensions: "۱۴۰ × ۷۰ سانتی‌متر",
    description: "میز کار با سطح بزرگ چوبی و پایه‌های ظریف، انگیزه و نظم برای روزهای کاری.",
    specs: [{ label: "سطح", value: "چوب راش" }],
    inStock: true, stockCount: 11, aiRecommended: true, tags: ["میز", "کار"],
  },
  {
    id: "p24", sku: "CHR-3012", slug: "office-chair-ergo", name: "صندلی اداری ارگونومیک", brand: "ورک‌نست", storeId: "st8",
    categorySlug: "workspace", subCategorySlug: "office-chair", styleSlugs: ["modern", "contemporary"],
    price: 8900000, oldPrice: 11000000, currency: "تومان", rating: 4.6, reviewsCount: 84, purchaseCount: 269,
    images: [IMG.decor7],
    colors: [COLORS.charcoal, COLORS.sage], materials: ["توری", "فلز", "پلاستیک"],
    description: "صندلی اداری با تکیه‌گاه کمری و تنظیم ارتفاع، برای ساعت‌های طولانی پشت میز بدون خستگی.",
    specs: [{ label: "تنظیم", value: "ارتفاع + کمر" }],
    inStock: true, stockCount: 13, trending: true, tags: ["صندلی", "اداری"],
  },
  {
    id: "p25", sku: "DEC-4013", slug: "sculpture-stone", name: "مجسمه سنگی انتزاعی", brand: "آتلیه نور", storeId: "st10",
    categorySlug: "decor", subCategorySlug: "sculpture", styleSlugs: ["minimal", "japandi"],
    price: 5400000, currency: "تومان", rating: 4.5, reviewsCount: 17, purchaseCount: 68,
    images: [IMG.decor8],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["رزین سنگی"],
    dimensions: "ارتفاع ۳۸ سانتی‌متر",
    description: "مجسمه‌ی انتزاعی با فرم نرم و سطح مات، یک قطعه‌ی هنری برای کنسول یا قفسه.",
    specs: [{ label: "متریال", value: "رزین سنگی" }],
    inStock: true, stockCount: 8, isNew: true, tags: ["مجسمه", "هنر"],
  },
  {
    id: "p26", sku: "DEC-4014", slug: "candle-trio", name: "ست شمع معطر سه‌تایی", brand: "چاپان دکور", storeId: "st2",
    categorySlug: "decor", subCategorySlug: "candle", styleSlugs: ["boho", "minimal"],
    price: 890000, currency: "تومان", rating: 4.6, reviewsCount: 49, purchaseCount: 164,
    images: [IMG.decor6],
    colors: [COLORS.cream, COLORS.sage, COLORS.terracotta], materials: ["موم سویا", "شیشه"],
    description: "ست سه شمع معطر با عطرهای آرامش‌بخش و ظروف شیشه‌ای، برای شب‌های دنج.",
    specs: [{ label: "عطر", value: "وانیل و چوب" }],
    inStock: true, stockCount: 42, tags: ["شمع", "معطر"],
  },
  {
    id: "p27", sku: "OUT-5011", slug: "outdoor-lounge-set", name: "ست مبلمان بالکن", brand: "بالکن‌کو", storeId: "st9",
    categorySlug: "outdoor", subCategorySlug: "outdoor-furniture", styleSlugs: ["modern", "mediterranean"],
    price: 32000000, currency: "تومان", rating: 4.4, reviewsCount: 23, purchaseCount: 86,
    images: [IMG.living5],
    colors: [COLORS.charcoal, COLORS.sage], materials: ["حصیر", "آلومینیوم", "کوسن ضدآب"],
    dimensions: "ست ۴ نفره",
    description: "ست مبلمان بالکن با متریال ضدآب و کوسن‌های مقاوم، برای لحظاتی آرام در فضای باز.",
    specs: [{ label: "مقاومت", value: "ضدآب" }],
    inStock: true, stockCount: 4, isNew: true, tags: ["بالکن", "بیرونی"],
  },
  {
    id: "p28", sku: "OUT-5012", slug: "planter-terracotta", name: "گلدان تراکوتای بزرگ", brand: "بالکن‌کو", storeId: "st9",
    categorySlug: "outdoor", subCategorySlug: "planter", styleSlugs: ["rustic", "mediterranean"],
    price: 1500000, currency: "تومان", rating: 4.3, reviewsCount: 31, purchaseCount: 110,
    images: [IMG.decor10],
    colors: [COLORS.terracotta], materials: ["تراکوتا"],
    dimensions: "ارتفاع ۵۰ سانتی‌متر",
    description: "گلدان تراکوتای بزرگ با رنگ گرم، برای گیاهان بزرگ در تراس یا پذیرایی.",
    specs: [{ label: "متریال", value: "تراکوتا" }],
    inStock: true, stockCount: 26, tags: ["گلدان", "تراس"],
  },
  {
    id: "p29", sku: "SOF-1026", slug: "sofa-bed-modular", name: "کاناپه‌ی ماژولار خواب‌دار", brand: "نور مبلمان", storeId: "st1",
    categorySlug: "furniture", subCategorySlug: "sofa", styleSlugs: ["modern", "minimal"],
    price: 56000000, oldPrice: 68000000, currency: "تومان", rating: 4.9, reviewsCount: 211, purchaseCount: 650,
    images: [IMG.living4, IMG.living8],
    colors: [COLORS.cream, COLORS.sage, COLORS.charcoal], materials: ["پارچه", "فوم"],
    dimensions: "ماژولار (قابل توسعه)",
    description: "کاناپه‌ی ماژولار با قابلیت تبدیل به تخت، انعطاف‌پذیر برای هر پلان و هر تعداد مهمان.",
    specs: [{ label: "نوع", value: "ماژولار" }, { label: "تبدیل", value: "به تخت" }],
    inStock: true, stockCount: 7, trending: true, aiRecommended: true, tags: ["کاناپه", "ماژولار"],
  },
  {
    id: "p30", sku: "SHF-6011", slug: "bookshelf-ladder", name: "میز کتابخانه‌ای نردبانی", brand: "چاپان دکور", storeId: "st2",
    categorySlug: "furniture", subCategorySlug: "coffee-table", styleSlugs: ["scandinavian", "industrial"],
    price: 4600000, currency: "تومان", rating: 4.5, reviewsCount: 37, purchaseCount: 128,
    images: [IMG.decor7],
    colors: [COLORS.charcoal, COLORS.sand], materials: ["چوب", "فلز"],
    dimensions: "۱۸۰ × ۸۰ سانتی‌متر",
    description: "قفسه‌ی نردبانی با چوب و فلز، برای نمایش کتاب، گلدان و اکسسوری در فضاهای کم‌جا.",
    specs: [{ label: "طبقه", value: "۵" }],
    inStock: true, stockCount: 17, tags: ["قفسه", "نردبانی"],
  },
  {
    id: "p31", sku: "LGT-6014", slug: "wall-sconce-brass", name: "چراغ دیواری برنجی", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "wall-lamp", styleSlugs: ["classic", "art-deco"],
    price: 2400000, currency: "تومان", rating: 4.4, reviewsCount: 26, purchaseCount: 95,
    images: [IMG.decor3],
    colors: [COLORS.gold], materials: ["برنج", "شیشه"],
    description: "چراغ دیواری برنجی با نور ملایم، برای راهرو، پله یا کنار آینه.",
    specs: [{ label: "جنس", value: "برنج" }],
    inStock: true, stockCount: 21, tags: ["دیواری", "نور"],
  },
  {
    id: "p32", sku: "TEX-8014", slug: "table-runner-jute", name: "رومیزی چمنی دست‌بافت", brand: "نون تکستایل", storeId: "st5",
    categorySlug: "textiles", subCategorySlug: "table-runner", styleSlugs: ["boho", "rustic"],
    price: 760000, currency: "تومان", rating: 4.5, reviewsCount: 42, purchaseCount: 143,
    images: [IMG.decor10],
    colors: [COLORS.cream, COLORS.sand], materials: ["جوت", "پنبه"],
    dimensions: "۵۰ × ۲۰۰ سانتی‌متر",
    description: "رومیزی جوت دست‌بافت با بافت طبیعی، گرما و بافت را روی میز ناهارخوری می‌آورد.",
    specs: [{ label: "متریال", value: "جوت" }],
    inStock: true, stockCount: 38, tags: ["رومیزی", "بافت"],
  },
  {
    id: "p33", sku: "SOF-1027", slug: "l-sofa-avan", name: "مبل ال «آوان»", brand: "نور مبلمان", storeId: "st1",
    categorySlug: "furniture", subCategorySlug: "sofa", styleSlugs: ["modern", "minimal"],
    price: 62000000, oldPrice: 75000000, currency: "تومان", rating: 4.8, reviewsCount: 96, purchaseCount: 305,
    images: [IMG.living4, IMG.living8],
    colors: [COLORS.cream, COLORS.charcoal, COLORS.sage, COLORS.sand], materials: ["پارچه", "فوم سرد"],
    dimensions: "مبل ال ۲۶۰ × ۱۸۰ سانتی‌متر",
    description: "مبل ال با طراحی ماژولار و نشیمن گسترده، بهترین انتخاب برای پذیرایی‌های بزرگ و خانواده‌دوست.",
    specs: [{ label: "نوع", value: "ال (L)" }, { label: "تبدیل", value: "به تخت" }],
    inStock: true, stockCount: 6, trending: true, aiRecommended: true, tags: ["مبل ال", "پذیرایی"],
  },
  {
    id: "p34", sku: "LGT-6015", slug: "chandelier-nor", name: "لوستر کریستالی «نُر»", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "ceiling", styleSlugs: ["neoclassical", "classic"],
    price: 24000000, currency: "تومان", rating: 4.7, reviewsCount: 54, purchaseCount: 179,
    images: [IMG.living5, IMG.decor3],
    colors: [COLORS.gold, COLORS.white], materials: ["کریستال", "فلز برنجی"],
    dimensions: "قطر ۸۰ سانتی‌متر",
    description: "لوستر کریستالی با بدنه‌ی برنجی، نقطه‌ی کانونی شکوه‌آمیز برای سقف پذیرایی یا ناهارخوری.",
    specs: [{ label: "نوع", value: "لوستر" }],
    inStock: true, stockCount: 7, isNew: true, tags: ["لوستر", "سقفی"],
  },
  {
    id: "p35", sku: "TBL-2043", slug: "dining-table-sepa", name: "میز ناهارخوری چوب بلوط «سِپا»", brand: "نور مبلمان", storeId: "st1",
    categorySlug: "furniture", subCategorySlug: "dining-table", styleSlugs: ["scandinavian", "modern"],
    price: 18500000, currency: "تومان", rating: 4.6, reviewsCount: 41, purchaseCount: 140,
    images: [IMG.living9],
    colors: [COLORS.sand, COLORS.charcoal], materials: ["چوب بلوط", "فلز"],
    dimensions: "۱۸۰ × ۹۰ سانتی‌متر",
    description: "میز ناهارخوری با سطح چوب بلوط طبیعی و پایه‌های ظریف، جایی برای دورهمی‌های خانوادگی.",
    specs: [{ label: "ظرفیت", value: "۶ نفر" }],
    inStock: true, stockCount: 9, isNew: true, tags: ["میز ناهارخوری", "چوب"],
  },
  {
    id: "p36", sku: "LGT-6016", slug: "floor-lamp-hila", name: "آباژور ایستاده مدرن «هیلا»", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "floor-lamp", styleSlugs: ["modern", "minimal"],
    price: 6700000, oldPrice: 8200000, currency: "تومان", rating: 4.5, reviewsCount: 33, purchaseCount: 116,
    images: [IMG.decor3, IMG.decor4],
    colors: [COLORS.charcoal, COLORS.gold, COLORS.sand], materials: ["فلز", "کتان"],
    dimensions: "ارتفاع ۱۶۰ سانتی‌متر",
    description: "آباژور ایستاده با خطوط ساده و نور گرم، برای روشن‌کردن گوشه‌ای از پذیرایی یا اتاق خواب.",
    specs: [{ label: "نوع", value: "آباژور" }],
    inStock: true, stockCount: 14, tags: ["آباژور", "نور"],
  },
  {
    id: "p37", sku: "LGT-6017", slug: "wall-sconce-zar", name: "دیوارکوب برنجی «زَر»", brand: "لوامینا", storeId: "st3",
    categorySlug: "lighting", subCategorySlug: "wall-lamp", styleSlugs: ["neoclassical", "art-deco"],
    price: 2900000, currency: "تومان", rating: 4.4, reviewsCount: 22, purchaseCount: 83,
    images: [IMG.decor3],
    colors: [COLORS.gold], materials: ["برنج", "شیشه"],
    description: "دیوارکوب برنجی با نور ملایم، برای راهرو، پله یا کنار آینه.",
    specs: [{ label: "نوع", value: "دیوارکوب" }],
    inStock: true, stockCount: 30, tags: ["دیوارکوب", "نور"],
  },
  {
    id: "p38", sku: "SOF-1028", slug: "pouf-narm", name: "پوف مخملی «نَرم»", brand: "نون تکستایل", storeId: "st5",
    categorySlug: "furniture", subCategorySlug: "armchair", styleSlugs: ["boho", "modern"],
    price: 2400000, currency: "تومان", rating: 4.3, reviewsCount: 18, purchaseCount: 71,
    images: [IMG.living3],
    colors: [COLORS.terracotta, COLORS.sage, COLORS.cream, COLORS.plum], materials: ["مخمل", "فوم"],
    dimensions: "قطر ۴۵ سانتی‌متر",
    description: "پوف مخملی سبک برای نشستن یا به‌عنوان میز عرفی، یک لمس رنگین و راحت به فضا.",
    specs: [{ label: "نوع", value: "پوف" }],
    inStock: true, stockCount: 25, isNew: true, tags: ["پوف", "راحتی"],
  },
  {
    id: "p39", sku: "SHF-6012", slug: "console-line", name: "کنسول چوبی «لاین»", brand: "آرا اتاق خواب", storeId: "st7",
    categorySlug: "furniture", subCategorySlug: "coffee-table", styleSlugs: ["minimal", "scandinavian"],
    price: 8900000, currency: "تومان", rating: 4.5, reviewsCount: 27, purchaseCount: 98,
    images: [IMG.living9, IMG.decor7],
    colors: [COLORS.charcoal, COLORS.sand], materials: ["چوب", "فلز"],
    dimensions: "۱۲۰ × ۳۵ سانتی‌متر",
    description: "کنسول باریک برای راهرو یا پشت مبل، با کشو برای نگهداری و سطحی برای دکور.",
    specs: [{ label: "کشو", value: "۲ عدد" }],
    inStock: true, stockCount: 12, tags: ["کنسول", "راهرو"],
  },
];

export const getProduct = (slug: string) => products.find((p) => p.slug === slug);
export const getProductById = (id: string) => products.find((p) => p.id === id);
export const trendingProducts = products.filter((p) => p.trending);
export const aiRecommendedProducts = products.filter((p) => p.aiRecommended);
export const newProducts = products.filter((p) => p.isNew);
export const productsByCategory = (slug: string) =>
  products.filter((p) => p.categorySlug === slug);
export const productsByStore = (storeId: string) =>
  products.filter((p) => p.storeId === storeId);
export const productsByStyle = (slug: string) =>
  products.filter((p) => p.styleSlugs.includes(slug as never));

// ============================================================
// DISCOVERY — Similar products (style + category overlap).
// ============================================================
export const similarProducts = (productId: string, limit = 4): Product[] => {
  const target = products.find((p) => p.id === productId);
  if (!target) return [];
  return products
    .filter((p) => p.id !== productId)
    .map((p) => {
      const sharedStyles = p.styleSlugs.filter((s) => target.styleSlugs.includes(s)).length;
      const sameCategory = p.categorySlug === target.categorySlug ? 1 : 0;
      const sameStore = p.storeId === target.storeId ? 1 : 0;
      return { p, score: sharedStyles * 2 + sameCategory + sameStore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.p);
};

// ============================================================
// TRUST — per-product purchase count for the trust panel.
// Deterministic & stable (seeded by reviews + rating) so it never
// flickers between renders. Replace with real sales from backend.
// ============================================================
export const getProductSalesCount = (p: Product): number =>
  Math.max(1, Math.round(p.reviewsCount * 6 + p.rating * 12));


// ============================================================
// SKU / PRODUCT CODE RESOLUTION
// ============================================================

export const SKU_ALIASES: Record<string, string> = {
  "home-sf-8821": "p1",
  "sof-1024": "p1",
  "sof-1025": "p2",
  "lamp-552": "p9",
  "rug-441": "p12",
  "cur-301": "p14",
  "tbl-2041": "p3",
  "chr-3011": "p5",
  "bed-1011": "p19",
};

export const getProductBySku = (sku: string): Product | undefined => {
  if (!sku) return undefined;
  const clean = sku.trim().toLowerCase();
  if (SKU_ALIASES[clean]) {
    const aliased = getProductById(SKU_ALIASES[clean]);
    if (aliased) return aliased;
  }
  return products.find(
    (p) =>
      (p.sku && p.sku.toLowerCase() === clean) ||
      p.id.toLowerCase() === clean ||
      p.slug.toLowerCase() === clean
  );
};

export const getProductBySkuOrCode = (code: string): Product | undefined => {
  return getProductBySku(code);
};

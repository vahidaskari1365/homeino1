import type { Store, Collection } from "@/types";
import { IMG } from "./media";

// ============================================================
// MOCK STORES — frontend is fully marketplace-ready.
// Trust/policy fields below will come from the backend when
// real stores onboard. Until then they are realistic sample data.
// ============================================================

export const stores: Store[] = [
  {
    id: "st1", slug: "noor-mobl", name: "نور مبلمان", logo: "ن", logoColor: "#c2703f",
    cover: IMG.living2, description: "طراحی و تولید مبلمان مدرن با متریال درجه یک و کارگاه اختصاصی در تهران.",
    rating: 4.8, reviewsCount: 1240, productCount: 86, city: "تهران",
    verified: true, trending: true, isNew: false, categorySlugs: ["furniture"],
    salesCount: 3840, followersCount: 5210, sinceYear: 1398, responseTime: "زیر ۲ ساعت",
    badges: ["پرفروش", "ارسال سریع", "ضمانت ۲۴ ماهه"],
    shippingPolicy: "ارسال به سراسر کشور طی ۳ تا ۷ روز کاری؛ سفارش‌های بالای ۵ میلیون تومان ارسال رایگان دارند.",
    returnPolicy: "۷ روز بازگشت بدون قید و شرط در صورت سالم بودن کالا و بسته‌بندی اصلی.",
  },
  {
    id: "st2", slug: "chapan-decor", name: "چاپان دکور", logo: "چ", logoColor: "#7c8467",
    cover: IMG.decor6, description: "اکسسوری و دکوراسیون الهام‌گرفته از سبک ژاپنی و مینیمال.",
    rating: 4.7, reviewsCount: 632, productCount: 54, city: "اصفهان",
    verified: true, trending: false, isNew: true, categorySlugs: ["decor"],
    salesCount: 1180, followersCount: 2140, sinceYear: 1401, responseTime: "زیر ۶ ساعت",
    badges: ["ارسال سریع", "بسته‌بندی امن"],
    shippingPolicy: "ارسال با بسته‌بندی ضربه‌گیر طی ۲ تا ۵ روز کاری؛ ارسال رایگان از ۲ میلیون تومان.",
    returnPolicy: "۷ روز بازگشت برای کالاهای سالم و استفاده‌نشده.",
  },
  {
    id: "st3", slug: "lumina-light", name: "لوامینا", logo: "ل", logoColor: "#b8915a",
    cover: IMG.decor3, description: "نورپردازی دکوراتیو و چراغ‌های طراحی برای ایجاد حس و حال در فضا.",
    rating: 4.9, reviewsCount: 988, productCount: 73, city: "تهران",
    verified: true, trending: true, isNew: false, categorySlugs: ["lighting"],
    salesCount: 2960, followersCount: 3980, sinceYear: 1397, responseTime: "زیر ۳ ساعت",
    badges: ["پرفروش", "گارانتی اصالت"],
    shippingPolicy: "ارسال طی ۱ تا ۳ روز کاری؛ لوازم روشنایی با بیمه حمل ارسال می‌شوند.",
    returnPolicy: "۷ روز بازگشت و ۱۸ ماه گارانتی فنی روی محصولات برقی.",
  },
  {
    id: "st4", slug: "farsh-sara", name: "فرش سرا", logo: "ف", logoColor: "#a85a2f",
    cover: IMG.decor10, description: "فرش و قالیچه دستبافت و ماشینی با الگوهای سنتی و مدرن.",
    rating: 4.6, reviewsCount: 421, productCount: 110, city: "کاشان",
    verified: true, trending: false, isNew: false, categorySlugs: ["rugs"],
    salesCount: 1720, followersCount: 2350, sinceYear: 1395, responseTime: "زیر ۱۲ ساعت",
    badges: ["تولید مستقیم", "اصالت کالا"],
    shippingPolicy: "ارسال از کاشان طی ۲ تا ۵ روز کاری؛ امکان باز کردن مرسوله هنگام تحویل.",
    returnPolicy: "۷ روز بازگشت برای فرش‌های ماشینی و دستبافت با برچسب سالم.",
  },
  {
    id: "st5", slug: "noon-textile", name: "نون تکستایل", logo: "ن", logoColor: "#6b4d5a",
    cover: IMG.living6, description: "منسوجات خانگی، کوسن و پرده با بافت‌های نرم و رنگ‌های دلنشین.",
    rating: 4.5, reviewsCount: 310, productCount: 48, city: "یزد",
    verified: false, trending: false, isNew: true, categorySlugs: ["textiles"],
    salesCount: 640, followersCount: 780, sinceYear: 1402, responseTime: "زیر ۲۴ ساعت",
    badges: ["تازه‌وارد"],
    shippingPolicy: "ارسال طی ۳ تا ۶ روز کاری از یزد.",
    returnPolicy: "۷ روز بازگشت برای منسوجات استفاده‌نشده.",
  },
  {
    id: "st6", slug: "kasebo-kitchen", name: "کاسه‌بو آشپزخانه", logo: "ک", logoColor: "#5b7a52",
    cover: IMG.bed3, description: "ظروف سرامیک و اکسسوری آشپزخانه با طراحی ساده و کاربردی.",
    rating: 4.8, reviewsCount: 540, productCount: 92, city: "لالجین",
    verified: true, trending: true, isNew: false, categorySlugs: ["kitchen"],
    salesCount: 2050, followersCount: 2890, sinceYear: 1399, responseTime: "زیر ۴ ساعت",
    badges: ["پرفروش", "دست‌ساز"],
    shippingPolicy: "ارسال سرامیک با بسته‌بندی ویژه طی ۲ تا ۵ روز کاری.",
    returnPolicy: "۷ روز بازگشت؛ در صورت شکستگی در حمل، تعویض رایگان.",
  },
  {
    id: "st7", slug: "ara-bedroom", name: "آرا اتاق خواب", logo: "آ", logoColor: "#4a6b7c",
    cover: IMG.bed2, description: "تخت، کمد و مبلمان اتاق خواب با طراحی آرامش‌بخش.",
    rating: 4.7, reviewsCount: 287, productCount: 61, city: "تهران",
    verified: true, trending: false, isNew: false, categorySlugs: ["bedroom", "furniture"],
    salesCount: 1330, followersCount: 1760, sinceYear: 1400, responseTime: "زیر ۵ ساعت",
    badges: ["ارسال و نصب رایگان"],
    shippingPolicy: "ارسال و نصب رایگان در تهران؛ شهرستان‌ها طی ۴ تا ۸ روز کاری.",
    returnPolicy: "۷ روز بازگشت برای مبلمان و تخت‌های استفاده‌نشده.",
  },
  {
    id: "st8", slug: "work-nest", name: "ورک‌نست", logo: "و", logoColor: "#2b2722",
    cover: IMG.decor7, description: "مبلمان و ابزار فضای کار برای تمرکز و بهره‌وری.",
    rating: 4.6, reviewsCount: 198, productCount: 39, city: "تهران",
    verified: false, trending: false, isNew: true, categorySlugs: ["workspace"],
    salesCount: 380, followersCount: 520, sinceYear: 1402, responseTime: "زیر ۲۴ ساعت",
    badges: ["تازه‌وارد"],
    shippingPolicy: "ارسال طی ۲ تا ۵ روز کاری.",
    returnPolicy: "۷ روز بازگشت با بسته‌بندی سالم.",
  },
  {
    id: "st9", slug: "balkon-co", name: "بالکن‌کو", logo: "ب", logoColor: "#7c8467",
    cover: IMG.living5, description: "مبلمان و دکور فضای باز برای بالکن، تراس و حیاط.",
    rating: 4.4, reviewsCount: 156, productCount: 44, city: "شمال",
    verified: false, trending: false, isNew: false, categorySlugs: ["outdoor"],
    salesCount: 410, followersCount: 590, sinceYear: 1401, responseTime: "زیر ۲۴ ساعت",
    badges: ["فضای باز"],
    shippingPolicy: "ارسال مبلمان فضای باز طی ۴ تا ۸ روز کاری.",
    returnPolicy: "۷ روز بازگشت برای کالاهای سالم.",
  },
  {
    id: "st10", slug: "atelier-noor", name: "آتلیه نور", logo: "آ", logoColor: "#b8915a",
    cover: IMG.decor8, description: "گالری محصولات لوکس و کلاسیک برای خانه‌هایی با استاندارد بالا.",
    rating: 4.9, reviewsCount: 712, productCount: 67, city: "تهران",
    verified: true, trending: true, isNew: false, categorySlugs: ["decor", "furniture", "lighting"],
    salesCount: 3220, followersCount: 4650, sinceYear: 1396, responseTime: "زیر ۲ ساعت",
    badges: ["لوکس", "ضمانت اصالت"],
    shippingPolicy: "ارسال اختصاصی و بیمه‌شده طی ۳ تا ۶ روز کاری؛ ارسال رایگان سفارش‌های بالای ۵ میلیون تومان.",
    returnPolicy: "۷ روز بازگشت و ضمانت اصالت کالاهای لوکس.",
  },
];

export const getStore = (slug: string) => stores.find((s) => s.slug === slug);
export const getStoreById = (id: string) => stores.find((s) => s.id === id);

export const collections: Collection[] = [
  { id: "co1", slug: "warm-living", title: "پذیرایی گرم", subtitle: "پالت خاکی و نور دلنشین", image: IMG.living2, count: 24 },
  { id: "co2", slug: "quiet-bedroom", title: "اتاق خوابِ آرام", subtitle: "خارج از هیاهوی روز", image: IMG.bed4, count: 18 },
  { id: "co3", slug: "monochrome", title: "تک‌رنگِ شیک", subtitle: "سیاه، سفید و طوسی", image: IMG.living7, count: 31 },
  { id: "co4", slug: "natural-textures", title: "بافت‌های طبیعی", subtitle: "چوب، کتان و سنگ", image: IMG.decor6, count: 22 },
  { id: "co5", slug: "reading-corner", title: "گوشه‌ی مطالعه", subtitle: "مبل، چراغ و آرامش", image: IMG.decor7, count: 15 },
  { id: "co6", slug: "small-space", title: "راهکار خانه‌ی کوچک", subtitle: "بیشترین استفاده از کمترین فضا", image: IMG.living8, count: 27 },
];

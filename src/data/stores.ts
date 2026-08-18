import type { Store, Collection } from "@/types";
import { IMG } from "./media";

export const stores: Store[] = [
  {
    id: "st1", slug: "noor-mobl", name: "نور مبلمان", logo: "ن", logoColor: "#c2703f",
    cover: IMG.living2, description: "طراحی و تولید مبلمان مدرن با متریال درجه یک و کارگاه اختصاصی در تهران.",
    rating: 4.8, reviewsCount: 1240, productCount: 86, city: "تهران",
    verified: true, trending: true, isNew: false, categorySlugs: ["furniture"],
  },
  {
    id: "st2", slug: "chapan-decor", name: "چاپان دکور", logo: "چ", logoColor: "#7c8467",
    cover: IMG.decor6, description: "اکسسوری و دکوراسیون الهام‌گرفته از سبک ژاپنی و مینیمال.",
    rating: 4.7, reviewsCount: 632, productCount: 54, city: "اصفهان",
    verified: true, trending: false, isNew: true, categorySlugs: ["decor"],
  },
  {
    id: "st3", slug: "lumina-light", name: "لوامینا", logo: "ل", logoColor: "#b8915a",
    cover: IMG.decor3, description: "نورپردازی دکوراتیو و چراغ‌های طراحی برای ایجاد حس و حال در فضا.",
    rating: 4.9, reviewsCount: 988, productCount: 73, city: "تهران",
    verified: true, trending: true, isNew: false, categorySlugs: ["lighting"],
  },
  {
    id: "st4", slug: "farsh-sara", name: "فرش سرا", logo: "ف", logoColor: "#a85a2f",
    cover: IMG.decor10, description: "فرش و قالیچه دستبافت و ماشینی با الگوهای سنتی و مدرن.",
    rating: 4.6, reviewsCount: 421, productCount: 110, city: "کاشان",
    verified: true, trending: false, isNew: false, categorySlugs: ["rugs"],
  },
  {
    id: "st5", slug: "noon-textile", name: "نون تکستایل", logo: "ن", logoColor: "#6b4d5a",
    cover: IMG.living6, description: "منسوجات خانگی، کوسن و پرده با بافت‌های نرم و رنگ‌های دلنشین.",
    rating: 4.5, reviewsCount: 310, productCount: 48, city: "یزد",
    verified: false, trending: false, isNew: true, categorySlugs: ["textiles"],
  },
  {
    id: "st6", slug: "kasebo-kitchen", name: "کاسه‌بو آشپزخانه", logo: "ک", logoColor: "#5b7a52",
    cover: IMG.bed3, description: "ظروف سرامیک و اکسسوری آشپزخانه با طراحی ساده و کاربردی.",
    rating: 4.8, reviewsCount: 540, productCount: 92, city: "لالجین",
    verified: true, trending: true, isNew: false, categorySlugs: ["kitchen"],
  },
  {
    id: "st7", slug: "ara-bedroom", name: "آرا اتاق خواب", logo: "آ", logoColor: "#4a6b7c",
    cover: IMG.bed2, description: "تخت، کمد و مبلمان اتاق خواب با طراحی آرامش‌بخش.",
    rating: 4.7, reviewsCount: 287, productCount: 61, city: "تهران",
    verified: true, trending: false, isNew: false, categorySlugs: ["bedroom", "furniture"],
  },
  {
    id: "st8", slug: "work-nest", name: "ورک‌نست", logo: "و", logoColor: "#2b2722",
    cover: IMG.decor7, description: "مبلمان و ابزار فضای کار برای تمرکز و بهره‌وری.",
    rating: 4.6, reviewsCount: 198, productCount: 39, city: "تهران",
    verified: false, trending: false, isNew: true, categorySlugs: ["workspace"],
  },
  {
    id: "st9", slug: "balkon-co", name: "بالکن‌کو", logo: "ب", logoColor: "#7c8467",
    cover: IMG.living5, description: "مبلمان و دکور فضای باز برای بالکن، تراس و حیاط.",
    rating: 4.4, reviewsCount: 156, productCount: 44, city: "شمال",
    verified: false, trending: false, isNew: false, categorySlugs: ["outdoor"],
  },
  {
    id: "st10", slug: "atelier-noor", name: "آتلیه نور", logo: "آ", logoColor: "#b8915a",
    cover: IMG.decor8, description: "گالری محصولات لوکس و کلاسیک برای خانه‌هایی با استاندارد بالا.",
    rating: 4.9, reviewsCount: 712, productCount: 67, city: "تهران",
    verified: true, trending: true, isNew: false, categorySlugs: ["decor", "furniture", "lighting"],
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

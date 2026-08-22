import type { Collection } from "@/types";
import { IMG } from "./media";

export interface Article {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  cover: string;
  category: string;
  author: string;
  date: string;
  readTime: number;
  content: string[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  client: string;
  cover: string;
  gallery: string[];
  style: string;
  room: string;
  area: string;
  description: string;
  productIds: string[];
}

export const projects: Project[] = [
  { id: "pr1", slug: "warm-living-tehran", title: "پذیرایی گرم در قلب تهران", client: "خانواده رضایی", cover: IMG.living2, gallery: [IMG.living2, IMG.living6, IMG.decor1], style: "مدرن", room: "پذیرایی", area: "۳۸ متر", description: "بازطراحی یک پذیرایی کوچک با تمرکز بر نور طبیعی، پالت خاکی و مبلمان مینیمال برای حس وسعت و گرما.", productIds: ["p1", "p9", "p15"] },
  { id: "pr2", slug: "japandi-bedroom", title: "اتاق خواب ژاپندی آرام", client: "خانم احمدی", cover: IMG.bed4, gallery: [IMG.bed4, IMG.bed9, IMG.decor6], style: "ژاپندی", room: "اتاق خواب", area: "۱۶ متر", description: "طراحی یک پناهگاه آرام با متریال خام، نور ملایم و خطوط ساده برای خوابی عمیق و آرامش.", productIds: ["p19", "p9", "p21"] },
  { id: "pr3", slug: "minimal-workspace", title: "فضای کار با تمرکز", client: "آقای کریمی", cover: IMG.decor7, gallery: [IMG.decor7, IMG.decor3], style: "مینیمال", room: "فضای کار", area: "۹ متر", description: "یک گوشه‌ی کار خلوت و کاربردی برای حداکثر تمرکز با کمترین اضافات.", productIds: ["p23", "p24", "p9"] },
  { id: "pr4", slug: "luxury-dining", title: "ناهارخوری لوکس و شکوهمند", client: "هتل پارسیان", cover: IMG.living9, gallery: [IMG.living9, IMG.living2], style: "لوکس", room: "ناهارخوری", area: "۲۵ متر", description: "فضایی شکوهمند برای جمع‌شدن‌های خاص با جزئیات طلایی و متریال ممتاز.", productIds: ["p4", "p10"] },
];

export const getProject = (slug: string) => projects.find((p) => p.slug === slug);

export const articles: Article[] = [
  { id: "a1", slug: "warm-palette-guide", title: "راهنمای کامل پالت رنگ گرم برای خانه", excerpt: "چطور با رنگ‌های خاکی و تراکوتا فضایی دلنشین بسازیم.", cover: IMG.living2, category: "راهنمای رنگ", author: "تیم Homeino", date: "۱۴۰۳/۰۸/۱۰", readTime: 6, content: ["رنگ گرم اولین چیزی است که حس خانه بودن را به فضا تزریق می‌کند. پالت‌های مبتنی بر کرم، شنی، تراکوتا و قهوه‌ای، تعادلی بین لوکس بودن و دلنشینی ایجاد می‌کنند.", "برای شروع، یک رنگ غالب خنثی انتخاب کن و با یک رنگ تاکیدی گرم (مثل تراکوتا) آن را زنده کن."] },
  { id: "a2", slug: "small-space-tricks", title: "۱۰ ترفند برای خانه‌های کوچک", excerpt: "بیشترین استفاده از کمترین فضا با طراحی هوشمند.", cover: IMG.living8, category: "خانه کوچک", author: "نگار مرادی", date: "۱۴۰۳/۰۸/۰۵", readTime: 5, content: ["در خانه‌های کوچک، نور و رنگ روشن دو دوست صمیمی‌ات هستند. آینه‌ها هم فضای بصری را گسترش می‌دهند.", "مبلمان ماژولار و چندمنظوره می‌تواند معجزه کند."] },
  { id: "a3", slug: "lighting-basics", title: "اصول نورپردازی داخلی", excerpt: "سه لایه‌ی نور که هر خانه‌ای نیاز دارد.", cover: IMG.decor3, category: "نورپردازی", author: "آرش رستمی", date: "۱۴۰۳/۰۷/۲۸", readTime: 7, content: ["نورپردازی خوب سه لایه دارد: محیطی، وظیفه‌ای و تاکیدی. ترکیب این سه فضای زنده‌ای می‌سازد."] },
  { id: "a4", slug: "japandi-style", title: "سبک ژاپندی چیست؟", excerpt: "تلاقی آرامش ژاپن و گرمای اسکاندیناوی.", cover: IMG.decor6, category: "سبک‌ها", author: "تیم Homeino", date: "۱۴۰۳/۰۷/۱۵", readTime: 4, content: ["جاپندی ترکیبی است از مینیمالیسم ژاپنی و کارایی اسکاندیناویایی. نتیجه: تعادل، سادگی و ارتباط با طبیعت."] },
  { id: "a5", slug: "rug-choosing", title: "چطور فرش مناسب انتخاب کنیم؟", excerpt: "اندازه، جنس و الگوی مناسب هر فضا.", cover: IMG.decor10, category: "راهنمای خرید", author: "سارا کاظمی", date: "۱۴۰۳/۰۷/۰۱", readTime: 5, content: ["یک فرش درست انتخاب‌شده، فضایی را تعریف می‌کند. اندازه‌ی فرش باید حداقل پایه‌های جلویی مبلمان را پوشش دهد."] },
  { id: "a6", slug: "mixing-styles", title: "ترکیب سبک‌ها بدون شلوغی", excerpt: "چطور مدرن و کلاسیک را با هم داشته باشیم.", cover: IMG.living3, category: "سبک‌ها", author: "تیم Homeino", date: "۱۴۰۳/۰۶/۲۰", readTime: 6, content: ["ترکیب سبک‌ها هنر است. قانون ۸۰/۲۰ را رعایت کن: ۸۰٪ یک سبک غالب و ۲۰٪ سبک مکمل."] },
];

export const getArticle = (slug: string) => articles.find((a) => a.slug === slug);

export const projectCollections: Collection[] = [
  { id: "pc1", slug: "warm-living", title: "پذیرایی گرم", subtitle: "پالت خاکی و نور دلنشین", image: IMG.living2, count: 12 },
  { id: "pc2", slug: "calm-bedroom", title: "اتاق خواب آرام", subtitle: "آرامش عمیق", image: IMG.bed4, count: 9 },
  { id: "pc3", slug: "focus-space", title: "فضای تمرکز", subtitle: "کار با بهره‌وری", image: IMG.decor7, count: 7 },
];

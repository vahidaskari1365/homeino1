import type { DecorStyle } from "@/types";
import { IMG } from "./media";

export const styles: DecorStyle[] = [
  {
    slug: "modern",
    name: "مدرن",
    nameEn: "Modern",
    tagline: "خطوط تمیز، فرم‌های ساده و کارایی",
    description:
      "سبک مدرن با خطوط صاف، فرم‌های ساده و تمرکز بر کارایی، فضایی روشن و منظم می‌سازد. مناسب آپارتمان‌های امروزی و کسانی که سادگی را دوست دارند.",
    image: IMG.living2,
    palette: ["#1c1a17", "#e7dccb", "#c2703f", "#f7f3ec"],
    traits: ["خطوط صاف", "رنگ‌های خنثی", "فضای باز", "تکنولوژی"],
  },
  {
    slug: "minimal",
    name: "مینیمال",
    nameEn: "Minimal",
    tagline: "کمتر، اما بهتر",
    description:
      "مینیمال یعنی حذف اضافات و تمرکز بر آنچه واقعاً مهم است. فضایی آرام، خلوت و پر از نور که ذهن را آروم می‌کند.",
    image: IMG.bed1,
    palette: ["#fbf9f4", "#e7dccb", "#6b6358", "#1c1a17"],
    traits: ["فضای خلوت", "سادگی", "نور طبیعی", "نظم"],
  },
  {
    slug: "scandinavian",
    name: "اسکاندیناوی",
    nameEn: "Scandinavian",
    tagline: "گرمای چوب، نور و آرامش",
    description:
      "ترکیب چوب روشن، پارچه‌های نرم و نور فراوان. سبک اسکاندیناوی حس گرما، سادگی و ارتباط با طبیعت را به خانه می‌آورد.",
    image: IMG.bed9,
    palette: ["#f1ebe0", "#cdbfa6", "#7c8467", "#2b2722"],
    traits: ["چوب روشن", "پارچه نرم", "نور فراوان", "آرامش"],
  },
  {
    slug: "japandi",
    name: "جاپندی",
    nameEn: "Japandi",
    tagline: "تلاقی ژاپن و اسکاندیناوی",
    description:
      "ترکیبی بی‌نظیر از مینیمالیسم ژاپنی و گرما‌ی اسکاندیناویایی. فرم‌های طبیعی، متریال خام و حس تعادل و آرامش عمیق.",
    image: IMG.decor6,
    palette: ["#2b2722", "#cdbfa6", "#7c8467", "#1c1a17"],
    traits: ["متریال خام", "تعادل", "طبیعت", "سادگی ژاپنی"],
  },
  {
    slug: "classic",
    name: "کلاسیک",
    nameEn: "Classic",
    tagline: " elegance جاودانه",
    description:
      "سبک کلاسیک با جزئیات ظریف، چوب‌های گرم و فرم‌های متقارن، حسی از اشرافیت و اصالت را به فضا می‌بخشد.",
    image: IMG.living9,
    palette: ["#6b4d5a", "#b8915a", "#2b2722", "#e7dccb"],
    traits: ["جزئیات ظریف", "تقارن", "چوب گرم", "اصالت"],
  },
  {
    slug: "industrial",
    name: "صنعتی",
    nameEn: "Industrial",
    tagline: "بتن، فلز و چوب خام",
    description:
      "الهام گرفته از کارخانه‌های قدیمی با فلز، چوب خام و سطوح خشن. سبک صنعتی جسور، صادق و پر از کاراکتر است.",
    image: IMG.decor8,
    palette: ["#2b2722", "#6b6358", "#b8915a", "#1c1a17"],
    traits: ["فلز و چوب", "سطوح خام", "جسور", "کاراکتر"],
  },
  {
    slug: "boho",
    name: "بوهمیین",
    nameEn: "Boho",
    tagline: "آزاد، رنگین و هنری",
    description:
      "ترکیب الگوها، بافت‌های دست‌بافت و رنگ‌های گرم. سبک بوهمیین فضایی آزاد، خلاقانه و پر از شخصیت می‌سازد.",
    image: IMG.living3,
    palette: ["#c2703f", "#b8915a", "#7c8467", "#6b4d5a"],
    traits: ["الگو", "بافت دست‌بافت", "رنگین", "هنری"],
  },
  {
    slug: "luxury",
    name: "لوکس",
    nameEn: "Luxury",
    tagline: "تکلف، کیفیت و شکوه",
    description:
      "متریال‌های باکیفیت، رنگ‌های عمیق و جزئیات طلایی. سبک لوکس تجربه‌ای از شکوه و اعتبار را به خانه می‌آورد.",
    image: IMG.living5,
    palette: ["#1c1a17", "#b8915a", "#6b4d5a", "#2b2722"],
    traits: ["متریال ممتاز", "جزئیات طلایی", "شکوه", "عمق رنگ"],
  },
  {
    slug: "rustic",
    name: "روستیک",
    nameEn: "Rustic",
    tagline: "طبیعت خام و گرمای روستا",
    description:
      "چوب‌های طبیعی، سنگ و رنگ‌های زمینی. سبک روستیک حس یک کلبه‌ی گرم و دلنشین را با اصالت طبیعت ترکیب می‌کند.",
    image: IMG.living10,
    palette: ["#2b2722", "#b8915a", "#7c8467", "#e7dccb"],
    traits: ["چوب طبیعی", "سنگ", "رنگ زمینی", "گرما"],
  },
  {
    slug: "contemporary",
    name: "مدرن معاصر",
    nameEn: "Contemporary",
    tagline: "روندِ امروز در طراحی",
    description:
      "سبک معاصر، روند روز طراحی را بازتاب می‌دهد؛ انعطاف‌پذیر، متنوع و همیشه در جریان.",
    image: IMG.living8,
    palette: ["#1c1a17", "#e7dccb", "#4a6b7c", "#f7f3ec"],
    traits: ["رو به جلو", "منعطف", "متنوع", "امروزی"],
  },
];

export const getStyle = (slug: string) => styles.find((s) => s.slug === slug);

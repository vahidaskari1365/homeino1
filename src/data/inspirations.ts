import type { InspirationImage, AiDesign, Review } from "@/types";
import { IMG } from "./media";

export const inspirations: InspirationImage[] = [
  { id: "i1", title: "پذیرایی گرم و خاکی", image: IMG.living2, styleSlug: "modern", room: "پذیرایی", tags: ["گرم", "خاکی", "نور"], productIds: ["p1", "p9", "p15"] },
  { id: "i2", title: "اتاق خواب اسکاندیناوی", image: IMG.bed2, styleSlug: "scandinavian", room: "اتاق خواب", tags: ["آرام", "چوب"], productIds: ["p19", "p20", "p21"] },
  { id: "i3", title: "گوشه‌ی مطالعه‌ی مینیمال", image: IMG.decor7, styleSlug: "minimal", room: "فضای کار", tags: ["مطالعه", "نور"], productIds: ["p9", "p23"] },
  { id: "i4", title: "ناهارخوری لوکس", image: IMG.living9, styleSlug: "luxury", room: "ناهارخوری", tags: ["لوکس", "شیک"], productIds: ["p4", "p10"] },
  { id: "i5", title: "پالت تک‌رنگ طوسی", image: IMG.living7, styleSlug: "minimal", room: "پذیرایی", tags: ["تک‌رنگ", "طوسی"], productIds: ["p29", "p15"] },
  { id: "i6", title: "بافت‌های طبیعی ژاپنی", image: IMG.decor6, styleSlug: "japandi", room: "پذیرایی", tags: ["بافت", "طبیعی"], productIds: ["p3", "p6"] },
  { id: "i7", title: "بوهمیین رنگین", image: IMG.living3, styleSlug: "boho", room: "پذیرایی", tags: ["رنگین", "الگو"], productIds: ["p2", "p12", "p15"] },
  { id: "i8", title: "صنعتی و جسور", image: IMG.decor8, styleSlug: "industrial", room: "پذیرایی", tags: ["فلز", "چوب"], productIds: ["p5", "p30"] },
  { id: "i9", title: "روستیک گرم", image: IMG.living10, styleSlug: "rustic", room: "پذیرایی", tags: ["چوب", "گرما"], productIds: ["p12", "p16"] },
  { id: "i10", title: "پذیرایی باز و روشن", image: IMG.living2, styleSlug: "contemporary", room: "پذیرایی", tags: ["باز", "روشن"], productIds: ["p1", "p11"] },
  { id: "i11", title: "آرامش اتاق خواب", image: IMG.bed4, styleSlug: "minimal", room: "اتاق خواب", tags: ["آرام", "ساده"], productIds: ["p19", "p9"] },
  { id: "i12", title: "روشنایی دنج", image: IMG.bed3, styleSlug: "scandinavian", room: "اتاق خواب", tags: ["نور", "دنج"], productIds: ["p9", "p20"] },
  { id: "i13", title: "جزئیات گلدان و بافت", image: IMG.decor10, styleSlug: "boho", room: "پذیرایی", tags: ["گلدان", "بافت"], productIds: ["p12", "p28"] },
  { id: "i14", title: "ظرافت مینیمال ژاپنی", image: IMG.decor6, styleSlug: "japandi", room: "فضای کار", tags: ["مینیمال", "طبیعی"], productIds: ["p23", "p25"] },
  { id: "i15", title: "پذیرایی مدرن معاصر", image: IMG.living8, styleSlug: "contemporary", room: "پذیرایی", tags: ["مدرن", "معاصر"], productIds: ["p29", "p13"] },
  { id: "i16", title: "ست کلاسیک و گرم", image: IMG.living9, styleSlug: "classic", room: "ناهارخوری", tags: ["کلاسیک", "گرم"], productIds: ["p4", "p5"] },
  { id: "i17", title: "بالکن سبز و آرام", image: IMG.living5, styleSlug: "modern", room: "بیرونی", tags: ["سبز", "بالکن"], productIds: ["p27", "p28"] },
  { id: "i18", title: "فضای کار با تمرکز", image: IMG.decor7, styleSlug: "minimal", room: "فضای کار", tags: ["کار", "تمرکز"], productIds: ["p23", "p24"] },
  { id: "i19", title: "گرمایی خاکی", image: IMG.decor1, styleSlug: "modern", room: "پذیرایی", tags: ["خاکی", "گرم"], productIds: ["p1", "p26"] },
  { id: "i20", title: "رویای اسکاندیناوی", image: IMG.bed9, styleSlug: "scandinavian", room: "اتاق خواب", tags: ["آرام", "روشن"], productIds: ["p19", "p21"] },
];

export const getInspiration = (id: string) => inspirations.find((i) => i.id === id);

export const aiDesigns: AiDesign[] = [
  {
    id: "d1", mode: "room-redesign", title: "پذیرایی مدرن بازطراحی‌شده",
    prompt: "پذیراییام را با سبک مدرن و پالت خاکی بازطراحی کن", style: "modern", room: "پذیرایی",
    beforeImage: IMG.living4, afterImage: IMG.living2, status: "completed",
    createdAt: "۱۴۰۳/۰۸/۱۲", creditsUsed: 5,
    products: [
      { label: "کاناپه", productId: "p1" },
      { label: "چراغ رومیزی", productId: "p9" },
      { label: "قالیچه", productId: "p12" },
      { label: "کوسن", productId: "p15" },
    ],
  },
  {
    id: "d2", mode: "prompt-to-design", title: "اتاق خواب ژاپنی آرام",
    prompt: "یک اتاق خواب با سبک جاپندی و نور گرم طراحی کن", style: "japandi", room: "اتاق خواب",
    afterImage: IMG.bed4, status: "completed",
    createdAt: "۱۴۰۳/۰۸/۱۰", creditsUsed: 5,
    products: [
      { label: "تخت", productId: "p19" },
      { label: "چراغ", productId: "p9" },
      { label: "روتختی", productId: "p21" },
    ],
  },
  {
    id: "d3", mode: "image-edit", title: "گرم‌تر کردن پذیرایی",
    prompt: "نور و رنگ پذیرایی را گرم‌تر کن و یک فرش اضافه کن", style: "rustic", room: "پذیرایی",
    beforeImage: IMG.living7, afterImage: IMG.living3, status: "completed",
    createdAt: "۱۴۰۳/۰۸/۰۸", creditsUsed: 3,
    products: [
      { label: "فرش", productId: "p12" },
      { label: "کوسن", productId: "p15" },
    ],
  },
  {
    id: "d4", mode: "full-concept", title: "کانسپت کامل فضای کار",
    prompt: "یک فضای کار مینیمال برای تمرکز با بودجه متوسط", style: "minimal", room: "فضای کار",
    afterImage: IMG.decor7, status: "completed",
    createdAt: "۱۴۰۳/۰۸/۰۵", creditsUsed: 8,
    products: [
      { label: "میز کار", productId: "p23" },
      { label: "صندلی", productId: "p24" },
      { label: "چراغ", productId: "p9" },
    ],
  },
];

export const getAiDesign = (id: string) => aiDesigns.find((d) => d.id === id);

export const sampleReviews: Review[] = [
  { id: "r1", author: "نگار م.", rating: 5, date: "۱۴۰۳/۰۷/۲۸", comment: "کیفیت فوق‌العاده‌ست، دقیقاً مثل عکس. راحتی‌اش بی‌نظیره.", helpful: 24 },
  { id: "r2", author: "آرش ر.", rating: 4, date: "۱۴۰۳/۰۷/۱۵", comment: "خیلی خوبه فقط رنگش کمی تیره‌تر از چیزی که انتظار داشتم بود.", helpful: 11 },
  { id: "r3", author: "سارا ک.", rating: 5, date: "۱۴۰۳/۰۶/۳۰", comment: "ارسال سریع و بسته‌بندی عالی. قطعاً دوباره خرید می‌کنم.", helpful: 8 },
  { id: "r4", author: "محمد ت.", rating: 4, date: "۱۴۰۳/۰۶/۱۲", comment: "ارزش قیمتش رو داره. متریال باکیفیتی داره.", helpful: 5 },
];

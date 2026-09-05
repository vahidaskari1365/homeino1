// ============================================================
// AI DESIGN STUDIO — shared constants & vocabularies
// Extracted verbatim from the former single-file page so every
// component (RoomUploader, StylePicker, ItemPicker, …) reads from
// one source. No visual value changed.
// ============================================================
import { IMG } from "@/data/media";
import { secondHandProducts } from "@/data/secondHand";
import type { Product } from "@/types";
import {
  Sofa, ShoppingBag, Blinds, Grid3x3, Lamp, Tv, BookOpen, BedDouble,
  Flower2, Image as ImageIcon, Gem, Briefcase, Recycle, type LucideIcon,
} from "lucide-react";

export type Stage = "UPLOADING" | "ANALYZING_SPACE" | "SELECTING_PRODUCTS" | "LAYING_OUT" | "RENDERING";
export const STAGE_LABEL: Record<Stage, string> = {
  UPLOADING: "آپلود تصویر", ANALYZING_SPACE: "تحلیل فضا",
  SELECTING_PRODUCTS: "انتخاب محصولات", LAYING_OUT: "چیدمان هوشمند", RENDERING: "رندر نهایی",
};
export const STAGE_ORDER: Stage[] = ["UPLOADING", "ANALYZING_SPACE", "SELECTING_PRODUCTS", "LAYING_OUT", "RENDERING"];

export const STYLES = [
  { id: "modern", label: "مدرن", image: IMG.living2 }, { id: "classic", label: "کلاسیک", image: IMG.living9 },
  { id: "minimalist", label: "مینیمال", image: IMG.living7 }, { id: "luxury", label: "لوکس", image: IMG.living5 },
  { id: "scandinavian", label: "اسکاندیناوی", image: IMG.bed9 }, { id: "industrial", label: "صنعتی", image: IMG.decor8 },
  { id: "bohemian", label: "بوهمی", image: IMG.living3 }, { id: "japanese", label: "ژاپنی", image: IMG.decor6 },
  { id: "office", label: "اداری", image: IMG.decor7 },
];

export interface SubType { label: string; desc: string }
export interface CategoryDef { slug: string; label: string; Icon: LucideIcon; subTypes: SubType[] }
export const CATEGORIES: CategoryDef[] = [
  { slug: "furniture", label: "مبلمان", Icon: Sofa, subTypes: [
    { label: "مبل ال", desc: "کاناپه گوشه با نشیمن گسترده" }, { label: "مبل تدی", desc: "مبل راحتی پارچه‌ای" },
    { label: "مبل چسترفیلد", desc: "مبل کلاسیک باشکوه" }, { label: "مبل کلاسیک", desc: "چوبی منبت" },
    { label: "صندلی راحتی", desc: "تکی برای گوشه دنج" }, { label: "پاف", desc: "کاربردی برای نشستن" },
  ]},
  { slug: "dining", label: "میز ناهارخوری", Icon: ShoppingBag, subTypes: [
    { label: "۴ نفره", desc: "خانواده کوچک" }, { label: "۶ نفره", desc: "جمع خانوادگی" },
    { label: "۸ نفره", desc: "مهمانی" }, { label: "گرد", desc: "صمیمانه" },
  ]},
  { slug: "curtain", label: "پرده", Icon: Blinds, subTypes: [
    { label: "پانچی مدرن", desc: "چین‌های منظم" }, { label: "شید و زبرا", desc: "قابل تنظیم نور" },
    { label: "مخمل کلاسیک", desc: "سنگین و لوکس" }, { label: "تور و حریر", desc: "نور ملایم" },
  ]},
  { slug: "carpet", label: "فرش", Icon: Grid3x3, subTypes: [
    { label: "ماشینی مدرن", desc: "هندسی خنثی" }, { label: "دستبافت ایرانی", desc: "اصیل سنتی" },
    { label: "وینتیج", desc: "کنگنه‌نما" }, { label: "گلیم", desc: "بافت تخت طبیعی" },
  ]},
  { slug: "lighting", label: "نورپردازی", Icon: Lamp, subTypes: [
    { label: "آباژور ایستاده", desc: "گوشه فضا" }, { label: "آباژور رومیزی", desc: "کنار مبل" },
    { label: "لوستر سقفی", desc: "نقطه کانونی" }, { label: "دیوارکوب", desc: "نور ملایم" },
  ]},
  { slug: "tv-console", label: "میز TV", Icon: Tv, subTypes: [
    { label: "تلویزیون مدرن", desc: "کم‌جا" }, { label: "کنسول چوبی", desc: "راهرو" }, { label: "جلومبلی", desc: "جلوی کاناپه" },
  ]},
  { slug: "bookcase-shoe", label: "قفسه", Icon: BookOpen, subTypes: [
    { label: "جاکفشی", desc: "ورودی" }, { label: "کتابخانه", desc: "باز" }, { label: "شلف دیواری", desc: "فضای کم" },
  ]},
  { slug: "bedding", label: "تخت", Icon: BedDouble, subTypes: [
    { label: "لمسه‌دوزی", desc: "هدبورد منبت" }, { label: "مدرن", desc: "خطوط تمیز" }, { label: "چوبی", desc: "گرم" },
  ]},
  { slug: "plants", label: "گیاه", Icon: Flower2, subTypes: [
    { label: "آپارتمانی بزرگ", desc: "گوشه فضا" }, { label: "گلدان ایستاده", desc: "کف" }, { label: "تزئینی", desc: "روی میز" },
  ]},
  { slug: "art", label: "تابلو", Icon: ImageIcon, subTypes: [
    { label: "بوم انتزاعی", desc: "مدرن" }, { label: "ست چندتایی", desc: "هم‌خانواده" }, { label: "آینه", desc: "وسعت بصری" },
  ]},
  { slug: "accessories", label: "اکسسوری", Icon: Gem, subTypes: [
    { label: "شمع و شمعدان", desc: "دنجی" }, { label: "مجسمه", desc: "هنری" }, { label: "گلدان کریستال", desc: "لوکس" },
  ]},
  { slug: "office", label: "اداری", Icon: Briefcase, subTypes: [
    { label: "میز اداری", desc: "فضای کافی لپ‌تاپ" }, { label: "صندلی ارگونومیک", desc: "تکیه‌گاه کمری" },
    { label: "مبلمان اداری", desc: "حرفه‌ای" }, { label: "نظم‌دهنده", desc: "آرشیو" }, { label: "چراغ رومیزی", desc: "متمرکز" },
  ]},
  { slug: "second-hand", label: "دسته دوم", Icon: Recycle, subTypes: [
    { label: "مبلمان دسته دوم", desc: "کم‌استفاده با قیمت مناسب" }, { label: "فرش دسته دوم", desc: "قالیچه سالم" },
    { label: "نورپردازی دسته دوم", desc: "آباژور و لوستر" }, { label: "میز و صندلی دسته دوم", desc: "ناهارخوری" },
    { label: "دکور دسته دوم", desc: "گلدان و اکسسوری" },
  ]},
];

export const CAT_PRODUCTS: Record<string, string[]> = {
  furniture: ["p1", "p2", "p33", "p38", "p3", "p5"], dining: ["p4", "p35"], curtain: ["p14"],
  carpet: ["p12", "p13"], lighting: ["p9", "p10", "p34", "p31", "p37", "p11"], "tv-console": ["p3", "p39", "p30"],
  "bookcase-shoe": ["p30", "p39"], bedding: ["p19", "p21", "p20"], plants: ["p6", "p28"],
  art: ["p8", "p7", "p25"], accessories: ["p26", "p25", "p9"], office: ["p23", "p24", "p9"],
};
export const SECOND_HAND_AS_PRODUCTS: Record<string, Product[]> = (() => {
  const map: Record<string, Product[]> = {};
  secondHandProducts.forEach((sh) => {
    const pseudo: Product = { id: sh.id, slug: sh.slug, name: sh.title + " (دسته دوم)", brand: sh.sellerName, storeId: "sh", categorySlug: sh.category, styleSlugs: [], price: sh.price, oldPrice: sh.originalPrice, currency: "تومان", rating: 4, reviewsCount: 0, images: [sh.image], colors: [], materials: [], description: sh.description, specs: [], inStock: true, stockCount: 1, purchaseCount: 0, tags: ["دسته دوم"] };
    (map[sh.category] ??= []).push(pseudo);
  });
  const subMap: Record<string, Product[]> = {};
  map.furniture?.forEach((p) => { (subMap["مبلمان دسته دوم"] ??= []).push(p); (subMap["میز و صندلی دسته دوم"] ??= []).push(p); });
  map.rugs?.forEach((p) => { (subMap["فرش دسته دوم"] ??= []).push(p); });
  map.lighting?.forEach((p) => { (subMap["نورپردازی دسته دوم"] ??= []).push(p); });
  map.decor?.forEach((p) => { (subMap["دکور دسته دوم"] ??= []).push(p); });
  return subMap;
})();
export const DEFAULT_ROOM_IDS = ["p1", "p3", "p9", "p12", "p15", "p6"];

/** Shared visual tokens used by the design-studio cards (readable sizes). */
export const panelCls = "rounded-2xl border border-clay/50 bg-cream p-5 shadow-[var(--shadow-soft)]";
export const stepBadge = "grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-cream";

export interface ProgressStep { key: Stage; label: string; done: boolean; active: boolean }
export function progressSteps(stage: Stage): ProgressStep[] {
  const idx = STAGE_ORDER.indexOf(stage);
  return STAGE_ORDER.map((s) => {
    const sIdx = STAGE_ORDER.indexOf(s);
    return { key: s, label: STAGE_LABEL[s], done: sIdx < idx, active: sIdx === idx };
  });
}

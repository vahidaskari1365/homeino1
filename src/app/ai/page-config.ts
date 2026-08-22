// ============================================================
// AI DESIGNER CONFIG — shared constants for /ai, /ai/history and
// /ai/result/[id]. Pure data, client-safe.
// ============================================================
import type { RoomElement } from "@/services/ai/roomState";
import { IMG } from "@/data/media";

export const ROOM_TYPES = [
  { id: "living", label: "نشیمن / پذیرایی" },
  { id: "bedroom", label: "اتاق خواب" },
  { id: "dining", label: "ناهارخوری" },
  { id: "kitchen", label: "آشپزخانه" },
  { id: "office", label: "اداری" },
  { id: "kids", label: "کودک" },
  { id: "outdoor", label: "بالکن / تراس" },
] as const;

export const STYLES = [
  { id: "modern", label: "مدرن", image: IMG.living2 },
  { id: "classic", label: "کلاسیک", image: IMG.living9 },
  { id: "minimalist", label: "مینیمال", image: IMG.living7 },
  { id: "luxury", label: "لوکس", image: IMG.living5 },
  { id: "scandinavian", label: "اسکاندیناوی", image: IMG.bed9 },
  { id: "industrial", label: "صنعتی", image: IMG.decor8 },
  { id: "bohemian", label: "بوهمی", image: IMG.living3 },
  { id: "japanese", label: "ژاپنی", image: IMG.decor6 },
] as const;

export const COLOR_SWATCHES = [
  { id: "cream", label: "کرم", hex: "#E8DCC8" },
  { id: "white", label: "سفید", hex: "#F5F2EC" },
  { id: "gray", label: "طوسی", hex: "#9AA0A6" },
  { id: "sage", label: "سبز مریم‌گلی", hex: "#9CAF88" },
  { id: "terracotta", label: "تراکوتا", hex: "#C96F4A" },
  { id: "navy", label: "آبی دودی", hex: "#5C7A99" },
  { id: "walnut", label: "گردویی", hex: "#7A5C44" },
  { id: "gold", label: "طلایی", hex: "#BE9A4F" },
  { id: "charcoal", label: "ذغالی", hex: "#3B3B3B" },
] as const;

/** Quick prompts — clicking one also pre-sets scope/targets honestly. */
export const QUICK_PROMPTS: { label: string; scope: "targeted" | "full"; targets?: RoomElement[]; colors?: string[] }[] = [
  { label: "مبل را عوض کن", scope: "targeted", targets: ["sofa"] },
  { label: "رنگ دیوار را کرم کن", scope: "targeted", targets: ["wall"], colors: ["کرم"] },
  { label: "فرش را عوض کن", scope: "targeted", targets: ["rug"] },
  { label: "این اتاق را مدرن کن", scope: "full" },
];

/** Structure always preserved unless the user explicitly goes full redesign. */
export const ARCH_LOCKS = ["پلان و چیدمان", "پرسپکتیو دوربین", "پنجره‌ها", "درها", "سقف", "ابعاد فضا"];

export const roomLabelOf = (id: string) => ROOM_TYPES.find((r) => r.id === id)?.label ?? id;
export const styleLabelOf = (id: string) => STYLES.find((s) => s.id === id)?.label ?? id;

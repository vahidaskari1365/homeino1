// ============================================================
// ROOM ANALYSIS PERSIAN NORMALIZER (SERVER-SAFE, pure)
//
// باگ ۲۰۲۶-۰۹-۱۶ (گزارش مالک): تحلیل عکس انگلیسی برمی‌گشت —
// «سبک فعلی: modern · رنگ‌ها: white/gray/black · فرصت‌ها: add texture».
// GLM/Gemini با وجود prompt فارسی هنوز مقادیر انگلیسی می‌دهند.
//
// این لایه AFTER-PROCESS مشترک هر دو provider است:
//   • واژگان بسته (سبک/رنگ/اتاق) با جدول ترجمه قطعی
//   • عبارات رایج انگلیسی (opportunities/suggestions) با دیکشنری عبارت
//   • هرچه نگاشت نشد دست‌نخورده می‌ماند — هیچ‌وقت متن را خراب نمی‌کنیم
// ============================================================
import type { RoomAnalysis } from "./types";

const STYLE_FA: Record<string, string> = {
  modern: "مدرن", contemporary: "مدرن", minimalist: "مینیمال", minimal: "مینیمال",
  classic: "کلاسیک", neoclassical: "نئوکلاسیک", luxury: "لوکس", glam: "گلام",
  scandinavian: "اسکاندیناوی", industrial: "صنعتی", bohemian: "بوهمی", boho: "بوهمی",
  japanese: "ژاپنی", japandi: "ژاپنی", wabisabi: "ژاپنی", rustic: "روستیک",
  mediterranean: "مدیترانه‌ای", artdeco: "آرت دکو", "art deco": "آرت دکو",
  transitional: "میان‌گذر", traditional: "سنتی", french: "فرانسوی",
  office: "اداری", corporate: "اداری", cozy: "دنج", eclectic: "اکلکتیک",
};

const COLOR_FA: Record<string, string> = {
  white: "سفید", offwhite: "سفید مایل به کرم", black: "مشکی", gray: "طوسی",
  grey: "طوسی", charcoal: "زغالی", beige: "بژ", cream: "کرم", ivory: "عاجی",
  brown: "قهوه‌ای", tan: "کرم قهوه‌ای", wood: "چوبی", wooden: "چوبی",
  walnut: "گردویی", oak: "بلوطی", blue: "آبی", navy: "سرمه‌ای", teal: "سبزآبی",
  green: "سبز", sage: "سبز مریم‌گلی", olive: "زیتونی", mint: "نعنایی",
  red: "قرمز", burgundy: "زرشکی", pink: "صورتی", blush: "گلبهی",
  gold: "طلایی", brass: "برنجی", silver: "نقره‌ای", yellow: "زرد",
  mustard: "خردلی", orange: "نارنجی", terracotta: "آجری", purple: "بنفش",
  lavender: "بنفش کمرنگ", neutral: "خنثی", warm: "گرم", cool: "سرد",
  dark: "تیره", light: "روشن", natural: "طبیعی", earth: "خاکی",
  "earth tones": "تون‌های خاکی", pastel: "پاستل", monochrome: "تک‌رنگ",
  "accent colors": "رنگ‌های تأکیدی", accents: "تأکیدی", stone: "سنگی",
  marble: "مرمری", linen: "کتانی", velvet: "مخملی",
};

/** عبارات رایج انگلیسی در فرصت‌ها/پیشنهادها — نگاشت به فارسی روان. */
const PHRASE_FA: Record<string, string> = {
  "add texture": "افزودن بافت و تکسچر",
  "add a rug": "افزودن فرش",
  "add plants": "افزودن گیاه",
  "add artwork": "افزودن تابلو",
  "add wall art": "افزودن تابلوی دیواری",
  "add lighting": "افزودن نورپردازی",
  "add accent lighting": "افزودن نورپردازی تأکیدی",
  "add pillows": "افزودن کوسن",
  "add cushions": "افزودن کوسن",
  "add a mirror": "افزودن آینه",
  "add curtains": "افزودن پرده",
  "add a focal point": "ایجاد نقطه کانونی",
  "incorporate natural elements": "به‌کارگیری عناصر طبیعی",
  "personalize with art": "شخصی‌سازی فضا با تابلو",
  "personalize with decor": "شخصی‌سازی فضا با دکور",
  "improve lighting": "بهبود نورپردازی",
  "layered lighting": "نورپردازی لایه‌ای",
  "declutter the space": "مرتب و خلوت کردن فضا",
  "declutter": "خلوت کردن فضا",
  "empty wall": "دیوار خالی",
  "empty walls": "دیوارهای خالی",
  "bare wall": "دیوار خالی",
  "bare walls": "دیوارهای خالی",
  "needs a rug": "به فرش نیاز دارد",
  "needs color": "به رنگ نیاز دارد",
  "needs warmth": "به گرما نیاز دارد",
  "more storage": "فضای ذخیره‌سازی بیشتر",
  "refresh textiles": "نوسازی پارچه‌ها و روتختی‌ها",
  "update textiles": "به‌روزرسانی پارچه‌ها",
  "statement piece": "یک قطعه شاخص",
  "statement lighting": "نورپردازی شاخص",
  "accent wall": "دیوار تأکیدی",
  "color palette": "پالت رنگی",
  "warm wood tones": "تون‌های چوبی گرم",
  "cozy atmosphere": "حس دنج فضا",
  "natural light": "نور طبیعی",
  "ambient lighting": "نورپردازی محیطی",
  "task lighting": "نورپردازی موضعی",
  "floor lamp": "آباژور ایستاده",
  "table lamp": "آباژور رومیزی",
  "area rug": "فرش بزرگ",
  "throw blanket": "پتوی تزئینی",
  "coffee table": "میز جلومبلی",
  "side table": "میز کناره",
  "wall color": "رنگ دیوار",
  "accent chair": "صندلی تأکیدی",
  "sofa": "مبل",
  "couch": "مبل",
  "tv stand": "میز تلویزیون",
  "bookshelf": "کتابخانه",
  "indoor plants": "گیاهان آپارتمانی",
  "greenery": "گیاه سبز",
  "metallic accents": "اکسسوری فلزی",
  "wood accents": "اکسسوری چوبی",
};

const ROOM_FA: Record<string, string> = {
  "living room": "نشیمن", lounge: "نشیمن", "sitting room": "نشیمن",
  bedroom: "اتاق خواب", kitchen: "آشپزخانه", "dining room": "ناهارخوری",
  bathroom: "سرویس بهداشتی", hallway: "راهرو", corridor: "راهرو",
  "home office": "اتاق کار", office: "فضای اداری", workspace: "فضای کار",
  "kids room": "اتاق کودک", "children's room": "اتاق کودک",
  nursery: "اتاق نوزاد", balcony: "بالکن", terrace: "تراس",
  entryway: "ورودی", studio: "استودیو", basement: "زیرزمین",
};

const isHex = (s: string) => /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(s.trim());
const isAscii = (s: string) => /^[\x00-\x7F\u2014\u2019\u2018\u201c\u201d\s.,:;()&%/-]+$/.test(s);

function wordMap(text: string, dict: Record<string, string>): string {
  // بلندترین کلید اول — تا «off white» قبل از «white» نگاشت شود
  const keys = Object.keys(dict).sort((a, b) => b.length - a.length);
  let out = text;
  for (const k of keys) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
    out = out.replace(re, dict[k]);
  }
  return out;
}

/** عبارت انگلیسی را فارسی می‌کند؛ متن فارسی/نگاشت‌نشده دست‌نخورده می‌ماند. */
export function toFaText(text: string): string {
  const t = (text ?? "").trim();
  if (!t || !isAscii(t)) return text ?? t;
  const low = t.toLowerCase();
  // ۱) عبارت کامل
  const exact = PHRASE_FA[low] ?? STYLE_FA[low] ?? ROOM_FA[low];
  if (exact) return exact;
  // ۲) نگاشت واژه‌به‌واژه (رنگ/سبک/عبارت) داخل جمله
  const mapped = wordMap(wordMap(low, PHRASE_FA), { ...COLOR_FA, ...STYLE_FA, ...ROOM_FA });
  return mapped || t;
}

function mapList(list: string[] | undefined, fn: (s: string) => string): string[] | undefined {
  if (!Array.isArray(list)) return list;
  return list.map((s) => (typeof s === "string" ? fn(s) : s));
}

/**
 * خروجی تحلیل هر provider را فارسی می‌کند — سبک/رنگ/اتاق/عبارات.
 * مقادیر hex پالت دست‌نخورده می‌مانند (کد رنگ‌اند، نه متن).
 */
export function normalizeRoomAnalysisFa<T extends Partial<RoomAnalysis>>(a: T): T {
  if (!a || typeof a !== "object") return a;
  const out: Record<string, unknown> = { ...a };

  if (typeof out.roomType === "string") out.roomType = toFaText(out.roomType);
  if (typeof out.style === "string") out.style = toFaText(out.style);
  if (typeof out.mood === "string") out.mood = toFaText(out.mood);
  if (typeof out.lighting === "string") out.lighting = toFaText(out.lighting);
  if (out.likelyStyle && typeof out.likelyStyle === "object") {
    const ls = { ...(out.likelyStyle as { style?: string; confidence?: number }) };
    if (typeof ls.style === "string") ls.style = toFaText(ls.style);
    out.likelyStyle = ls;
  }
  if (Array.isArray(out.palette)) {
    out.palette = (out.palette as unknown[]).map((c) =>
      typeof c === "string" && !isHex(c) ? toFaText(c) : c,
    );
  }
  for (const key of ["strengths", "opportunities", "suggestions", "emptySpaces", "functionalIssues", "designOpportunities"]) {
    out[key] = mapList(out[key] as string[] | undefined, toFaText);
  }
  if (Array.isArray(out.guidedSuggestions)) {
    out.guidedSuggestions = (out.guidedSuggestions as { id?: string; title?: string; desc?: string }[]).map((g) => ({
      ...g,
      title: typeof g?.title === "string" ? toFaText(g.title) : g?.title,
      desc: typeof g?.desc === "string" ? toFaText(g.desc) : g?.desc,
    }));
  }
  if (out.architecture && typeof out.architecture === "object") {
    const arch = { ...(out.architecture as Record<string, unknown>) };
    for (const k of ["walls", "floor", "ceiling"]) {
      if (typeof arch[k] === "string") arch[k] = toFaText(arch[k] as string);
    }
    out.architecture = arch;
  }
  return out as T;
}

/** System-prompt مشترک: خروجی تحلیل باید فارسی باشد (GLM/Gemini به‌هم می‌ریزند). */
export const FA_ANALYSIS_DIRECTIVE =
  "IMPORTANT: every VALUE you output (roomType, style, palette color names, mood, strengths, opportunities, suggestions, guidedSuggestions titles/descriptions, lighting, emptySpaces, functionalIssues) MUST be written in fluent PERSIAN (Farsi). Only JSON keys and category ids stay English. Never output English color names like 'white' or 'gray' — write 'سفید'، 'طوسی'. Never output style names like 'modern' — write 'مدرن'.";

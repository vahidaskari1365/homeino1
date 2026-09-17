// ============================================================
// DOMAIN GUARD — پرامپت‌های لنگرِ دامنه و وفاداری (Task 42).
//
// درخواست مالک ۲۰۲۶-۰۹-۱۷:
//  (۱) پشت هر تولید عکس یک پرامپت ثابت باشد که کارکرد تولید با موضوع
//      کاری سایت (دکوراسیون داخلی / مبلمان) منطبق باشد؛
//  (۲) عکس دست‌کاری یا غیرواقعی نشود — فقط همان چیزی که کاربر انتخاب
//      یا توضیح داده (یا بر اساس کد محصول) ساخته/تغییر کند.
//
// Pure strings — بدون env و بدون IO؛ سمت سرور و کلاینت امن است.
// ============================================================

/** لنگر دامنه: خروجی همیشه در فضای دکوراسیون داخلی بماند. */
export const DOMAIN_ANCHOR =
  "Professional interior design photograph for a home decor studio";

/** لنگر وفاداری برای تولید از متن: واقع‌گرایی کامل + فقط عناصر خواسته‌شده. */
export const FIDELITY_ANCHOR = [
  "Photorealistic true-to-life materials with natural soft light",
  "no distortion, no text, no watermark, no collage, no extra people",
  "include ONLY the furniture and decor described in the request and do not invent unrelated objects",
  "keep natural proportions and one coherent room view",
].join(", ");

/** لنگر وفاداری برای ویرایش عکس (موتور edit): حفظ معماری، تغییر فقط خواسته‌شده‌ها. */
export const EDIT_FIDELITY_ANCHOR = [
  "Preserve the original room architecture, camera angle, windows and doors exactly",
  "change ONLY what the user explicitly selected or described",
  "keep every other object, material and color unchanged and realistic",
].join("; ");

export interface GenerationPromptFields {
  prompt?: string;
  style?: string;
  room?: string;
  color?: string;
  mood?: string;
}

/**
 * پرامپت نهایی تولید: لنگر دامنه + فیلدهای ترجمه‌شده (انگلیسی) + لنگر وفاداری.
 * فیلدهای خالی بی‌صدا حذف می‌شوند؛ خروجی همیشه غیرخالی است (لنگر حداقلی).
 */
export function buildGenerationPrompt(f: GenerationPromptFields): string {
  return [
    DOMAIN_ANCHOR,
    f.prompt,
    f.style && `Decor style: ${f.style}`,
    f.room && `Room type: ${f.room}`,
    f.color && `Color palette: ${f.color}`,
    f.mood && `Mood: ${f.mood}`,
    FIDELITY_ANCHOR,
  ]
    .filter(Boolean)
    .join(". ");
}

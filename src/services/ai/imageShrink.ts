// ============================================================
// VISION IMAGE SHRINK (SERVER-ONLY) — Task 47.
//
// کشف پروداکشن ۲۰۲۶-۰۹-۱۷: عکس‌های بزرگ (base64 ≳۱۹۶KB) در مسیر
// بینایی Gemini شکست بی‌صدا می‌خورند و تحلیل به «متن‌محور» می‌افتد
// (source=gemini-text-only)؛ عکس‌های کوچک (≤۴۸KB) همیشه پاس می‌شوند.
// عکس‌های واقعی موبایل ۲-۸MB هستند — بدون کوچک‌سازی، تحلیل واقعیِ
// عکس برای کاربر عملاً هرگز اجرا نمی‌شد.
//
// راه‌حل: قبل از هر call بینایی، عکس به حداکثر ۷۶۸px / JPEG q80
// کوچک می‌شود (کش شریک — fidelity حفظ می‌شود؛ این دست‌کاری نیست،
// فقط فشرده‌سازی برای ارسال). sharp از قبل وابسته پروژه است.
// ============================================================
import "server-only";
import sharp from "sharp";

/** آستانه‌ی عبور بدون تغییر: زیر ~۹۰KB باینری عکس را دست نمی‌زنیم. */
const PASS_THROUGH_B64 = 120_000;

export async function shrinkForVision(
  dataUrl: string,
  maxDim = 768,
  quality = 80,
): Promise<string> {
  const m = /^(data:image\/[\w.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return dataUrl; // data URL نیست (remote/بد فرم) — همان بده
  const [, mime, b64] = m;
  if (b64.length < PASS_THROUGH_B64) return dataUrl;
  try {
    const buf = Buffer.from(b64, "base64");
    const out = await sharp(buf)
      .rotate() // EXIF orientation — بدون چرخش اشتباه
      .resize({ width: maxDim, height: maxDim, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toBuffer();
    console.log(
      `[vision-shrink] ${mime} ${Math.round(buf.length / 1024)}KB -> jpeg ${Math.round(out.length / 1024)}KB (${maxDim}px q${quality})`,
    );
    return `data:image/jpeg;base64,${out.toString("base64")}`;
  } catch (err) {
    console.error("[vision-shrink] failed — passing original:", err instanceof Error ? err.message : err);
    return dataUrl;
  }
}

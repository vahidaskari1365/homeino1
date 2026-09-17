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

/** آستانه‌ی عبور بدون تغییر: زیر ~۹۰KB باینری عکس را دست نمی‌زنیم. */
const PASS_THROUGH_B64 = 120_000;

// sharp's type surface differs across versions/modes (CJS callable vs ESM
// default). Model only the chain we use — runtime stays `(mod.default ?? mod)`.
interface SharpChain {
  rotate(): SharpChain;
  resize(opts: { width: number; height: number; fit: "inside"; withoutEnlargement: boolean }): SharpChain;
  jpeg(opts: { quality: number; mozjpeg: boolean }): SharpChain;
  toBuffer(): Promise<Buffer>;
}
type SharpModule = (input: Buffer) => SharpChain;

/**
 * sharp را دینامیک و fault-tolerant لود می‌کنیم: اگر در محیط اجرا
 * (مثلاً لامبدای ورسل) در دسترس نبود، عکس «بدون تغییر» رد می‌شود —
 * دقیقاً رفتار قدیمی — و زنجیره هرگز به‌خاطر این بهینه‌سازی نمی‌شکند.
 */
async function loadSharp(): Promise<SharpModule | null> {
  try {
    const mod = await import("sharp");
    return (mod.default ?? mod) as SharpModule;
  } catch (err) {
    console.error("[vision-shrink] sharp unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export async function shrinkForVision(
  dataUrl: string,
  maxDim = 768,
  quality = 80,
): Promise<string> {
  const m = /^(data:image\/[\w.+-]+);base64,([\s\S]+)$/.exec(dataUrl);
  if (!m) return dataUrl; // data URL نیست (remote/بد فرم) — همان بده
  const [, mime, b64] = m;
  if (b64.length < PASS_THROUGH_B64) return dataUrl;
  const sharp = await loadSharp();
  if (!sharp) return dataUrl;
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

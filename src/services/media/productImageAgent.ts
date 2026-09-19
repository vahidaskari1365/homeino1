// ============================================================
// PRODUCT IMAGE AGENT (SERVER-ONLY LOGIC, PURE MODULE)
// ایجنت استانداردسازی تصویر محصول — هومینو
//
// مأموریت: هر عکسی که فروشنده آپلود می‌کند، «خودکار» به استاندارد
// رسمی تصویر محصول هومینو تبدیل می‌شود — بدون هیچ دخالت دستی:
//
//   ۱. چرخش خودکار بر اساس EXIF (عکس موبایل هرگز کج نمی‌ماند)
//   ۲. شفافیت (آلفا) روی سفید تخت می‌شود — بدون هالهٔ تیره در CDN
//   ۳. بزرگ‌ترین ضلع به ۱۲۰۰px کوچک می‌شود (هرگز بزرگ‌نمایی نه)
//   ۴. بوم به مربع کامل ۱۲۰۰×۱۲۰۰ با پس‌زمینهٔ سفید پد می‌شود —
//      چون تمام سطوح سایت (کارت، PDP، جستجو) مربع object-cover
//      رندر می‌کنند و عکس غیرمربع یعنی بریدگی ناخواستهٔ محصول
//   ۵. خروجی WebP q82 + حذف کامل متادیتا (حریم خصوصی + حجم)
//
// عمداً هیچ هوش مصنوعی اینجا نیست: آپلود فروشنده مسیر بحرانی
// کاتالوگ است و باید صددرصد قطعی و تکرارپذیر باشد.
// گزارش کامل عملیات (report) به UI برمی‌گردد تا فروشنده ببیند
// ایجنت دقیقاً چه کرد — اصل صداقت ریپو.
// ============================================================

import { ApiError } from "@/lib/api/errors";

/** استاندارد رسمی تصویر محصول هومینو — تنها منبع حقیقت. */
export const PRODUCT_IMAGE_STANDARD = {
  /** خروجی همیشه مربع کامل است (تمام سطوح سایت مربع رندر می‌کنند). */
  size: 1200,
  quality: 82,
  background: { r: 255, g: 255, b: 255 },
  /** کوچک‌تر از این برای عکس محصول قابل قبول نیست. */
  minInputSide: 200,
  /** بزرگ‌تر از این یعنی اسکن/اسکرین‌شات غلط — رد. */
  maxInputSide: 8000,
  /** سقف ورودی (مرورگر عکس‌های سنگین را قبل از آپلود فشرده می‌کند). */
  maxInputBytes: 4 * 1024 * 1024,
  /** زیر این، کیفیت برای گرید سایت ضعیف است — هشدار می‌دهیم. */
  minRecommendSide: 600,
} as const;

export type ProductImageAction =
  | "exif-rotate"
  | "resized"
  | "square-pad"
  | "alpha-flatten"
  | "metadata-strip"
  | "recompress";

export type ProductImageWarning = "low-resolution" | "extreme-aspect" | "animated";

export interface ProductImageReport {
  /** ابعاد مؤثر ورودی (بعد از اعمال جهت EXIF). */
  original: { format: string; width: number; height: number; bytes: number };
  output: { format: "webp"; width: number; height: number; bytes: number };
  actions: ProductImageAction[];
  warnings: ProductImageWarning[];
}

/** فرمت‌های ورودی پذیرفته‌شده — بر اساس «باکتِ» بایت‌ها نه MIME ادعایی. */
const ALLOWED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "tiff"]);

// sharp's type surface differs across versions/modes (CJS callable vs ESM
// default) — same tolerant pattern as services/ai/imageShrink.ts.
interface SharpMetadata {
  format?: string;
  width?: number;
  height?: number;
  orientation?: number;
  hasAlpha?: boolean;
  pages?: number;
  channels?: number;
}
interface SharpChain {
  rotate(): SharpChain;
  flatten(opts: { background: { r: number; g: number; b: number } }): SharpChain;
  resize(width: number, height: number, opts: { fit: "fill" }): SharpChain;
  extend(opts: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    background: { r: number; g: number; b: number };
  }): SharpChain;
  webp(opts: { quality: number }): SharpChain;
  toBuffer(): Promise<Buffer>;
  metadata(): Promise<SharpMetadata>;
}
type SharpModule = (input: Buffer, opts?: { failOn?: "error" }) => SharpChain;

async function loadSharp(): Promise<SharpModule | null> {
  try {
    const mod = await import("sharp");
    return (mod.default ?? mod) as unknown as SharpModule;
  } catch (err) {
    console.error("[product-image-agent] sharp unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
}

export interface StandardizeInput {
  bytes: Buffer;
  /** فقط برای پیام خطا استفاده می‌شود؛ تصمیم‌ها از روی بایت‌های واقعی‌اند. */
  filename?: string;
}

/**
 * قلب ایجنت: بایت‌های خام عکس را می‌گیرد و بافر استاندارد + گزارش عملیات
 * برمی‌گرداند. هر ورودی نامعتبر = ApiError صادقانهٔ فارسی (هرگز ساکت رد نمی‌شود).
 */
export async function standardizeProductImage(
  input: StandardizeInput,
): Promise<{ buffer: Buffer; report: ProductImageReport }> {
  const { bytes } = input;
  if (!bytes || bytes.length === 0) {
    throw ApiError.badRequest("انتخاب عکس الزامی است");
  }
  if (bytes.length > PRODUCT_IMAGE_STANDARD.maxInputBytes) {
    throw ApiError.badRequest(
      `حجم عکس باید کمتر از ${Math.round(PRODUCT_IMAGE_STANDARD.maxInputBytes / (1024 * 1024))} مگابایت باشد`,
    );
  }

  const sharp = await loadSharp();
  if (!sharp) {
    // مسیر بحرانی کاتالوگ — سکوت ممنوع؛ خطای صادقانه می‌دهیم.
    throw new ApiError("INTERNAL", "پردازش تصویر روی سرور در دسترس نیست — بعداً تلاش کن", 500);
  }

  // ۱) شناسایی واقعی فرمت از روی بایت‌ها (MIME ادعایی کلاینت هرگز ملاک نیست)
  let meta: SharpMetadata;
  try {
    meta = await sharp(bytes, { failOn: "error" }).metadata();
  } catch {
    throw ApiError.badRequest("فایل ارسالی تصویر معتبر نیست (فرمت‌های مجاز: JPG، PNG، WebP یا AVIF)");
  }
  const format = String(meta.format ?? "").toLowerCase();
  if (!ALLOWED_FORMATS.has(format)) {
    throw ApiError.badRequest("فرمت تصویر باید JPG، PNG، WebP یا AVIF باشد");
  }

  // ۲) ابعاد مؤثر — جهت EXIF ممکن است عرض/ارتفاع را عوض کند
  const orientation = meta.orientation ?? 1;
  const swapDims = orientation >= 5;
  const storedW = meta.width ?? 0;
  const storedH = meta.height ?? 0;
  const effW = swapDims ? storedH : storedW;
  const effH = swapDims ? storedW : storedH;
  if (!storedW || !storedH || !effW || !effH) {
    throw ApiError.badRequest("ابعاد تصویر خوانده نشد — فایل خراب است");
  }
  if (Math.max(storedW, storedH) > PRODUCT_IMAGE_STANDARD.maxInputSide) {
    throw ApiError.badRequest(
      `ابعاد عکس بیش از حد بزرگ است (حداکثر ${PRODUCT_IMAGE_STANDARD.maxInputSide} پیکسل)`,
    );
  }
  if (Math.min(effW, effH) < PRODUCT_IMAGE_STANDARD.minInputSide) {
    throw ApiError.badRequest(
      `عکس خیلی کوچک است — حداقل ${PRODUCT_IMAGE_STANDARD.minInputSide}×${PRODUCT_IMAGE_STANDARD.minInputSide} پیکسل لازم است`,
    );
  }

  const size = PRODUCT_IMAGE_STANDARD.size;
  const actions: ProductImageAction[] = [];
  const warnings: ProductImageWarning[] = [];

  // ۳) برنامهٔ تغییرات — کاملاً قطعی، قبل از هر رندر
  const scale = Math.min(1, size / Math.max(effW, effH));
  const rw = Math.max(1, Math.round(effW * scale));
  const rh = Math.max(1, Math.round(effH * scale));
  const padX = Math.floor((size - rw) / 2);
  const padY = Math.floor((size - rh) / 2);
  const pad = { top: padY, bottom: size - rh - padY, left: padX, right: size - rw - padX };
  const needsPad = pad.top > 0 || pad.bottom > 0 || pad.left > 0 || pad.right > 0;

  if (orientation !== 1) actions.push("exif-rotate");
  if (scale < 1) actions.push("resized");
  if (needsPad) actions.push("square-pad");
  if (meta.hasAlpha) actions.push("alpha-flatten");
  actions.push("metadata-strip", "recompress");

  // ۴) هشدارهای کیفیت — صادقانه به فروشنده می‌گوییم چه عکسی بهتر است
  const minSide = Math.min(effW, effH);
  const maxSide = Math.max(effW, effH);
  if (minSide < PRODUCT_IMAGE_STANDARD.minRecommendSide) warnings.push("low-resolution");
  if (maxSide / minSide >= 3) warnings.push("extreme-aspect");
  if ((meta.pages ?? 1) > 1) warnings.push("animated");

  // ۵) اجرای پایپ‌لاین: چرخش ← تخت‌سازی آلفا ← تغییر اندازه ← پد مربع ← WebP
  try {
    let img = sharp(bytes, { failOn: "error" }).rotate();
    if (meta.hasAlpha) img = img.flatten({ background: { ...PRODUCT_IMAGE_STANDARD.background } });
    if (scale < 1) img = img.resize(rw, rh, { fit: "fill" });
    if (needsPad) img = img.extend({ ...pad, background: { ...PRODUCT_IMAGE_STANDARD.background } });
    const buffer = await img.webp({ quality: PRODUCT_IMAGE_STANDARD.quality }).toBuffer();

    // خواندن ابعاد خروجی از خودِ فایل تولیدشده (نه فرض ریاضی) — صداقت گزارش
    let outW: number = size;
    let outH: number = size;
    try {
      const outMeta = await sharp(buffer).metadata();
      if (outMeta.width) outW = outMeta.width;
      if (outMeta.height) outH = outMeta.height;
    } catch {
      /* ابعاد پیش‌فرض (بوم برنامه‌ریزی‌شده) معتبر می‌ماند */
    }

    return {
      buffer,
      report: {
        original: { format, width: effW, height: effH, bytes: bytes.length },
        output: { format: "webp", width: outW, height: outH, bytes: buffer.length },
        actions,
        warnings,
      },
    };
  } catch (err) {
    console.error("[product-image-agent] pipeline failed:", err instanceof Error ? err.message : err);
    throw ApiError.badRequest("پردازش این عکس ممکن نشد — عکس دیگری امتحان کن");
  }
}

/* ============================================================
   PERSISTENCE — R2 اول، Supabase Storage جایگزین، خطای صادقانه آخر
   کلید R2: product-images/<yyyy-mm>/<hash>.webp (کش‌پسند)
   کلید Supabase: vendors/<vendorId>/<ts>-<rand>.webp (قابل ممیزی)
   ============================================================ */

export interface PersistedImage {
  url: string;
  storage: "r2" | "supabase";
  key: string;
}

function supabaseStorageConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  return Boolean(url);
}

async function persistToSupabase(bytes: Buffer, vendorId: string): Promise<PersistedImage> {
  const { createSupabaseAdminClient, createSupabaseServerClient } = await import("@/lib/supabase/server");
  // Service role bypasses storage RLS (server-side only) — the buckets have
  // no client INSERT policy by design; anon client stays the honest fallback.
  const supabase = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
  const { randomUUID } = await import("node:crypto");
  const key = `vendors/${vendorId}/${Date.now().toString(36)}-${randomUUID().slice(0, 8)}.webp`;
  const { error } = await supabase.storage.from("product-images").upload(key, bytes, {
    contentType: "image/webp",
    upsert: false,
  });
  if (error) {
    throw new ApiError("PROVIDER_ERROR", "بارگذاری عکس روی سرور ناموفق بود", 502, error.message);
  }
  const { data } = supabase.storage.from("product-images").getPublicUrl(key);
  return { url: data.publicUrl, storage: "supabase", key };
}

/**
 * ذخیرهٔ نهایی عکس استانداردشده. R2 وقتی کامل تنظیم است اولویت دارد
 * (CDN اختصاصی cdn.homeino.ir)؛ وگرنه باکت عمومی product-images سوپابیس.
 * هیچ‌کدام تنظیم نبود = خطای صادقانهٔ ۵۰۳، هرگز URL ساختگی نه.
 */
export async function persistProductImage(
  bytes: Buffer,
  opts: { vendorId: string },
): Promise<PersistedImage> {
  const { isR2Configured, uploadToR2 } = await import("@/services/storage/r2");
  if (isR2Configured()) {
    const up = await uploadToR2(bytes, { prefix: "product-images", contentType: "image/webp" });
    if (up) return { url: up.url, storage: "r2", key: up.key };
    // R2 تنظیم بود ولی شکست → مسیر جایگزین واقعی، نه خطای فیک
    if (supabaseStorageConfigured()) return persistToSupabase(bytes, opts.vendorId);
    throw new ApiError("PROVIDER_ERROR", "ذخیره‌سازی تصویر موقتاً در دسترس نیست — بعداً تلاش کن", 503);
  }
  if (supabaseStorageConfigured()) return persistToSupabase(bytes, opts.vendorId);
  throw new ApiError(
    "PROVIDER_ERROR",
    "ذخیره‌سازی تصویر هنوز روی سرور فعال نشده است — با پشتیبانی در تماس باش",
    503,
  );
}

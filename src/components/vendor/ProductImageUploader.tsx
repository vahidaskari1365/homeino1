"use client";

/**
 * ProductImageUploader — ورودی تصویر محصول فروشنده + ایجنت استانداردسازی.
 *
 * جریان: انتخاب/کشیدن عکس ← پیش‌بینی‌های سمت مرورگر (فرمت/حجم) ←
 * فشرده‌سازی هوشمند مرورگر برای عکس‌های سنگین (سازگار با سقف بادی ورسل) ←
 * آپلود با پیشرفت واقعی ← سرور خودکار عکس را به استاندارد سایت تبدیل
 * می‌کند (مربع ۱۲۰۰×۱۲۰۰، WebP، چرخش EXIF، حذف متادیتا) ← نمایش
 * گزارش صادقانهٔ عملیات به فروشنده.
 *
 * کامپوننت کنترل‌شده است: value/onChange فقط URL نهایی را حمل می‌کند.
 * گزینهٔ دستی «درج آدرس تصویر» هم برای فروشنده‌ای که عکس را جایی آپلود
 * کرده حفظ شده است (همان رفتار قدیمی).
 */

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Link2, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { uploadProductImage, type ProductImageReportDTO } from "@/lib/vendorClient";
import { toFa } from "@/lib/utils";

const ACTION_LABEL: Record<string, string> = {
  "exif-rotate": "چرخش خودکار",
  resized: "کوچک‌سازی",
  "square-pad": "بوم مربع سفید",
  "alpha-flatten": "تخت‌سازی شفافیت",
  "metadata-strip": "حذف متادیتا",
  recompress: "فشرده‌سازی WebP",
};

const WARNING_LABEL: Record<string, string> = {
  "low-resolution": "کیفیت پایین — عکس بزرگ‌تر حرفه‌ای‌تر دیده می‌شود",
  "extreme-aspect": "نسبت ابعاد نامتعارف — عکس نزدیک به مربع بهتر است",
  animated: "تصویر متحرک — فقط فریم اول ذخیره شد",
};

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/avif"]);
/** سقف فایل خام ورودی مرورگر (قبل از فشرده‌سازی). */
const MAX_RAW_BYTES = 10 * 1024 * 1024;
/** بالای این آستانه‌ها مرورگر قبل از ارسال فشرده می‌کند. */
const SHRINK_OVER_BYTES = 3.5 * 1024 * 1024;
const SHRINK_OVER_SIDE = 3000;
const SHRINK_TARGET_SIDE = 2560;

function fmtBytes(n: number): string {
  if (n >= 1024 * 1024) return `${toFa((n / (1024 * 1024)).toFixed(1))}MB`;
  return `${toFa(Math.max(1, Math.round(n / 1024)))}KB`;
}

/**
 * پیش‌فشرده‌سازی مرورگر — عکس‌های موبایل ۴-۸ مگابیتی را قبل از ارسال به
 * JPEG ≤۲۵۶۰px تبدیل می‌کند (createImageBitmap جهت EXIF را خودش اعمال
 * می‌کند). شکست = برگشت به فایل اصلی؛ سرور دوباره اعتبارسنجی می‌کند.
 */
async function preShrink(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = Math.max(bitmap.width, bitmap.height);
    const needsShrink = file.size > SHRINK_OVER_BYTES || maxSide > SHRINK_OVER_SIDE;
    if (!needsShrink) {
      bitmap.close();
      return file;
    }
    const scale = Math.min(1, SHRINK_TARGET_SIDE / maxSide);
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // پرکردن سفید = تخت‌سازی شفافیت PNG قبل از JPEG (هم‌راستا با استاندارد سرور)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
    if (!blob || blob.size >= file.size) return file;
    const base = file.name.replace(/\.[^.]+$/, "") || "product";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  }
}

interface Props {
  value: string | null;
  onChange: (url: string | null) => void;
  /** گزارش آخرین آپلود موفق — برای نمایش چیپ‌های عملیات ایجنت. */
  onReport?: (report: ProductImageReportDTO | null) => void;
  label?: string;
  hint?: string;
  compact?: boolean;
  disabled?: boolean;
}

export default function ProductImageUploader({
  value,
  onChange,
  onReport,
  label = "تصویر محصول",
  hint = "JPG، PNG یا WebP — ایجنت هومینو خودکار مربع، بهینه و استانداردش می‌کند",
  compact = false,
  disabled = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const [pct, setPct] = useState(0);
  const [error, setError] = useState("");
  const [report, setReport] = useState<ProductImageReportDTO | null>(null);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlDraft, setUrlDraft] = useState("");

  async function handleFile(file: File) {
    setError("");
    if (!ALLOWED_TYPES.has(file.type)) {
      setError("فرمت عکس باید JPG، PNG یا WebP باشد");
      return;
    }
    if (file.size > MAX_RAW_BYTES) {
      setError(`حجم عکس خیلی زیاد است — حداکثر ${toFa(10)} مگابایت`);
      return;
    }
    setBusy(true);
    setPct(0);
    try {
      setStage("آماده‌سازی عکس…");
      const prepared = await preShrink(file);
      setStage(`در حال آپلود… ${toFa(0)}٪`);
      const res = await uploadProductImage(prepared, (p) => {
        setPct(p);
        setStage(`در حال آپلود… ${toFa(p)}٪`);
      });
      if (res.ok) {
        setReport(res.data.report);
        onReport?.(res.data.report);
        onChange(res.data.url);
      } else {
        setError(res.message || "آپلود ناموفق بود — دوباره تلاش کن");
      }
    } catch {
      setError("آپلود ناموفق بود — دوباره تلاش کن");
    } finally {
      setBusy(false);
      setStage("");
      setPct(0);
    }
  }

  function remove() {
    setReport(null);
    onReport?.(null);
    onChange(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const dropHandlers = disabled
    ? {}
    : {
        onDragOver: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(true);
        },
        onDragLeave: () => setDragging(false),
        onDrop: (e: React.DragEvent) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) void handleFile(file);
        },
      };

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink">{label}</label>

      {value ? (
        <div className="flex items-start gap-3 rounded-xl border border-clay/60 bg-ivory-2 p-3">
          <img src={value} alt="پیش‌نمایش تصویر محصول" className="h-20 w-20 shrink-0 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-medium text-success">
              <CheckCircle2 size={14} /> تصویر آماده است
            </p>
            {report && (
              <div className="mt-1.5 space-y-1.5">
                <p dir="ltr" className="text-left text-2xs leading-5 text-ink-muted">
                  {toFa(report.original.width)}×{toFa(report.original.height)} {report.original.format.toUpperCase()} →{" "}
                  {toFa(report.output.width)}×{toFa(report.output.height)} {report.output.format.toUpperCase()} ·{" "}
                  {fmtBytes(report.original.bytes)} → {fmtBytes(report.output.bytes)}
                </p>
                <div className="flex flex-wrap gap-1">
                  {report.actions.map((a) => (
                    <span key={a} className="rounded-full bg-cream px-2 py-0.5 text-2xs text-ink-muted">
                      {ACTION_LABEL[a] ?? a}
                    </span>
                  ))}
                </div>
                {report.warnings.length > 0 && (
                  <ul className="space-y-0.5">
                    {report.warnings.map((w) => (
                      <li key={w} className="flex items-start gap-1 text-2xs leading-5 text-ink">
                        <AlertTriangle size={12} className="mt-1 shrink-0 text-gold" /> {WARNING_LABEL[w] ?? w}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={disabled || busy}
                className="flex items-center gap-1 text-2xs text-danger transition hover:opacity-80 disabled:opacity-40"
              >
                <Trash2 size={12} /> حذف تصویر
              </button>
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled || busy}
                className="text-2xs text-ink-muted transition hover:text-ink disabled:opacity-40"
              >
                تعویض
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          {...dropHandlers}
          className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed bg-ivory-2 text-center transition disabled:opacity-60 ${
            compact ? "py-5" : "py-8"
          } ${dragging ? "border-ink bg-cream" : "border-clay/60 hover:border-ink"}`}
        >
          {busy ? (
            <>
              <Loader2 size={22} className="animate-spin text-ink-muted" />
              <span className="text-sm text-ink-muted">{stage}</span>
              <div className="h-1 w-40 overflow-hidden rounded-full bg-clay/40">
                <div
                  className="h-full rounded-full bg-ink transition-all"
                  style={{ width: `${stage.startsWith("آماده‌سازی") ? 30 : pct}%` }}
                />
              </div>
            </>
          ) : (
            <>
              <ImagePlus size={22} className="text-ink-muted" />
              <span className="text-sm text-ink-muted">عکس را بکش و رها کن، یا کلیک کن</span>
              <span className="max-w-xs text-2xs leading-5 text-ink-muted">{hint}</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs leading-6 text-danger">
          {error}
        </p>
      )}

      {!value && (
        <div className="mt-2">
          {showUrlInput ? (
            <div className="flex gap-2">
              <input
                dir="ltr"
                value={urlDraft}
                onChange={(e) => setUrlDraft(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink"
              />
              <button
                type="button"
                onClick={() => {
                  const url = urlDraft.trim();
                  if (!url) return;
                  setReport(null);
                  onReport?.(null);
                  onChange(url);
                  setShowUrlInput(false);
                }}
                disabled={disabled}
                className="shrink-0 rounded-xl border border-clay/60 px-3 text-xs text-ink transition hover:border-ink disabled:opacity-40"
              >
                تأیید
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowUrlInput(true)}
              disabled={disabled || busy}
              className="flex items-center gap-1 text-2xs text-ink-muted transition hover:text-ink disabled:opacity-40"
            >
              <Link2 size={12} /> یا درج آدرس تصویر (URL)
            </button>
          )}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        className="hidden"
        disabled={disabled || busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}

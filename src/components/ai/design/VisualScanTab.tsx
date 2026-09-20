"use client";
// ============================================================
// تب «اسکن بصری» — جریان کامل و مستقل (مالک ۲۰۲۶-۰۹-۲۰):
//   ① عکس کالا را آپلود کن → مدل‌های داخل سایت جست‌وجو و لیست می‌شوند
//   ② «بذارش توی خونم» → عکس خانه → محصول در عکس جای‌گذاری و عکس
//      درست می‌شود — همه‌چیز در همین بخش؛ هیچ پرشی به تب چیدمان نیست.
// ============================================================
import { useRef } from "react";
import Link from "next/link";
import {
  Upload, Search, Wand2, ShoppingCart, Eye, RotateCcw, ScanSearch,
  ShieldCheck, TriangleAlert, CheckCircle2,
} from "lucide-react";
import { cn, toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { useCart } from "@/stores/useShop";
import type { VisualScan } from "./useVisualScan";

function UploadBox({
  onFile, title, hint, busy,
}: { onFile: (f: File) => void; title: string; hint?: string; busy?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={title}
      onClick={() => !busy && inputRef.current?.click()}
      onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click(); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) onFile(f); }}
      className={cn(
        "mx-auto flex max-w-md cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 p-9 text-center transition hover:border-terracotta",
        busy && "pointer-events-none opacity-60",
      )}
    >
      <Upload size={30} className="mb-2 text-ink-muted" />
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint && <p className="mt-1 text-xs text-ink-muted">{hint}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={cn(
      "absolute right-1.5 top-1.5 rounded-full px-2 py-0.5 text-2xs font-bold text-white shadow-sm",
      score >= 80 ? "bg-emerald-700" : score >= 60 ? "bg-terracotta" : "bg-ink/80",
    )}>
      {toFa(score)}٪
    </span>
  );
}

export function VisualScanTab({ scan }: { scan: VisualScan }) {
  const { toast } = useUi();
  const addToCart = useCart((s) => s.add);
  const { step, phase, identified, visionAvailable, notice, matches, product, result, error } = scan;

  // ---------- مرحلهٔ ۲: بذارش توی خونم ----------
  if (step === "place" && product) {
    return (
      <div className="rounded-2xl border border-clay/50 bg-cream p-6">
        <h3 className="mb-1 text-base font-bold text-ink">بذارش توی خونم</h3>
        <p className="mb-4 text-sm leading-7 text-ink-muted">
          عکس خانه‌ات را آپلود کن تا «{product.name}» را در فضای تو قرار بدهیم و عکس را درست کنیم.
        </p>

        {/* محصول انتخاب‌شده */}
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-clay/40 bg-ivory-2 p-3.5">
          <img width={64} height={64} src={product.images[0]} alt={product.name} className="h-16 w-16 rounded-lg object-cover" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-ink">{product.name}</p>
            <p className="text-xs text-ink-muted">{product.brand} · {toFa(product.price)} {product.currency}</p>
          </div>
          <button onClick={scan.backToPick} className="flex items-center gap-1 rounded-lg border border-clay/50 px-3 py-2 text-xs font-bold text-ink transition hover:border-terracotta">
            <RotateCcw size={13} /> تغییر محصول
          </button>
        </div>

        {/* عکس خانه */}
        {!scan.scanRoomImage ? (
          <UploadBox onFile={scan.handleRoomFile} title="آپلود عکس خانه" hint="JPG، PNG — فضایی که می‌خواهی محصول در آن بنشیند" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="overflow-hidden rounded-xl border border-clay/40">
              <img width={1280} height={720} src={scan.scanRoomImage} alt="عکس خانه" className="aspect-video w-full object-cover" />
            </div>
            <div>
              {result ? (
                <div>
                  <div className="relative overflow-hidden rounded-xl border border-clay/40">
                    <img width={1280} height={720} src={result.image} alt="نتیجه جای‌گذاری" className="aspect-video w-full object-cover" />
                    {!result.real && (
                      <span className="absolute bottom-2 left-2 rounded-full bg-amber-500/95 px-2.5 py-1 text-2xs font-bold text-ink">
                        پیش‌نمایش ترکیب — رندر واقعی پس از وصل‌شدن موتور ویرایش
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => { addToCart(product.id); toast("به سبد اضافه شد"); }}
                      className="btn-accent flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold"
                    >
                      <ShoppingCart size={15} /> افزودن به سبد
                    </button>
                    <Link href={`/products/${product.slug}`} className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-clay/60 py-2.5 text-sm font-bold text-ink transition hover:border-terracotta">
                      <Eye size={15} /> مشاهدهٔ محصول
                    </Link>
                  </div>
                  <button onClick={scan.clearResult} className="mt-2 w-full rounded-lg py-2 text-xs font-bold text-ink-muted transition hover:text-terracotta">
                    جای‌گذاری دوباره روی همین عکس
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={scan.placeInRoom}
                    disabled={phase === "placing"}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-bold text-cream transition hover:bg-terracotta-deep disabled:opacity-40"
                  >
                    <Wand2 size={16} /> {phase === "placing" ? "در حال آماده‌سازی…" : "بذار توی خونم و عکس را درست کن"}
                  </button>
                  <button onClick={() => scan.setScanRoomImage(null)} className="mt-2 w-full py-2 text-xs font-bold text-ink-muted transition hover:text-terracotta">
                    تغییر عکس خانه
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">{error}</p>}
      </div>
    );
  }

  // ---------- مرحلهٔ ۱: اسکن و لیست محصولات سایت ----------
  return (
    <div className="rounded-2xl border border-clay/50 bg-cream p-6">
      <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-ink"><ScanSearch size={18} className="text-terracotta-deep" /> اسکن بصری</h3>
      <p className="mb-5 text-sm leading-7 text-ink-muted">
        عکس مدلی که دوست داری را آپلود کن — مدل‌های داخل سایت را می‌گردیم و نزدیک‌ترین‌ها را لیست می‌کنیم؛ بعد می‌توانی همان را در خانه‌ات جای‌گذاری کنی.
      </p>

      {!scan.scanImage ? (
        <UploadBox onFile={scan.handleScanFile} title="عکس مدل را آپلود کن" hint="مثلاً عکس یک مبل، فرش یا آباژور از هر جایی" />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className={cn("relative overflow-hidden rounded-xl border border-clay/40", phase === "scanning" && "animate-pulse border-terracotta/60")}>
              <img width={1280} height={720} src={scan.scanImage} alt="عکس مدل" className="aspect-video w-full object-cover" />
              {phase === "scanning" && (
                <span className="absolute inset-x-0 bottom-0 bg-ink/80 py-1.5 text-center text-2xs font-bold text-cream">
                  در حال گشتن در مدل‌های هومینو…
                </span>
              )}
            </div>
            <button onClick={() => scan.setScanImage(null)} className="mt-2 w-full py-2 text-xs font-bold text-ink-muted transition hover:text-terracotta">
              تغییر عکس مدل
            </button>
          </div>
          <div>
            {matches.length === 0 ? (
              <button
                onClick={scan.runScan}
                disabled={phase === "scanning"}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-bold text-cream transition hover:bg-terracotta-deep disabled:opacity-40"
              >
                <Search size={16} /> {phase === "scanning" ? "در حال جست‌وجو…" : "جست‌وجو در مدل‌های سایت"}
              </button>
            ) : (
              <div className="max-h-[26rem] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {/* کارت شناسایی */}
                {identified?.label && (
                  <div className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-ink">
                    <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                    <span>شناسایی شد: <b>{identified.label}</b></span>
                    {visionAvailable && <ShieldCheck size={13} className="mr-auto shrink-0 text-emerald-600" aria-label="تحلیل بینایی واقعی" />}
                  </div>
                )}
                {notice && (
                  <p className="mb-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-ink">
                    <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" /> {notice}
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2.5">
                  {matches.map((m) => (
                    <div key={m.id} className="overflow-hidden rounded-xl border border-clay/50 bg-ivory-2 transition hover:border-terracotta/60">
                      <div className="relative aspect-square">
                        <img src={m.image} alt={m.name} className="h-full w-full object-cover" loading="lazy" />
                        <ScoreBadge score={m.score} />
                      </div>
                      <div className="p-2">
                        <p className="line-clamp-1 text-xs font-bold text-ink">{m.name}</p>
                        <p className="mt-0.5 text-2xs text-ink-muted">{toFa(m.price)} {m.currency}</p>
                        <p className="mt-1 line-clamp-2 min-h-[2rem] text-2xs leading-4 text-ink-muted">{m.reason}</p>
                        <button
                          onClick={() => scan.chooseProduct(m)}
                          className="mt-1.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2 text-2xs font-bold text-cream transition hover:bg-terracotta-deep"
                        >
                          <Wand2 size={12} /> بذارش توی خونم
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-xs font-bold text-red-700">{error}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

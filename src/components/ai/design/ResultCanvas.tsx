"use client";
// ============================================================
// ستون «کانواس» هومینو استودیو — بازخورد مالک (نسخهٔ نهایی):
// • عکس و تحلیل و نتیجه، همه در یک قاب — کاربر هیچ‌وقت بین «ورودی»
//   و «خروجی» جابه‌جا نمی‌شود.
// • بعد از رندر: «عکس قدیمی خانه» روبروی «عکس طراحی‌شده» (دو قاب
//   کنار هم — خواستهٔ مستقیم مالک؛ اسلایدر کشیدنی حذف شد) یا
//   حالت تعاملی ProductOverlay با کلید تغییر حالت.
// • زیر آن ۲ تب جمع: «کالاها و خرید» / «جزئیات». جدول گزارش
//   ایجنت‌ها از نمای اصلی برداشته شد و فقط به‌صورت بخش جمع‌شوندهٔ
//   فنی داخل «جزئیات» در دسترس است. کلیک روی هر عکس → لایت‌باکس
//   تمام‌صفحه (بازخورد مالک: «روی عکس‌ها که می‌زنم بزرگ بشن»).
// همهٔ بلوک‌های قبلی (آنالیز اندازه، گزارش ایجنت‌ها، محدوده تغییر،
// تاریخچه/واگرد، عناصر انتخابی، کالاهای چیدمان، خرید این چیدمان،
// کالاهای هماهنگ فروشگاه‌ها) حفظ شده‌اند — چیزی حذف نشده.
// ============================================================
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Wand2, Download, Share2, AlertCircle, Lightbulb, Lock as LockIcon, Undo2, Redo2, Sparkles, ShoppingBag, Store, Check, CreditCard, Heart, Bot, Layers, PackageCheck, RefreshCw, MousePointer2, Maximize2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ProductOverlay } from "@/components/ProductOverlay";
import { getProductById } from "@/data/products";
import { toFa, formatPrice, cn } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";
import { ELEMENT_LABELS } from "@/services/ai/roomState";
import type { DesignStudio } from "./useDesignStudio";
import { GenerationProgress } from "./GenerationProgress";
import { RoomUploader } from "./RoomUploader";

const AGENT_STATUS_STYLE: Record<string, string> = {
  ok: "bg-success/10 text-success",
  empty: "bg-clay/20 text-ink-muted",
  skipped: "bg-clay/20 text-ink-muted",
  error: "bg-danger/10 text-danger",
};

type ResultTab = "shop" | "details";

export function ResultCanvas({ studio }: { studio: DesignStudio }) {
  const {
    placements, imageBase64, rs, loading, error, lastScope, designElements, placedProducts, total,
    matchedStoreProducts, updatePlacement, removePlacement, overlayCart, overlayWishlist, overlayView,
    toast, addToCart, setPlacements, buyTheLook, handleSaveToWishlist,
    compositeUrl, showComposite, setShowComposite, refreshComposite, studioPlans, studioReport, reportLoading,
  } = studio;

  const [resTab, setResTab] = useState<ResultTab>("shop");
  // لایت‌باکس: کدام عکس + توکنِ نتیجه — با هر رندر جدید توکن عوض می‌شود
  // و لایت‌باکسِ کهنه خودبه‌خود بسته می‌ماند (بدون اثرِ جانبی).
  const [zoom, setZoom] = useState<null | { which: "before" | "after"; token: string }>(null);
  const prevCount = useRef(0);
  // هر نتیجهٔ تازه → تب «کالاها و خرید» از اول باز شود.
  useEffect(() => {
    if (prevCount.current === 0 && placements.length > 0) setResTab("shop");
    prevCount.current = placements.length;
  }, [placements.length]);

  const showPair = Boolean(compositeUrl && showComposite) && placements.length > 0;
  const glowPlans = studioPlans.filter((p) => p.glow);
  const hasResult = placements.length > 0 && !loading && !error;
  const busy = loading || Boolean(error && !loading);

  const shopBadge = placedProducts.length + matchedStoreProducts.length;
  const detailsBadge = studioPlans.length + (lastScope ? 1 : 0);

  // توکن نتیجهٔ فعلی — لایت‌باکس فقط با همین توکن باز می‌ماند.
  const zoomToken = `${placements.length}|${showPair ? compositeUrl!.length : 0}`;
  const lightbox = zoom && zoom.token === zoomToken && !busy && hasResult && imageBase64 ? zoom : null;

  return (
    <div className="space-y-4 lg:col-span-7">
      {/* ================= کارت کانواس ================= */}
      <div className="rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-clay/30 pb-2.5">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink"><Wand2 size={17} className="text-terracotta-deep" /> {hasResult ? "نتیجه چیدمان" : "عکس و نتیجه"}</h3>
          {placements.length > 0 && (
            <div className="flex items-center gap-1.5">
              {compositeUrl && (
                <button
                  onClick={() => (showComposite ? setShowComposite(false) : refreshComposite())}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition", !showComposite ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted hover:text-ink")}
                  title={showComposite ? "جابه‌جایی دستی کالاها روی نتیجه" : "نمایش عکس قدیمی و جدید کنار هم"}
                >
                  {showComposite ? <><MousePointer2 size={13} /> ویرایش تعاملی</> : <><Layers size={13} /> مقایسهٔ قبل/بعد</>}
                </button>
              )}
              {!showComposite && compositeUrl && <button onClick={refreshComposite} className="grid h-8 w-8 place-items-center rounded-lg bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="به‌روزرسانی پیش‌نمایش ترکیب" title="به‌روزرسانی پیش‌نمایش ترکیب"><RefreshCw size={14} /></button>}
              <button onClick={() => toast("برای ذخیره، از صفحه نتیجه دکمه «دانلود» را بزن")} className="grid h-8 w-8 place-items-center rounded-lg bg-ivory-2 text-ink-muted hover:text-ink" aria-label="دانلود"><Download size={14} /></button>
              <button onClick={async () => { const res = await shareContent({ title: "طراحی هوشمند خانه من", text: "با Homeino طراحی کردم", url: buildShareUrl("/ai") }); toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا", res.method === "failed" ? "error" : "success"); }} className="grid h-8 w-8 place-items-center rounded-lg bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="اشتراک‌گذاری"><Share2 size={14} /></button>
            </div>
          )}
        </div>

        {/* ---- حین رندر / خطا: عکس همان‌جا + پیشرفت زیر آن ---- */}
        {busy && (
          <div className="space-y-3">
            {imageBase64 && (
              <div className="relative overflow-hidden rounded-2xl border border-clay/40 bg-ink">
                <img src={imageBase64} alt="عکس اتاق شما" className="aspect-video w-full object-cover opacity-80" />
              </div>
            )}
            <GenerationProgress studio={studio} />
          </div>
        )}

        {/* ---- قبل از رندر: عکس + تحلیل زنده (RoomUploader) ---- */}
        {!busy && !hasResult && (
          <>
            <RoomUploader studio={studio} />
            {!imageBase64 && (
              <p className="mt-3.5 flex flex-wrap items-center justify-center gap-1.5 rounded-xl bg-ivory-2/70 px-3 py-2.5 text-2xs leading-5 text-ink-muted">
                <b className="text-ink">۱</b> عکس را آپلود کن
                <span aria-hidden>←</span>
                <b className="text-ink">۲</b> سبک و وسایل را از ستون تنظیمات انتخاب کن
                <span aria-hidden>←</span>
                <b className="text-ink">۳</b> «طراحی کن» را بزن — نتیجه همین‌جا ظاهر می‌شود
              </p>
            )}
          </>
        )}

        {/* ---- بعد از رندر: عکس قدیمی روبروی نتیجهٔ طراحی (خواستهٔ مالک) یا حالت تعاملی ---- */}
        {!busy && hasResult && imageBase64 && (
          showPair ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="select-none">
              <BeforeAfterPair before={imageBase64} after={compositeUrl!} onZoom={(which) => setZoom({ which, token: zoomToken })} />
              <p className="mt-2 flex items-center justify-center gap-1.5 text-2xs text-ink-muted"><Layers size={12} /> نتیجهٔ طراحی روبروی عکس قدیمی خانه‌ات — با «ویرایش تعاملی» می‌توانی هر کالا را جابه‌جا کنی</p>
            </motion.div>
          ) : (
            <ProductOverlay mode={rs.currentImage && rs.currentImage !== imageBase64 ? "real_edit" : "interactive"} roomImage={rs.currentImage ?? imageBase64} placements={placements} onChange={updatePlacement} onRemove={removePlacement} onCart={overlayCart} onWishlist={overlayWishlist} onView={overlayView} />
          )
        )}
        {!busy && hasResult && placements.length > 0 && rs.currentImage === rs.originalImage && !compositeUrl && (
          <div className="mt-2.5 flex items-center justify-center gap-1.5 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-xs text-gold"><AlertCircle size={13} /> پیش‌نمایش — عکس اصلی حفظ شده</div>
        )}
      </div>

      {/* ================= ۲ تب جمع بعد از رندر ================= */}
      {!busy && hasResult && (
        <div className="rounded-2xl border border-clay/50 bg-cream shadow-[var(--shadow-soft)]">
          <div className="flex gap-1 border-b border-clay/30 p-1.5">
            {([
              ["shop", "کالاها و خرید", ShoppingBag, shopBadge],
              ["details", "جزئیات", Layers, detailsBadge],
            ] as const).map(([id, label, Icon, badge]) => (
              <button key={id} onClick={() => setResTab(id)} aria-current={resTab === id} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition sm:text-sm", resTab === id ? "bg-ink text-cream" : "text-ink-muted hover:text-ink")}>
                <Icon size={15} /> {label}
                {badge > 0 && <span className={cn("rounded-full px-1.5 py-0.5 text-2xs font-black", resTab === id ? "bg-cream text-ink" : "bg-terracotta text-white")}>{toFa(badge)}</span>}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={resTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.22, ease: "easeOut" }} className="p-3.5 sm:p-4">

              {/* ---------- تب ۱: کالاها و خرید ---------- */}
              {resTab === "shop" && (
                <div className="space-y-4">
                  {studioReport && studioReport.stockWarnings.length > 0 && (
                    <div className="space-y-1 rounded-lg border border-warning/25 bg-warning/5 p-2.5">
                      {studioReport.stockWarnings.map((w, i) => <p key={i} className="flex items-start gap-1.5 text-xs text-warning"><AlertCircle size={13} className="mt-0.5 shrink-0" /> {w}</p>)}
                    </div>
                  )}
                  {placedProducts.length > 0 ? (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><ShoppingBag size={15} className="text-terracotta-deep" /> کالاهای چیدمان ({toFa(placedProducts.length)})</h3>
                      <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{placedProducts.map((p) => (<div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-clay/30 bg-ivory-2 p-2.5"><img src={p.images[0]} alt="" className="h-12 w-12 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-1 text-xs font-bold text-ink">{p.name}</p><p className="flex items-center gap-1 text-xs text-ink-muted"><Store size={11} /> {p.brand}</p></div><span className="text-xs font-black text-gold">{toFa(formatPrice(p.price))}</span></div>))}</div>
                      <div className="mt-3 flex items-center justify-between border-t border-clay/30 pt-2.5"><span className="text-sm font-bold text-ink">جمع کل:</span><span className="text-base font-black text-terracotta-deep">{toFa(formatPrice(total))} ت</span></div>
                      <div className="mt-3 space-y-2">
                        <button onClick={buyTheLook} className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold"><CreditCard size={16} /> خرید این چیدمان ({toFa(placedProducts.length)} کالا)</button>
                        <button onClick={handleSaveToWishlist} className="flex w-full items-center justify-center gap-2 rounded-lg border border-clay/50 bg-ivory-2 py-3 text-sm font-bold text-ink transition hover:bg-clay/20"><Heart size={15} /> ذخیره در علاقه‌مندی</button>
                      </div>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-ivory-2 p-3 text-xs leading-5 text-ink-muted">برای این طرح کالای مشخصی انتخاب نشده — از ستون تنظیمات بخش «وسایل» چند گروه تیک بزن تا کالاهای همین چیدمان اینجا با قیمت جمع شود.</p>
                  )}

                  {matchedStoreProducts.length > 0 && (
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
                          <Store size={15} className="text-terracotta-deep" />
                          کالاهای هماهنگ از فروشگاه‌ها ({toFa(matchedStoreProducts.length)})
                        </h3>
                        <span className="text-xs text-ink-muted">تطابق هوشمند کاتالوگ</span>
                      </div>
                      <div className="grid max-h-72 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
                        {matchedStoreProducts.map((item) => (
                          <div key={item.productId} className="flex flex-col justify-between rounded-lg border border-clay/30 bg-ivory-2 p-3">
                            <div className="flex items-start gap-2.5">
                              <img src={item.image} alt={item.name} className="h-14 w-14 shrink-0 rounded-md object-cover" />
                              <div className="min-w-0 flex-1">
                                <Link href={item.productUrl} className="line-clamp-1 text-xs font-bold text-ink hover:text-terracotta-deep">
                                  {item.name}
                                </Link>
                                <p className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                                  <Store size={11} />
                                  <span>{item.storeName}</span>
                                  {item.storeVerified && <Check size={11} className="text-success" />}
                                </p>
                                {item.sku && <p className="font-mono text-2xs text-ink-muted">SKU: {item.sku}</p>}
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between border-t border-clay/20 pt-2">
                              <span className="text-xs font-black text-gold">{toFa(formatPrice(item.price))} ت</span>
                              <div className="flex gap-1.5">
                                <button
                                  onClick={() => { addToCart(item.productId); toast("به سبد اضافه شد"); }}
                                  className="rounded bg-terracotta/10 px-2.5 py-1 text-xs font-bold text-terracotta-deep transition hover:bg-terracotta hover:text-white"
                                >
                                  افزودن
                                </button>
                                <Link
                                  href={item.productUrl}
                                  className="rounded border border-clay/50 bg-cream px-2.5 py-1 text-xs font-medium text-ink transition hover:bg-ivory"
                                >
                                  مشاهده
                                </Link>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ---------- تب ۲: جزئیات ---------- */}
              {resTab === "details" && (
                <div className="space-y-3">
                  {rs.history.length > 1 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-clay/40 bg-ivory-2 px-3 py-2">
                      <div className="flex items-center gap-1">
                        <button onClick={() => { rs.undo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canUndo()} className="grid h-8 w-8 place-items-center rounded-md bg-cream text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="بازگشت"><Undo2 size={14} /></button>
                        <button onClick={() => { rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canRedo()} className="grid h-8 w-8 place-items-center rounded-md bg-cream text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="جلو"><Redo2 size={14} /></button>
                        <span className="mr-1 text-xs text-ink-muted">{toFa(rs.historyIndex + 1)}/{toFa(rs.history.length)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">{rs.history.map((snap, idx) => <button key={snap.version} onClick={() => { const steps = idx - rs.historyIndex; if (steps < 0) for (let s = 0; s < -steps; s++) rs.undo(); else for (let s = 0; s < steps; s++) rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} className={cn("rounded px-2 py-1 text-xs font-bold transition", idx === rs.historyIndex ? "bg-ink text-cream" : "bg-cream text-ink-muted hover:text-ink")}>{snap.label}</button>)}</div>
                    </div>
                  )}

                  {designElements.length > 0 ? (
                    <div>
                      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><Sparkles size={14} className="text-terracotta-deep" /> عناصر انتخابی</h3>
                      <div className="flex flex-wrap gap-1.5">{designElements.map((e, i) => <span key={i} className="rounded-full border border-clay/40 bg-ivory-2 px-2.5 py-1 text-xs font-medium text-ink-muted">{e.cat} · {e.label}</span>)}</div>
                    </div>
                  ) : (
                    <p className="flex items-start gap-1.5 rounded-lg bg-ivory-2 p-3 text-xs leading-5 text-ink-muted"><Sparkles size={13} className="mt-0.5 shrink-0 text-terracotta-deep" /> این طرح با «چیدمان پیش‌فرض هومینو» ساخته شده — اگر بخواهی وسایل خاص خودت را بگذاری، از ستون تنظیمات بخش «وسایل» انتخاب کن و دوباره طراحی کن.</p>
                  )}

                  {placements.length > 0 && (
                    <p className="text-xs leading-5 text-ink-muted">تعداد کالای رندرشده در عکس: <b className="text-ink">{toFa(placements.length)}</b> — با «حالت تعاملی» می‌توانی هر کدام را جابه‌جا، بزرگ یا حذف کنی.</p>
                  )}

                  {/* ---- آنالیز اندازه و جای‌گذاری (از تب گزارش سابق) ---- */}
                  {studioPlans.length > 0 && (
                    <div className="rounded-xl border border-sage/30 bg-sage/5 p-3">
                      <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><PackageCheck size={14} className="text-terracotta-deep" /> آنالیز اندازه و جای‌گذاری</div>
                      <ul className="space-y-1">
                        {studioPlans.slice(0, 6).map((p) => (
                          <li key={p.productId} className="flex items-start gap-1.5 text-xs leading-5 text-ink-muted"><Check size={12} className="mt-0.5 shrink-0 text-success" /><span>{p.sizeReport}</span></li>
                        ))}
                      </ul>
                      {glowPlans.length > 0 && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-gold"><Lightbulb size={13} className="mt-0.5 shrink-0" /> نورپردازی محصولات، مطابق توضیحات هر محصول با شکل آن نمایش داده شده است.</p>
                      )}
                    </div>
                  )}

                  {/* ---- محدوده تغییر ---- */}
                  {lastScope && (
                    <div className="rounded-xl border border-gold/25 bg-gold/5 p-3.5">
                      <div className="flex items-center gap-1.5 text-xs font-bold text-gold"><Lightbulb size={14} /> محدوده تغییر</div>
                      <p className="mt-1 text-xs leading-6 text-ink-muted">{lastScope.summary}</p>
                      {lastScope.lockedElements.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{lastScope.lockedElements.slice(0, 6).map((el) => <span key={el} className="flex items-center gap-1 rounded bg-ivory-2 px-1.5 py-0.5 text-2xs text-ink-muted"><LockIcon size={10} /> {ELEMENT_LABELS[el as keyof typeof ELEMENT_LABELS] ?? el}</span>)}</div>}
                    </div>
                  )}

                  {/* ---- پیشنهاد مکمل ---- */}
                  {studioReport && studioReport.complements.length > 0 && (
                    <div className="border-t border-clay/20 pt-2.5">
                      <p className="mb-1.5 text-xs font-bold text-terracotta-deep">پیشنهاد مکمل ایجنت‌ها:</p>
                      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                        {studioReport.complements.slice(0, 6).map((c) => {
                          const real = getProductById(c.id);
                          const href = real ? `/products/${real.slug}` : (c.url ?? "/products");
                          return (
                            <Link key={c.id} href={href} className="flex items-center gap-2 rounded-lg border border-clay/30 bg-ivory-2 p-1.5 transition hover:border-terracotta/50">
                              {(real?.images[0] ?? c.image) && <img src={real?.images[0] ?? c.image} alt="" className="h-9 w-9 rounded-md object-cover" />}
                              <span className="min-w-0 flex-1">
                                <span className="line-clamp-1 block text-2xs font-bold text-ink">{real?.name ?? c.name ?? "محصول"}</span>
                                {typeof (real?.price ?? c.price) === "number" && <span className="block text-2xs font-black text-terracotta-deep">{toFa(formatPrice(real?.price ?? c.price!))} ت</span>}
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* ---- گزارش فنی ایجنت‌ها: از نمای اصلی برداشته شد؛ فقط جمع‌شونده فنی ---- */}
                  {(studioReport || reportLoading) && (
                    <details className="overflow-hidden rounded-xl border border-clay/40 bg-ivory-2/60">
                      <summary className="flex cursor-pointer list-none select-none items-center justify-between gap-2 px-3 py-2.5 text-xs font-bold text-ink transition hover:text-terracotta-deep [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2"><Bot size={15} className="text-terracotta-deep" /> گزارش فنی ایجنت‌ها{studioReport && <span className="rounded-full bg-terracotta px-1.5 py-0.5 text-2xs font-black text-white">{toFa(studioReport.agents.length)}</span>}</span>
                        <span className="text-2xs font-normal text-ink-muted">برای دیدن باز کن</span>
                      </summary>
                      <div className="space-y-2 border-t border-clay/30 px-3 py-3">
                        {reportLoading && !studioReport && <p className="flex items-center gap-2 text-xs text-ink-muted"><RefreshCw size={13} className="animate-spin" /> ایجنت‌ها در حال بررسی طرح...</p>}
                        {studioReport && (
                          <>
                            <p className="text-sm leading-6 text-ink">{studioReport.summary}</p>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              {studioReport.agents.map((a) => (
                                <div key={a.key} className="rounded-lg border border-clay/30 bg-cream p-2.5">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-ink">{a.name}</span>
                                    <span className={cn("rounded px-1.5 py-0.5 text-2xs font-bold", AGENT_STATUS_STYLE[a.status] ?? "bg-clay/20 text-ink-muted")}>
                                      {a.status === "ok" ? "انجام شد" : a.status === "error" ? "خطا" : a.status === "skipped" ? "غیرفعال" : "بدون نتیجه"}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-xs leading-5 text-ink-muted">{a.note}</p>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                    </details>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* ================= لایت‌باکس بزرگ‌نمایی عکس ================= */}
      <AnimatePresence>
        {lightbox && (
          <ImageLightbox
            before={imageBase64!}
            after={compositeUrl ?? rs.currentImage ?? imageBase64!}
            initial={lightbox.which}
            onClose={() => setZoom(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ============================================================
// مقایسهٔ کنارهم: «عکس قدیمی خانه» روبروی «عکس طراحی‌شده» —
// بازخورد مستقیم مالک: «عکس تغییر کرده روبروی عکس خانهٔ قدیمی
// باشه بهتره». RTL: قاب اول (راست) = قبل، قاب دوم (چپ) = بعد؛
// در موبایل دو قاب زیر هم می‌آیند. کلیک روی هر قاب → لایت‌باکس.
// ============================================================
function BeforeAfterPair({ before, after, onZoom }: { before: string; after: string; onZoom: (which: "before" | "after") => void }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => onZoom("before")}
        aria-label="بزرگ‌نمایی عکس قدیمی خانه"
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border border-clay/40 bg-ink text-right transition hover:border-clay/70 focus-visible:ring-2 focus-visible:ring-terracotta/60 focus-visible:outline-none"
      >
        <img src={before} alt="عکس قدیمی خانه شما" className="block w-full" draggable={false} />
        <span className="absolute right-2.5 top-2.5 rounded-md bg-ink/65 px-2 py-1 text-2xs font-bold text-cream backdrop-blur">قبل · عکس تو</span>
        <span className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition group-hover:bg-ink/35 group-hover:opacity-100" aria-hidden><Maximize2 size={22} className="text-cream drop-shadow" /></span>
      </button>
      <button
        type="button"
        onClick={() => onZoom("after")}
        aria-label="بزرگ‌نمایی نتیجهٔ طراحی"
        className="group relative block w-full cursor-zoom-in overflow-hidden rounded-2xl border-2 border-terracotta/60 bg-ink text-right shadow-[var(--shadow-soft)] transition hover:border-terracotta focus-visible:ring-2 focus-visible:ring-terracotta/60 focus-visible:outline-none"
      >
        <img src={after} alt="نتیجهٔ طراحی هومینو استودیو" className="block w-full" draggable={false} />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-terracotta-deep/90 px-2 py-1 text-2xs font-bold text-cream backdrop-blur">بعد · طراحی هومینو</span>
        <span className="absolute inset-0 grid place-items-center bg-ink/0 opacity-0 transition group-hover:bg-ink/35 group-hover:opacity-100" aria-hidden><Maximize2 size={22} className="text-cream drop-shadow" /></span>
      </button>
    </div>
  );
}

// ============================================================
// لایت‌باکس بزرگ‌نمایی — کلیک روی عکس‌های قبل/بعد → تمام‌صفحه.
// بستن با کلیک بیرون، دکمه × یا Esc؛ جابه‌جایی بین قبل/بعد با
// چیپ‌ها یا فلش‌های کیبورد (راست = قبل، چپ = بعد — هم‌جهت با RTL).
// ============================================================
function ImageLightbox({ before, after, initial, onClose }: { before: string; after: string; initial: "before" | "after"; onClose: () => void }) {
  const [which, setWhich] = useState<"before" | "after">(initial);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setWhich("after");
      if (e.key === "ArrowRight") setWhich("before");
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const src = which === "before" ? before : after;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="نمایش بزرگ عکس"
      className="fixed inset-0 z-[115] flex flex-col items-center justify-center gap-3 bg-ink/85 p-4 backdrop-blur-md sm:p-8"
    >
      <button type="button" onClick={onClose} className="absolute left-4 top-4 grid h-10 w-10 place-items-center rounded-full bg-cream/10 text-cream transition hover:bg-cream/20" aria-label="بستن"><X size={20} /></button>
      <motion.img
        key={src}
        src={src}
        alt={which === "before" ? "عکس قدیمی خانه شما — بزرگ" : "نتیجهٔ طراحی هومینو استودیو — بزرگ"}
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
        className="max-h-[76vh] w-auto max-w-full rounded-2xl border border-cream/15 object-contain shadow-2xl"
      />
      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
        {([["before", "قبل · عکس تو"], ["after", "بعد · طراحی هومینو"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setWhich(id)}
            aria-current={which === id}
            className={cn("rounded-full px-3.5 py-1.5 text-xs font-bold transition", which === id ? "bg-cream text-ink" : "bg-cream/10 text-cream/80 hover:text-cream")}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-2xs text-cream/60">برای بستن کلیک کن یا Esc بزن — با فلش‌های چپ و راست بین قبل و بعد جابه‌جا شو</p>
    </motion.div>
  );
}

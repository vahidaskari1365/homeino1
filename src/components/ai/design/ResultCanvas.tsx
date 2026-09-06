"use client";
// ستون نتیجه هومینو استودیو — پیش‌نمایش ترکیب (محصولات جایگزین‌شده در عکس)،
// حالت تعاملی، تحلیل اندازه‌ها، گزارش ایجنت‌ها، محدوده تغییر، تاریخچه،
// کالاهای چیدمان و تطبیق فروشگاه‌ها.
import Link from "next/link";
import { Wand2, Download, Share2, AlertCircle, Lightbulb, Lock as LockIcon, Undo2, Redo2, Sparkles, ShoppingBag, Store, Check, CreditCard, Heart, Bot, Layers, PackageCheck, RefreshCw, MousePointer2 } from "lucide-react";
import { ProductOverlay } from "@/components/ProductOverlay";
import { getProductById } from "@/data/products";
import { toFa, formatPrice, cn } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";
import type { DesignStudio } from "./useDesignStudio";

const AGENT_STATUS_STYLE: Record<string, string> = {
  ok: "bg-success/10 text-success",
  empty: "bg-clay/20 text-ink-muted",
  skipped: "bg-clay/20 text-ink-muted",
  error: "bg-danger/10 text-danger",
};

export function ResultCanvas({ studio }: { studio: DesignStudio }) {
  const {
    placements, imageBase64, rs, loading, lastScope, designElements, placedProducts, total,
    matchedStoreProducts, updatePlacement, removePlacement, overlayCart, overlayWishlist, overlayView,
    toast, addToCart, setPlacements, buyTheLook, handleSaveToWishlist,
    compositeUrl, showComposite, setShowComposite, refreshComposite, studioPlans, studioReport, reportLoading,
  } = studio;

  const canComposite = Boolean(compositeUrl && showComposite && placements.length > 0);
  const glowPlans = studioPlans.filter((p) => p.glow);

  return (
    <div className="space-y-4 lg:col-span-7">
      <div className="rounded-2xl border border-clay/50 bg-cream p-5 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-clay/30 pb-2.5">
          <h3 className="flex items-center gap-2 text-base font-bold text-ink"><Wand2 size={17} className="text-terracotta-deep" /> خروجی چیدمان</h3>
          {placements.length > 0 && (
            <div className="flex items-center gap-1.5">
              {compositeUrl && (
                <button
                  onClick={() => setShowComposite(!canComposite)}
                  className={cn("flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold transition", canComposite ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted hover:text-ink")}
                  title={canComposite ? "رفتن به حالت تعاملی برای جابه‌جایی دستی" : "نمایش پیش‌نمایش ترکیب"}
                >
                  {canComposite ? <><MousePointer2 size={13} /> حالت تعاملی</> : <><Layers size={13} /> پیش‌نمایش ترکیب</>}
                </button>
              )}
              {canComposite && <button onClick={refreshComposite} className="grid h-8 w-8 place-items-center rounded-lg bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="به‌روزرسانی پیش‌نمایش ترکیب" title="به‌روزرسانی پیش‌نمایش ترکیب"><RefreshCw size={14} /></button>}
              <button onClick={() => toast("برای ذخیره، از دکمه اشتراک‌گذاری استفاده کن")} className="grid h-8 w-8 place-items-center rounded-lg bg-ivory-2 text-ink-muted hover:text-ink" aria-label="دانلود"><Download size={14} /></button>
              <button onClick={async () => { const res = await shareContent({ title: "طراحی هوشمند خانه من", text: "با Homeino طراحی کردم", url: buildShareUrl("/ai") }); toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا", res.method === "failed" ? "error" : "success"); }} className="grid h-8 w-8 place-items-center rounded-lg bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="اشتراک‌گذاری"><Share2 size={14} /></button>
            </div>
          )}
        </div>
        {placements.length > 0 && imageBase64 ? (
          canComposite ? (
            <div className="relative w-full select-none overflow-hidden rounded-2xl border border-clay/40 bg-ink">
              <img src={compositeUrl!} alt="پیش‌نمایش ترکیب محصولات در عکس اتاق شما" className="w-full" />
              <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-gold/20 px-2.5 py-1 text-xs font-medium text-gold-soft backdrop-blur">
                پیش‌نمایش ترکیب — محصولات انتخابی در عکس شما جایگزین شدند
              </div>
            </div>
          ) : (
            <ProductOverlay mode={rs.currentImage && rs.currentImage !== imageBase64 ? "real_edit" : "interactive"} roomImage={rs.currentImage ?? imageBase64} placements={placements} onChange={updatePlacement} onRemove={removePlacement} onCart={overlayCart} onWishlist={overlayWishlist} onView={overlayView} />
          )
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-clay/50 bg-ivory-2"><div className="p-6 text-center"><Wand2 size={30} className="mx-auto mb-2 text-clay" /><p className="text-sm font-medium text-ink-muted">نتیجه اینجا نمایش داده می‌شه</p></div></div>
        )}

        {/* اندازه‌ها آنالیز شد — گزارش شفاف برای هر محصول */}
        {studioPlans.length > 0 && (
          <div className="mt-3 rounded-xl border border-sage/30 bg-sage/5 p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><PackageCheck size={14} className="text-terracotta-deep" /> آنالیز اندازه و جای‌گذاری</div>
            <ul className="space-y-1">
              {studioPlans.slice(0, 6).map((p) => (
                <li key={p.productId} className="flex items-start gap-1.5 text-xs leading-5 text-ink-muted"><Check size={12} className="mt-0.5 shrink-0 text-success" /><span>{p.sizeReport}</span></li>
              ))}
            </ul>
            {glowPlans.length > 0 && (
              <p className="mt-1.5 flex items-start gap-1.5 text-xs leading-5 text-gold"><Lightbulb size={13} className="mt-0.5 shrink-0" /> نور محصولات روشنایی، مطابق توضیحات هر محصول با شکل آن نمایش داده شده است.</p>
            )}
          </div>
        )}
      </div>

      {/* گزارش ایجنت‌های هومینو استودیو */}
      {(studioReport || reportLoading) && (
        <div className="rounded-xl border border-clay/50 bg-cream p-4">
          <h3 className="mb-2.5 flex items-center gap-2 border-b border-clay/30 pb-2 text-sm font-bold text-ink"><Bot size={16} className="text-terracotta-deep" /> گزارش ایجنت‌های هومینو استودیو</h3>
          {reportLoading && !studioReport && <p className="flex items-center gap-2 text-xs text-ink-muted"><RefreshCw size={13} className="animate-spin" /> ایجنت‌ها در حال بررسی طرح...</p>}
          {studioReport && (
            <>
              <p className="mb-2.5 text-sm leading-6 text-ink">{studioReport.summary}</p>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {studioReport.agents.map((a) => (
                  <div key={a.key} className="rounded-lg border border-clay/30 bg-ivory-2 p-2.5">
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
              {studioReport.stockWarnings.length > 0 && (
                <div className="mt-2 space-y-1">
                  {studioReport.stockWarnings.map((w, i) => <p key={i} className="flex items-start gap-1.5 text-xs text-warning"><AlertCircle size={13} className="mt-0.5 shrink-0" /> {w}</p>)}
                </div>
              )}
              {studioReport.complements.length > 0 && (
                <div className="mt-3 border-t border-clay/20 pt-2.5">
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
            </>
          )}
        </div>
      )}

      {lastScope && !loading && (
        <div className="rounded-xl border border-gold/25 bg-gold/5 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-bold text-gold"><Lightbulb size={14} /> محدوده تغییر</div>
          <p className="mt-1 text-xs leading-6 text-ink-muted">{lastScope.summary}</p>
          {lastScope.lockedElements.length > 0 && <div className="mt-1.5 flex flex-wrap gap-1">{lastScope.lockedElements.slice(0, 6).map((el) => <span key={el} className="flex items-center gap-1 rounded bg-ivory-2 px-1.5 py-0.5 text-2xs text-ink-muted"><LockIcon size={10} /> {el}</span>)}</div>}
        </div>
      )}

      {rs.history.length > 1 && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-clay/50 bg-cream px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={() => { rs.undo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canUndo()} className="grid h-8 w-8 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="بازگشت"><Undo2 size={14} /></button>
            <button onClick={() => { rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canRedo()} className="grid h-8 w-8 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="جلو"><Redo2 size={14} /></button>
            <span className="mr-1 text-xs text-ink-muted">{toFa(rs.historyIndex + 1)}/{toFa(rs.history.length)}</span>
          </div>
          <div className="flex gap-1">{rs.history.map((snap, idx) => <button key={snap.version} onClick={() => { const steps = idx - rs.historyIndex; if (steps < 0) for (let s = 0; s < -steps; s++) rs.undo(); else for (let s = 0; s < steps; s++) rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} className={cn("rounded px-2 py-1 text-xs font-bold transition", idx === rs.historyIndex ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted hover:text-ink")}>{snap.label}</button>)}</div>
        </div>
      )}

      {placements.length > 0 && rs.currentImage === rs.originalImage && !canComposite && (
        <div className="flex items-center justify-center gap-1.5 rounded-lg border border-gold/25 bg-gold/5 px-3 py-2 text-xs text-gold"><AlertCircle size={13} /> پیش‌نمایش — عکس اصلی حفظ شده</div>
      )}

      {designElements.length > 0 && (
        <div className="rounded-xl border border-clay/50 bg-cream p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-ink"><Sparkles size={14} className="text-terracotta-deep" /> عناصر انتخابی</h3>
          <div className="flex flex-wrap gap-1.5">{designElements.map((e, i) => <span key={i} className="rounded-full border border-clay/40 bg-ivory-2 px-2.5 py-1 text-xs font-medium text-ink-muted">{e.cat} · {e.label}</span>)}</div>
        </div>
      )}

      {placedProducts.length > 0 && (
        <div className="rounded-xl border border-clay/50 bg-cream p-5">
          <h3 className="mb-2.5 flex items-center gap-2 border-b border-clay/30 pb-2.5 text-sm font-bold text-ink"><ShoppingBag size={15} className="text-terracotta-deep" /> کالاهای چیدمان ({toFa(placedProducts.length)})</h3>
          <div className="grid max-h-56 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{placedProducts.map((p) => (<div key={p.id} className="flex items-center gap-2.5 rounded-lg border border-clay/30 bg-ivory-2 p-2.5"><img src={p.images[0]} alt="" className="h-12 w-12 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-1 text-xs font-bold text-ink">{p.name}</p><p className="flex items-center gap-1 text-xs text-ink-muted"><Store size={11} /> {p.brand}</p></div><span className="text-xs font-black text-gold">{toFa(formatPrice(p.price))}</span></div>))}</div>
          <div className="mt-3 flex items-center justify-between border-t border-clay/30 pt-2.5"><span className="text-sm font-bold text-ink">جمع کل:</span><span className="text-base font-black text-terracotta-deep">{toFa(formatPrice(total))} ت</span></div>
          <div className="mt-3 space-y-2">
            <button onClick={buyTheLook} className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold"><CreditCard size={16} /> خرید این چیدمان ({toFa(placedProducts.length)} کالا)</button>
            <button onClick={handleSaveToWishlist} className="flex w-full items-center justify-center gap-2 rounded-lg border border-clay/50 bg-ivory-2 py-3 text-sm font-bold text-ink transition hover:bg-clay/20"><Heart size={15} /> ذخیره در علاقه‌مندی</button>
          </div>
        </div>
      )}

      {/* Matched Real Store Products */}
      {matchedStoreProducts.length > 0 && (
        <div className="rounded-xl border border-clay/50 bg-cream p-5">
          <div className="mb-3 flex items-center justify-between border-b border-clay/30 pb-2.5">
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
  );
}

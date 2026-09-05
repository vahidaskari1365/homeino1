"use client";
// ستون نتیجه — خروجی چیدمان، محدوده تغییر، تاریخچه، کالاهای چیدمان و
// تطبیق فروشگاه‌ها (JSX و کلاس‌ها عیناً از /ai/design منتقل شد).
import Link from "next/link";
import { Wand2, Download, Share2, AlertCircle, Lightbulb, Lock as LockIcon, Undo2, Redo2, Sparkles, ShoppingBag, Store, Check, CreditCard, Heart } from "lucide-react";
import { ProductOverlay } from "@/components/ProductOverlay";
import { getProductById } from "@/data/products";
import { toFa, formatPrice, cn } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";
import type { DesignStudio } from "./useDesignStudio";

export function ResultCanvas({ studio }: { studio: DesignStudio }) {
  const {
    placements, imageBase64, rs, loading, lastScope, designElements, placedProducts, total,
    matchedStoreProducts, updatePlacement, removePlacement, overlayCart, overlayWishlist, overlayView,
    toast, addToCart, setPlacements, buyTheLook, handleSaveToWishlist,
  } = studio;
  return (
    <div className="space-y-3 lg:col-span-7">
      <div className="rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)]">
        <div className="mb-3 flex items-center justify-between border-b border-clay/30 pb-2">
          <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink"><Wand2 size={14} className="text-terracotta-deep" /> خروجی چیدمان</h3>
          {placements.length > 0 && <div className="flex gap-1"><button onClick={() => toast("ذخیره شد")} className="grid h-7 w-7 place-items-center rounded-md bg-ivory-2 text-ink-muted hover:text-ink" aria-label="دانلود"><Download size={12} /></button><button onClick={async () => { const res = await shareContent({ title: "طراحی هوشمند خانه من", text: "با Homeino طراحی کردم", url: buildShareUrl("/ai") }); toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا", res.method === "failed" ? "error" : "success"); }} className="grid h-9 w-9 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="اشتراک‌گذاری"><Share2 size={13} /></button></div>}
        </div>
        {placements.length > 0 && imageBase64 ? (
          <ProductOverlay mode={rs.currentImage && rs.currentImage !== imageBase64 ? "real_edit" : "interactive"} roomImage={rs.currentImage ?? imageBase64} placements={placements} onChange={updatePlacement} onRemove={removePlacement} onCart={overlayCart} onWishlist={overlayWishlist} onView={overlayView} />
        ) : (
          <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-clay/50 bg-ivory-2"><div className="p-6 text-center"><Wand2 size={28} className="mx-auto mb-2 text-clay" /><p className="text-xs font-medium text-ink-muted">نتیجه اینجا نمایش داده می‌شه</p></div></div>
        )}
      </div>

      {lastScope && !loading && (
        <div className="rounded-xl border border-gold/25 bg-gold/5 p-3">
          <div className="flex items-center gap-1 text-[10px] font-bold text-gold"><Lightbulb size={12} /> محدوده تغییر</div>
          <p className="mt-0.5 text-[10px] leading-5 text-ink-muted">{lastScope.summary}</p>
          {lastScope.lockedElements.length > 0 && <div className="mt-1 flex flex-wrap gap-0.5">{lastScope.lockedElements.slice(0, 6).map((el) => <span key={el} className="flex items-center gap-0.5 rounded bg-ivory-2 px-1 py-0.5 text-[8px] text-ink-muted"><LockIcon size={8} /> {el}</span>)}</div>}
        </div>
      )}

      {rs.history.length > 1 && !loading && (
        <div className="flex items-center justify-between rounded-xl border border-clay/50 bg-cream px-3 py-2">
          <div className="flex items-center gap-1">
            <button onClick={() => { rs.undo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canUndo()} className="grid h-7 w-7 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="بازگشت"><Undo2 size={13} /></button>
            <button onClick={() => { rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canRedo()} className="grid h-7 w-7 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="جلو"><Redo2 size={13} /></button>
            <span className="mr-1 text-[10px] text-ink-muted">{toFa(rs.historyIndex + 1)}/{toFa(rs.history.length)}</span>
          </div>
          <div className="flex gap-1">{rs.history.map((snap, idx) => <button key={snap.version} onClick={() => { const steps = idx - rs.historyIndex; if (steps < 0) for (let s = 0; s < -steps; s++) rs.undo(); else for (let s = 0; s < steps; s++) rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold transition", idx === rs.historyIndex ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted hover:text-ink")}>{snap.label}</button>)}</div>
        </div>
      )}

      {placements.length > 0 && rs.currentImage === rs.originalImage && (
        <div className="flex items-center justify-center gap-1 rounded-lg border border-gold/25 bg-gold/5 px-3 py-1.5 text-[10px] text-gold"><AlertCircle size={11} /> پیش‌نمایش — تصویر اصلی حفظ شده</div>
      )}

      {designElements.length > 0 && (
        <div className="rounded-xl border border-clay/50 bg-cream p-3">
          <h3 className="mb-2 flex items-center gap-1 text-[11px] font-bold text-ink"><Sparkles size={12} className="text-terracotta-deep" /> عناصر انتخابی</h3>
          <div className="flex flex-wrap gap-1">{designElements.map((e, i) => <span key={i} className="rounded-full border border-clay/40 bg-ivory-2 px-2 py-0.5 text-[9px] font-medium text-ink-muted">{e.cat} · {e.label}</span>)}</div>
        </div>
      )}

      {placedProducts.length > 0 && (
        <div className="rounded-xl border border-clay/50 bg-cream p-4">
          <h3 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-[11px] font-bold text-ink"><ShoppingBag size={13} className="text-terracotta-deep" /> کالاهای چیدمان ({toFa(placedProducts.length)})</h3>
          <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">{placedProducts.map((p) => (<div key={p.id} className="flex items-center gap-2 rounded-lg border border-clay/30 bg-ivory-2 p-2"><img src={p.images[0]} alt="" className="h-10 w-10 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-1 text-[10px] font-bold text-ink">{p.name}</p><p className="flex items-center gap-0.5 text-[9px] text-ink-muted"><Store size={9} /> {p.brand}</p></div><span className="text-[10px] font-black text-gold">{toFa(formatPrice(p.price))}</span></div>))}</div>
          <div className="mt-2 flex items-center justify-between border-t border-clay/30 pt-2"><span className="text-[11px] font-bold text-ink">جمع کل:</span><span className="text-sm font-black text-terracotta-deep">{toFa(formatPrice(total))} ت</span></div>
          <div className="mt-2 space-y-2">
            <button onClick={buyTheLook} className="btn-accent flex w-full items-center justify-center gap-1.5 py-3 text-xs font-bold"><CreditCard size={14} /> خرید این چیدمان ({toFa(placedProducts.length)} کالا)</button>
            <button onClick={handleSaveToWishlist} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-clay/50 bg-ivory-2 py-2.5 text-[11px] font-bold text-ink transition hover:bg-clay/20"><Heart size={13} /> ذخیره در علاقه‌مندی</button>
          </div>
        </div>
      )}

      {/* Matched Real Store Products */}
      {matchedStoreProducts.length > 0 && (
        <div className="rounded-xl border border-clay/50 bg-cream p-4">
          <div className="mb-2.5 flex items-center justify-between border-b border-clay/30 pb-2">
            <h3 className="flex items-center gap-1.5 text-[11px] font-bold text-ink">
              <Store size={13} className="text-terracotta-deep" />
              کالاهای هماهنگ از فروشگاه‌ها ({toFa(matchedStoreProducts.length)})
            </h3>
            <span className="text-[9px] text-ink-muted">تطابق هوشمند کاتالوگ</span>
          </div>
          <div className="grid max-h-60 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {matchedStoreProducts.map((item) => (
              <div key={item.productId} className="flex flex-col justify-between rounded-lg border border-clay/30 bg-ivory-2 p-2.5">
                <div className="flex items-start gap-2">
                  <img src={item.image} alt={item.name} className="h-12 w-12 shrink-0 rounded-md object-cover" />
                  <div className="min-w-0 flex-1">
                    <Link href={item.productUrl} className="line-clamp-1 text-[11px] font-bold text-ink hover:text-terracotta-deep">
                      {item.name}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1 text-[9px] text-ink-muted">
                      <Store size={9} />
                      <span>{item.storeName}</span>
                      {item.storeVerified && <Check size={9} className="text-success" />}
                    </p>
                    {item.sku && <p className="font-mono text-[8px] text-ink-muted">SKU: {item.sku}</p>}
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-clay/20 pt-1.5">
                  <span className="text-[10px] font-black text-gold">{toFa(formatPrice(item.price))} ت</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => { addToCart(item.productId); toast("به سبد اضافه شد"); }}
                      className="rounded bg-terracotta/10 px-2 py-0.5 text-[9px] font-bold text-terracotta-deep transition hover:bg-terracotta hover:text-white"
                    >
                      افزودن
                    </button>
                    <Link
                      href={item.productUrl}
                      className="rounded border border-clay/50 bg-cream px-2 py-0.5 text-[9px] font-medium text-ink transition hover:bg-ivory"
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

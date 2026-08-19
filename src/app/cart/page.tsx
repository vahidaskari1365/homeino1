"use client";

import { useState } from "react";
import Link from "next/link";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Truck, ShieldCheck, Sparkles, Lightbulb, Plus as PlusIcon } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, ButtonLink, ConfirmDialog, EmptyState, LogoBlock, Badge } from "@/components/ui/primitives";
import { PLATFORM } from "@/config/platform";
import { products as allProducts, getProductById } from "@/data/products";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { getStoreById } from "@/data/stores";
import { toFa, formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { items, setQty, remove, add: addToCart } = useCart();
  const { toast } = useUi();
  const [pendingRemove, setPendingRemove] = useState<string | null>(null);
  const rows = items.flatMap((item) => {
    const product = getProductById(item.productId);
    return product ? [{ item, product }] : [];
  });
  const byStore = rows.reduce<Record<string, typeof rows>>((groups, row) => {
    (groups[row.product.storeId] ??= []).push(row);
    return groups;
  }, {});
  const subtotal = rows.reduce((sum, row) => sum + row.product.price * row.item.qty, 0);
  const shipping = subtotal >= PLATFORM.policies.freeShippingThreshold ? 0 : rows.length ? 120000 : 0;
  const suggestions = allProducts.filter((product) => !items.some((item) => item.productId === product.id) && product.inStock).slice(0, 6);

  if (rows.length === 0) {
    return (
      <Container className="py-12 sm:py-16">
        <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />
        <div className="mt-7"><EmptyState icon={<ShoppingBag size={32} />} title="سبد خریدت خالی است" desc="محصولات دلخواهت را پیدا کن؛ هر زمان آماده بودی اینجا ادامه می‌دهیم." action={<ButtonLink href="/products">شروع خرید</ButtonLink>} /></div>
      </Container>
    );
  }

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black text-ink">سبد خرید</h1><p className="mt-1 text-sm text-ink-muted">{toFa(rows.length)} محصول از {toFa(Object.keys(byStore).length)} فروشگاه</p></div><Link href="/products" className="text-sm font-bold text-terracotta-deep">ادامه خرید</Link></div>

      <div className="mt-7 grid min-w-0 gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {Object.entries(byStore).map(([storeId, group]) => {
            const store = getStoreById(storeId);
            const storeSubtotal = group.reduce((sum, row) => sum + row.product.price * row.item.qty, 0);
            return (
              <section key={storeId} className="card-surface overflow-hidden">
                <div className="flex flex-col gap-2 border-b border-clay/35 bg-ivory-2/65 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <Link href={`/stores/${store?.slug}`} className="flex min-w-0 items-center gap-2">{store && <LogoBlock char={store.logo} color={store.logoColor} size={34} />}<span className="truncate text-sm font-black text-ink">{store?.name}</span><Badge>فروشگاه</Badge></Link>
                  <span className="text-xs text-ink-muted">جمع فروشگاه: <b className="text-ink">{toFa(formatPrice(storeSubtotal))} تومان</b></span>
                </div>
                <div className="divide-y divide-clay/30">
                  {group.map(({ item, product }) => (
                    <div key={product.id} className="flex min-w-0 gap-3 p-3 sm:gap-4 sm:p-4">
                      <Link href={`/products/${product.slug}`} className="shrink-0"><SmartImage src={product.images[0]} alt={product.name} className="h-20 w-20 rounded-xl sm:h-24 sm:w-24" /></Link>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <div className="flex min-w-0 items-start justify-between gap-2"><div className="min-w-0"><Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-bold leading-6 text-ink hover:text-terracotta-deep">{product.name}</Link><div className="mt-0.5 text-xs text-ink-muted">{product.brand}</div></div><button type="button" onClick={() => setPendingRemove(product.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted transition hover:bg-danger/8 hover:text-danger" aria-label={`حذف ${product.name}`}><Trash2 size={16} /></button></div>
                        <div className="mt-auto flex flex-col gap-2 pt-2 min-[390px]:flex-row min-[390px]:items-end min-[390px]:justify-between">
                          <div className="flex w-fit items-center rounded-lg border border-clay/55 bg-cream p-0.5"><button type="button" onClick={() => setQty(product.id, item.qty - 1)} aria-label="کاهش تعداد" className="grid h-9 w-9 place-items-center rounded-md hover:bg-ivory-2"><Minus size={14} /></button><span className="w-7 text-center text-sm font-bold">{toFa(item.qty)}</span><button type="button" onClick={() => setQty(product.id, item.qty + 1)} aria-label="افزایش تعداد" className="grid h-9 w-9 place-items-center rounded-md hover:bg-ivory-2"><Plus size={14} /></button></div>
                          <span className="text-sm font-black text-ink">{toFa(formatPrice(product.price * item.qty))} <span className="text-[10px] font-normal text-ink-muted">تومان</span></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}

          <section className="rounded-[var(--radius-lg)] border border-clay/35 bg-cream/70 p-4">
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-black text-ink"><Sparkles size={15} className="text-gold" /> شاید این‌ها هم به کارت بیاید</h2>
            <div className="hide-scrollbar flex max-w-full snap-x gap-3 overflow-x-auto pb-2">
              {suggestions.map((product) => (
                <article key={product.id} className="flex w-36 shrink-0 snap-start flex-col rounded-xl border border-clay/35 bg-cream p-2">
                  <Link href={`/products/${product.slug}`}><SmartImage src={product.images[0]} alt={product.name} className="mb-2 aspect-square w-full rounded-lg" /></Link>
                  <Link href={`/products/${product.slug}`} className="line-clamp-2 min-h-8 text-[11px] font-bold leading-4 text-ink">{product.name}</Link>
                  <p className="mt-1 text-[10px] font-bold text-terracotta-deep">{toFa(formatPrice(product.price))} ت</p>
                  <button type="button" onClick={() => { addToCart(product.id); toast("به سبد اضافه شد"); }} className="btn-accent mt-2 flex min-h-9 items-center justify-center gap-1 rounded-lg text-[10px] font-bold"><PlusIcon size={11} /> افزودن</button>
                </article>
              ))}
            </div>
          </section>
        </div>

        <aside className="card-surface h-fit p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-black text-ink">خلاصه سفارش</h2>
          {subtotal < PLATFORM.policies.freeShippingThreshold ? (
            <div className="mb-4 rounded-xl border border-terracotta/25 bg-terracotta/5 p-3"><p className="mb-2 flex items-start gap-1.5 text-xs leading-6 text-ink"><Truck size={14} className="mt-1 shrink-0 text-terracotta-deep" /> فقط <b>{toFa(formatPrice(PLATFORM.policies.freeShippingThreshold - subtotal))} تومان</b> تا ارسال رایگان</p><div className="h-2 overflow-hidden rounded-full bg-sand/50"><div className="h-full rounded-full bg-gradient-to-l from-terracotta-soft to-terracotta" style={{ width: `${Math.min(100, (subtotal / PLATFORM.policies.freeShippingThreshold) * 100)}%` }} /></div></div>
          ) : <div className="mb-4 flex items-center gap-2 rounded-xl border border-sage/25 bg-sage/10 p-3 text-xs font-bold text-success"><ShieldCheck size={15} /> ارسال این سفارش رایگان است</div>}

          <div className="space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-ink-muted">جمع کالا</span><span className="font-bold text-ink">{toFa(formatPrice(subtotal))} تومان</span></div><div className="flex justify-between gap-3"><span className="flex items-center gap-1 text-ink-muted"><Truck size={15} /> ارسال</span><span className="font-bold text-ink">{shipping === 0 ? "رایگان" : `${toFa(formatPrice(shipping))} تومان`}</span></div><div className="rounded-lg bg-sage/8 p-2.5 text-xs leading-6 text-success">مرسوله هر فروشگاه جداگانه و قابل پیگیری ارسال می‌شود.</div></div>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-clay/35 pt-4"><span className="font-bold text-ink">قابل پرداخت</span><span className="text-lg font-black text-ink">{toFa(formatPrice(subtotal + shipping))} <small className="text-[10px] font-normal text-ink-muted">تومان</small></span></div>
          <ButtonLink href="/checkout" size="lg" className="mt-5 w-full">ادامه و پرداخت امن <ArrowLeft size={16} /></ButtonLink>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-muted"><ShieldCheck size={13} className="shrink-0 text-success" /> پرداخت امن · ضمانت بازگشت {toFa(PLATFORM.policies.returnDays)} روزه</div>
          <div className="mt-4 grid grid-cols-2 gap-2"><Link href="/ai" className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-gold/25 bg-gold/5 px-2 text-[10px] font-bold text-[#80601f]"><Sparkles size={13} /> طراحی با AI</Link><Link href="/inspiration" className="flex min-h-10 items-center justify-center gap-1 rounded-xl border border-clay/45 bg-ivory-2 px-2 text-[10px] font-bold text-ink-muted"><Lightbulb size={13} /> الهام بگیر</Link></div>
        </aside>
      </div>

      <ConfirmDialog open={pendingRemove != null} onClose={() => setPendingRemove(null)} onConfirm={() => { if (pendingRemove) { remove(pendingRemove); toast("محصول از سبد حذف شد", "info"); } }} title="حذف از سبد خرید؟" description="این محصول از سبد حذف می‌شود؛ هر زمان خواستی می‌توانی دوباره آن را اضافه کنی." confirmLabel="حذف محصول" destructive />
    </Container>
  );
}

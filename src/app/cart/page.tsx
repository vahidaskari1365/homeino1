"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, BadgeCheck, Minus, Plus, ShieldCheck, ShoppingBag, Trash2, Truck } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { ButtonLink, ConfirmDialog, EmptyState, LogoBlock } from "@/components/ui/primitives";
import { PLATFORM } from "@/config/platform";
import { products as allProducts, getProductById } from "@/data/products";
import { getBestOffer, getOfferById } from "@/data/offers";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { getStoreById } from "@/data/stores";
import { toFa, formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { items, setQty, remove, add: addToCart } = useCart();
  const toast = useUi((state) => state.toast);
  const [pendingRemove, setPendingRemove] = useState<{ productId: string; offerId?: string } | null>(null);

  const rows = items.flatMap((item) => {
    const product = getProductById(item.productId);
    if (!product) return [];
    const offer = getOfferById(item.offerId) ?? getBestOffer(product.id) ?? undefined;
    return [{ item, product, offer, storeId: offer?.storeId ?? product.storeId, price: offer?.price ?? product.price }];
  });
  const byStore = rows.reduce<Record<string, typeof rows>>((groups, row) => {
    (groups[row.storeId] ??= []).push(row);
    return groups;
  }, {});
  const subtotal = rows.reduce((sum, row) => sum + row.price * row.item.qty, 0);
  const shipping = rows.reduce((sum, row) => sum + (row.offer?.shippingCost ?? 0), 0) || (subtotal >= PLATFORM.policies.freeShippingThreshold ? 0 : 120000);
  const suggestions = allProducts.filter((product) => !items.some((item) => item.productId === product.id) && product.inStock).slice(0, 6);

  if (!rows.length) return <Container className="py-12 sm:py-16"><Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} /><div className="mt-7"><EmptyState icon={<ShoppingBag size={32} />} title="سبد خریدت خالی است" desc="محصول و فروشنده مناسب را پیدا کن؛ هر زمان آماده بودی از همین‌جا ادامه می‌دهیم." action={<ButtonLink href="/products">کاوش محصولات</ButtonLink>} /></div></Container>;

  return (
    <Container className="py-8 sm:py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />
      <div className="mt-5 flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-3xl font-black text-ink">سبد خرید</h1><p className="mt-1 text-sm text-ink-muted">{toFa(rows.length)} محصول از {toFa(Object.keys(byStore).length)} فروشگاه؛ هر فروشگاه مرسوله جدا دارد.</p></div><Link href="/products" className="text-sm font-bold text-terracotta-deep">ادامه خرید</Link></div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {Object.entries(byStore).map(([storeId, group]) => {
            const store = getStoreById(storeId);
            const storeSubtotal = group.reduce((sum, row) => sum + row.price * row.item.qty, 0);
            return <section key={storeId} className="card-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clay/35 bg-ivory-2/65 px-3 py-3 sm:px-4">
                <Link href={`/stores/${store?.slug}`} className="flex min-w-0 items-center gap-2">{store && <LogoBlock char={store.logo} color={store.logoColor} size={36} />}<span className="truncate text-sm font-black text-ink">{store?.name}</span>{store?.verified && <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-1 text-[9px] font-bold text-success"><BadgeCheck size={11} /> تأییدشده</span>}</Link>
                <span className="text-xs text-ink-muted">جمع کالاها: <b className="text-ink">{toFa(formatPrice(storeSubtotal))} تومان</b></span>
              </div>
              <div className="divide-y divide-clay/30">{group.map(({ item, product, offer, price }) => {
                const key = `${product.id}:${item.offerId ?? "default"}`;
                return <article key={key} className="flex gap-3 p-3 sm:gap-4 sm:p-4">
                  <Link href={`/products/${product.slug}`} className="shrink-0"><SmartImage src={product.images[0]} alt={product.name} className="h-20 w-20 rounded-xl sm:h-24 sm:w-24" /></Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-2"><div className="min-w-0"><Link href={`/products/${product.slug}`} className="line-clamp-2 text-sm font-bold leading-6 text-ink hover:text-terracotta-deep">{product.name}</Link><div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-ink-muted"><span>{offer ? `ارسال ${offer.shippingDays}` : "زمان ارسال پس از ثبت"}</span><span>{offer?.shippingCost === 0 ? "ارسال رایگان" : offer ? `هزینه ارسال ${toFa(formatPrice(offer.shippingCost))} تومان` : "هزینه ارسال در خلاصه"}</span></div></div><button type="button" onClick={() => setPendingRemove({ productId: product.id, offerId: item.offerId })} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-danger/8 hover:text-danger" aria-label={`حذف ${product.name}`}><Trash2 size={16} /></button></div>
                    <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3"><div className="flex w-fit items-center rounded-lg border border-clay/55 bg-cream p-0.5"><button type="button" onClick={() => setQty(product.id, item.qty - 1, item.offerId)} aria-label="کاهش تعداد" className="grid h-9 w-9 place-items-center rounded-md hover:bg-ivory-2"><Minus size={14} /></button><span className="w-7 text-center text-sm font-bold">{toFa(item.qty)}</span><button type="button" onClick={() => setQty(product.id, item.qty + 1, item.offerId)} aria-label="افزایش تعداد" className="grid h-9 w-9 place-items-center rounded-md hover:bg-ivory-2"><Plus size={14} /></button></div><span className="text-sm font-black text-ink">{toFa(formatPrice(price * item.qty))} <small className="font-normal text-ink-muted">تومان</small></span></div>
                  </div>
                </article>;
              })}</div>
            </section>;
          })}

          <section className="rounded-[var(--radius-lg)] border border-clay/35 bg-cream/70 p-4"><h2 className="mb-3 text-sm font-black text-ink">محصولات مرتبط با انتخاب‌های تو</h2><div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">{suggestions.map((product) => { const offer = getBestOffer(product.id); return <article key={product.id} className="flex w-36 shrink-0 flex-col rounded-xl border border-clay/35 bg-cream p-2"><Link href={`/products/${product.slug}`}><SmartImage src={product.images[0]} alt={product.name} className="mb-2 aspect-square w-full rounded-lg" /></Link><Link href={`/products/${product.slug}`} className="line-clamp-2 min-h-9 text-[11px] font-bold leading-5 text-ink">{product.name}</Link><p className="mt-1 text-[10px] font-bold text-terracotta-deep">{toFa(formatPrice(offer?.price ?? product.price))} تومان</p><button type="button" onClick={() => { addToCart(product.id, 1, offer?.id); toast("به سبد اضافه شد"); }} className="btn-primary mt-2 flex min-h-9 items-center justify-center gap-1 rounded-lg text-[10px] font-bold"><Plus size={12} /> افزودن</button></article>; })}</div></section>
        </div>

        <aside className="card-surface h-fit p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="mb-4 text-lg font-black text-ink">خلاصه سفارش</h2>
          <div className="space-y-3 text-sm"><div className="flex justify-between gap-3"><span className="text-ink-muted">جمع کالاها</span><span className="font-bold text-ink">{toFa(formatPrice(subtotal))} تومان</span></div><div className="flex justify-between gap-3"><span className="flex items-center gap-1 text-ink-muted"><Truck size={15} /> مجموع ارسال</span><span className="font-bold text-ink">{shipping === 0 ? "رایگان" : `${toFa(formatPrice(shipping))} تومان`}</span></div><div className="rounded-lg bg-sage/8 p-2.5 text-xs leading-6 text-success">هزینه و زمان هر فروشنده در سبد شفاف است و مرسوله‌ها جداگانه قابل پیگیری‌اند.</div></div>
          <div className="mt-4 flex items-end justify-between gap-3 border-t border-clay/35 pt-4"><span className="font-bold text-ink">قابل پرداخت</span><span className="text-lg font-black text-ink">{toFa(formatPrice(subtotal + shipping))} <small className="text-[10px] font-normal text-ink-muted">تومان</small></span></div>
          <ButtonLink href="/checkout" size="lg" className="mt-5 w-full">ادامه فرایند خرید <ArrowLeft size={16} /></ButtonLink>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11px] text-ink-muted"><ShieldCheck size={13} className="text-success" /> پرداخت امن · ضمانت بازگشت {toFa(PLATFORM.policies.returnDays)} روزه</div>
        </aside>
      </div>

      <ConfirmDialog open={pendingRemove != null} onClose={() => setPendingRemove(null)} onConfirm={() => { if (pendingRemove) { remove(pendingRemove.productId, pendingRemove.offerId); toast("محصول از سبد حذف شد", "info"); } }} title="حذف از سبد خرید؟" description="این انتخاب فقط از سبد حذف می‌شود و بعداً می‌توانی دوباره اضافه‌اش کنی." confirmLabel="حذف محصول" destructive />
    </Container>
  );
}

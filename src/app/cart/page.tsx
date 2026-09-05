"use client";
import Link from "next/link";
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, Truck, ShieldCheck, Sparkles, Lightbulb, Plus as PlusIcon } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, EmptyState, LogoBlock, Badge } from "@/components/ui/primitives";
import { PLATFORM } from "@/config/platform";
import { products as allProducts } from "@/data/products";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { resolveCartLines, groupCartParcels } from "@/lib/marketplace";
import { toFa, formatPrice } from "@/lib/utils";

export default function CartPage() {
  const { items, setQty, remove, add: addToCart } = useCart();
  const { toast } = useUi();
  const parcels = groupCartParcels(resolveCartLines(items));
  const rowsCount = parcels.reduce((n, p) => n + p.lines.length, 0);
  const subtotal = parcels.reduce((s, p) => s + p.subtotal, 0);
  const shipping = parcels.reduce((s, p) => s + p.shippingCost, 0);

  if (parcels.length === 0) {
    return (
      <Container className="py-16">
        <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />
        <div className="mt-8"><EmptyState icon={<ShoppingBag size={32} />} title="سبد خریدت خالیه" desc="محصولات دلخواهت را اضافه کن و اینجا برگرد." action={<Link href="/products"><Button>شروع خرید</Button></Link>} /></div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید" }]} />
      <h1 className="mt-5 font-display text-3xl font-black text-ink">سبد خرید ({toFa(rowsCount)} محصول)</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* items grouped by store — each store ships its own parcel */}
        <div className="space-y-5">
          {parcels.map((parcel) => (
            <div key={parcel.storeId} className="card-surface overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clay/40 bg-ivory-2 px-4 py-3">
                <div className="flex items-center gap-2">
                  <LogoBlock char={parcel.logo} color={parcel.logoColor} size={32} />
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-ink">{parcel.storeName}</span>
                      <Badge>مرسوله</Badge>
                    </div>
                    {parcel.shippingCost > 0 && (
                      <p className="flex items-center gap-1 text-[11px] text-ink-muted"><Truck size={12} /> {toFa(formatPrice(parcel.shippingCost))} ت هزینه ارسال این مرسوله</p>
                    )}
                  </div>
                </div>
                <span className="text-sm text-ink-muted">جمع مرسوله: {toFa(formatPrice(parcel.subtotal))} تومان</span>
              </div>

              {parcel.shippingCost > 0 && parcel.subtotal < PLATFORM.policies.freeShippingThreshold && (
                <div className="mx-4 mt-3 rounded-xl border border-terracotta/30 bg-terracotta/5 p-2.5">
                  <p className="mb-1.5 text-[11px] text-ink"><b>{toFa(formatPrice(PLATFORM.policies.freeShippingThreshold - parcel.subtotal))} تومان</b> دیگه تا ارسال رایگان این مرسوله!</p>
                  <div className="h-1.5 overflow-hidden rounded-full bg-sand/60"><div className="h-full rounded-full bg-gradient-to-l from-terracotta-soft to-terracotta transition-all" style={{ width: `${Math.min(100, (parcel.subtotal / PLATFORM.policies.freeShippingThreshold) * 100)}%` }} /></div>
                </div>
              )}
              {parcel.shippingCost === 0 && parcel.lines.length > 0 && (
                <div className="mx-4 mt-3 flex items-center gap-2 rounded-xl border border-sage/30 bg-sage/10 p-2.5 text-xs font-bold text-success"><BadgeCheck /> ارسال این مرسوله رایگان است</div>
              )}

              {parcel.lines.map(({ item, product, unitPrice }) => (
                <div key={`${product.id}-${item.offerId ?? ""}`} className="flex gap-4 p-4">
                  <Link href={`/products/${product.slug}`}><SmartImage src={product.images[0]} alt={product.name} className="h-24 w-24 shrink-0 rounded-xl" /></Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link href={`/products/${product.slug}`} className="line-clamp-1 font-medium text-ink hover:text-terracotta-deep">{product.name}</Link>
                    <div className="text-xs text-ink-muted">{product.brand}</div>
                    <div className="mt-1 flex gap-1">{product.colors.slice(0, 3).map((c) => <span key={c.name} className="h-4 w-4 rounded-full border border-clay/40" style={{ background: c.hex }} />)}</div>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="flex items-center gap-1 rounded-lg border border-clay/60 p-1">
                        <button onClick={() => setQty(product.id, item.qty - 1, item.offerId)} aria-label="کاهش تعداد" className="grid h-9 w-9 place-items-center rounded-md transition hover:bg-ivory-2"><Minus size={15} /></button>
                        <span className="w-8 text-center font-medium text-sm">{toFa(item.qty)}</span>
                        <button onClick={() => setQty(product.id, item.qty + 1, item.offerId)} aria-label="افزایش تعداد" className="grid h-9 w-9 place-items-center rounded-md transition hover:bg-ivory-2"><Plus size={15} /></button>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-ink">{toFa(formatPrice(unitPrice * item.qty))} <span className="text-[10px] text-ink-muted">تومان</span></span>
                        <button onClick={() => remove(product.id, item.offerId)} aria-label="حذف از سبد" className="text-ink-muted transition hover:text-danger"><Trash2 size={17} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* CROSS-SELL */}
        {items.length > 0 && (
          <div className="mt-6 rounded-2xl border border-clay/40 bg-cream p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold text-ink"><Sparkles size={15} className="text-gold" /> ممکنه اینم لازم داشته باشی</h3>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {allProducts
                .filter((p) => !useCart.getState().items.find((i) => i.productId === p.id) && p.inStock)
                .slice(0, 6)
                .map((p) => (
                  <div key={p.id} className="flex w-32 shrink-0 flex-col rounded-xl border border-clay/40 bg-ivory-2 p-2">
                    <img src={p.images[0]} alt={p.name} className="mb-1.5 aspect-square w-full rounded-lg object-cover" />
                    <p className="line-clamp-1 text-[10px] font-bold text-ink">{p.name}</p>
                    <p className="text-[10px] text-terracotta-deep">{toFa(formatPrice(p.price))} ت</p>
                    <button onClick={() => { addToCart(p.id); toast("به سبد اضافه شد"); }} className="btn-accent mt-1.5 flex items-center justify-center gap-1 rounded-md py-1 text-[9px] font-bold"><PlusIcon size={10} /> افزودن</button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* summary */}
        <aside className="card-surface h-fit p-6 lg:sticky lg:top-24">
          <h3 className="mb-4 font-display font-bold text-ink">خلاصه سفارش</h3>

          {subtotal < PLATFORM.policies.freeShippingThreshold && (
            <div className="mb-4 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3">
              <p className="mb-2 flex items-center gap-1.5 text-xs text-ink"><Truck size={14} className="text-terracotta-deep" /> ارسال هر مرسوله با رسیدن به سقف، رایگان می‌شود.</p>
            </div>
          )}

          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">جمع کالا</span><span className="font-medium text-ink">{toFa(formatPrice(subtotal))} تومان</span></div>
            <div className="flex justify-between"><span className="flex items-center gap-1 text-ink-muted"><Truck size={15} /> ارسال ({toFa(parcels.length)} مرسوله)</span><span className="font-medium text-ink">{shipping === 0 ? "رایگان" : `${toFa(formatPrice(shipping))} تومان`}</span></div>
            <div className="flex items-center gap-2 rounded-lg bg-sage/10 p-2 text-xs text-success">
              <BadgeCheck /> هر فروشنده سفارشش را جداگانه ارسال می‌کند
            </div>
          </div>
          <div className="mt-4 flex justify-between border-t border-clay/40 pt-4">
            <span className="font-display font-bold text-ink">مبلغ قابل پرداخت</span>
            <span className="font-display text-lg font-black text-ink">{toFa(formatPrice(subtotal + shipping))}</span>
          </div>
          <Link href="/checkout"><Button size="lg" className="mt-5 w-full">ادامه و پرداخت امن <ArrowLeft size={16} /></Button></Link>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted"><ShieldCheck size={13} className="text-sage" /> پرداخت رمزنگاری‌شده · ضمانت بازگشت ۷ روزه</div>
          <Link href="/products" className="mt-2 block text-center text-sm text-terracotta-deep hover:underline">ادامه خرید</Link>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Link href="/ai/design" className="flex items-center justify-center gap-1.5 rounded-xl border border-gold/30 bg-gold/5 py-2.5 text-[11px] font-bold text-gold transition hover:bg-gold/10"><Sparkles size={13} /> طراحی با AI</Link>
            <Link href="/inspiration" className="flex items-center justify-center gap-1.5 rounded-xl border border-clay/50 bg-ivory-2 py-2.5 text-[11px] font-bold text-ink-muted transition hover:text-ink"><Lightbulb size={13} /> الهام بگیر</Link>
          </div>
        </aside>
      </div>
    </Container>
  );
}

function BadgeCheck() { return <span className="grid h-4 w-4 place-items-center">✓</span>; }

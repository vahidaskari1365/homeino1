"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Truck, CreditCard, Check, ShieldCheck, Store } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button } from "@/components/ui/primitives";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { resolveCartLines, groupCartParcels } from "@/lib/marketplace";
import { placeLocalOrder } from "@/data/localOrders";
import { toFa, formatPrice, cn } from "@/lib/utils";

const STEPS = ["نشانی", "ارسال", "پرداخت"] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCart();
  const { toast } = useUi();
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState("post");
  const [pay, setPay] = useState("online");

  const lines = resolveCartLines(items);
  const parcels = groupCartParcels(lines, shipping === "express");
  const subtotal = parcels.reduce((s, p) => s + p.subtotal, 0);
  const shippingTotal = parcels.reduce((s, p) => s + p.shippingCost, 0);
  const total = subtotal + shippingTotal;

  const next = () => {
    if (step < 2) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    const order = placeLocalOrder(items, shipping === "express");
    clear();
    toast(`سفارش #${toFa(order.id)} ثبت شد و در «سفارش‌های من» ذخیره شد`);
    router.push(`/checkout/success?order=${order.id}`);
  };

  if (parcels.length === 0) {
    return <Container className="py-20 text-center"><p className="text-ink-muted">سبد خریدت خالیه.</p><Link href="/products" className="mt-3 inline-block text-terracotta-deep underline">بازگشت به خرید</Link></Container>;
  }

  return (
    <Container className="py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید", href: "/cart" }, { label: "پرداخت" }]} />

      {/* steps */}
      <div className="mt-6 flex items-center justify-center gap-2">
        {STEPS.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <span className={cn("grid h-8 w-8 place-items-center rounded-full text-sm font-bold transition", i <= step ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted")}>{i < step ? <Check size={15} /> : toFa(i + 1)}</span>
            <span className={cn("text-sm", i <= step ? "font-bold text-ink" : "text-ink-muted")}>{s}</span>
            {i < STEPS.length - 1 && <span className="mx-2 h-px w-8 bg-clay/60 sm:w-16" />}
          </div>
        ))}
      </div>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* form */}
        <div className="card-surface p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><MapPin size={18} /> نشانی تحویل</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[["fullName", "نام و نام خانوادگی", "نام کامل"], ["phone", "شماره موبایل", "09xxxxxxxxx"], ["postalCode", "کد پستی", "کد پستی"]].map(([id, label, ph]) => (
                  <div key={id}><label htmlFor={id} className="mb-1 block text-sm text-ink-muted">{label}</label><input id={id} name={id} required placeholder={ph} className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
                ))}
              </div>
              <div><label htmlFor="address" className="mb-1 block text-sm text-ink-muted">نشانی کامل</label><textarea id="address" name="address" required rows={2} placeholder="استان، شهر، خیابان، پلاک…" className="w-full resize-none rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Truck size={18} /> روش ارسال</h2>
              {[["post", "پست عادی", "۳ تا ۵ روز کاری — هر مرسوله", 120000], ["express", "پیک سریع", "۲۴ ساعت — هر مرسوله", 250000]].map(([id, t, d, c]) => (
                <button key={id} onClick={() => setShipping(id as string)} className={cn("flex w-full items-center justify-between rounded-xl border p-4 text-right transition", shipping === id ? "border-ink bg-ivory-2" : "border-clay/60")}>
                  <div><div className="font-medium text-ink">{t}</div><div className="text-xs text-ink-muted">{d} · {toFa(formatPrice(c as number))} ت برای هر فروشنده (رایگان با رسیدن به سقف)</div></div>
                  <div className="flex items-center gap-2"><span className="grid h-5 w-5 place-items-center rounded-full border" style={{ borderColor: shipping === id ? "var(--color-ink)" : "var(--color-clay)" }}>{shipping === id && <Check size={12} />}</span></div>
                </button>
              ))}
              <div className="rounded-lg bg-sage/10 p-3 text-xs text-success">سفارش از {toFa(parcels.length)} فروشگاه در {toFa(parcels.length)} مرسولهٔ جداگانه ارسال می‌شود.</div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><CreditCard size={18} /> روش پرداخت</h2>
              {[["online", "پرداخت آنلاین (درگاه)"], ["wallet", "کیف پول Homeino"], ["cod", "پرداخت در محل"]].map(([id, t]) => (
                <button key={id} onClick={() => setPay(id as string)} className={cn("flex w-full items-center justify-between rounded-xl border p-4 transition", pay === id ? "border-ink bg-ivory-2" : "border-clay/60")}>
                  <span className="font-medium text-ink">{t}</span>
                  <span className="grid h-5 w-5 place-items-center rounded-full border" style={{ borderColor: pay === id ? "var(--color-ink)" : "var(--color-clay)" }}>{pay === id && <Check size={12} />}</span>
                </button>
              ))}
              <div className="flex items-center gap-2 rounded-lg bg-ivory-2 p-3 text-xs text-ink-muted"><ShieldCheck size={16} className="text-sage" /> پرداخت امن و رمزنگاری‌شده. (درگاه واقعی به‌زودی فعال می‌شود — در این دمو سفارش بدون پرداخت واقعی در حساب شما ثبت می‌شود)</div>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>مرحله قبل</Button>}
            <Button className="flex-1" onClick={next}>{step < 2 ? "مرحله بعد" : "ثبت نهایی سفارش"}</Button>
          </div>
        </div>

        {/* summary — per parcel */}
        <aside className="card-surface h-fit p-6 lg:sticky lg:top-24">
          <h3 className="mb-4 font-display font-bold text-ink">سفارش شما ({toFa(parcels.length)} مرسوله)</h3>
          <div className="max-h-72 space-y-3 overflow-y-auto pl-1">
            {parcels.map((parcel) => (
              <div key={parcel.storeId} className="rounded-xl border border-clay/30 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold text-ink"><Store size={12} className="text-ink-muted" /> مرسوله از {parcel.storeName}</div>
                <div className="space-y-2">
                  {parcel.lines.map(({ item, product, unitPrice }) => (
                    <div key={`${product.id}-${item.offerId ?? ""}`} className="flex items-center gap-2">
                      <img src={product.images[0]} alt="" className="h-11 w-11 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-ink">{product.name}</div><div className="text-[11px] text-ink-muted">{toFa(item.qty)} عدد × {toFa(formatPrice(unitPrice))} ت</div></div>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex justify-between border-t border-clay/30 pt-1.5 text-[11px] text-ink-muted">
                  <span className="flex items-center gap-1"><Truck size={11} /> ارسال</span>
                  <span className={cn("font-bold", parcel.shippingCost === 0 ? "text-success" : "text-ink")}>{parcel.shippingCost === 0 ? "رایگان" : `${toFa(formatPrice(parcel.shippingCost))} ت`}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-clay/40 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">جمع کالا</span><span className="text-ink">{toFa(formatPrice(subtotal))} ت</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">ارسال</span><span className="text-ink">{shippingTotal === 0 ? "رایگان" : `${toFa(formatPrice(shippingTotal))} ت`}</span></div>
          </div>
          <div className="mt-3 flex justify-between border-t border-clay/40 pt-3">
            <span className="font-display font-bold text-ink">قابل پرداخت</span>
            <span className="font-display text-lg font-black text-ink">{toFa(formatPrice(total))}</span>
          </div>
        </aside>
      </div>
    </Container>
  );
}

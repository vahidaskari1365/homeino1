"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MapPin, Truck, CreditCard, Check, ShieldCheck } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, ButtonLink, EmptyState } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { getProductById } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { getBestOffer, getOfferById } from "@/data/offers";
import { toFa, formatPrice, cn } from "@/lib/utils";

const STEPS = ["نشانی", "ارسال", "پرداخت"] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCart();
  const { toast } = useUi();
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState("post");
  const [pay, setPay] = useState("online");

  const rows = items.map((item) => {
    const product = getProductById(item.productId)!;
    const offer = getOfferById(item.offerId) ?? getBestOffer(item.productId) ?? undefined;
    return { item, product, offer, storeId: offer?.storeId ?? product?.storeId, price: offer?.price ?? product?.price ?? 0 };
  }).filter((row) => row.product);
  const subtotal = rows.reduce((sum, row) => sum + row.price * row.item.qty, 0);
  const shippingCost = shipping === "express" ? 250000 : 120000;
  const total = subtotal + shippingCost;

  const next = () => {
    if (step < 2) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }
    else {
      clear();
      toast("سفارش با موفقیت ثبت شد");
      router.push("/checkout/success");
    }
  };

  if (rows.length === 0) {
    return <Container className="py-12 sm:py-20"><EmptyState title="سبد خریدت خالی است" desc="برای ادامه پرداخت، ابتدا یک محصول به سبد اضافه کن." action={<ButtonLink href="/products">بازگشت به خرید</ButtonLink>} /></Container>;
  }

  return (
    <Container className="py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبد خرید", href: "/cart" }, { label: "پرداخت" }]} />

      {/* steps */}
      <ol aria-label="مراحل پرداخت" className="relative mx-auto mt-6 grid max-w-xl grid-cols-3 gap-2 before:absolute before:left-[16%] before:right-[16%] before:top-4 before:h-px before:bg-clay/60">
        {STEPS.map((label, index) => (
          <li key={label} className="relative z-10 flex min-w-0 flex-col items-center gap-1.5 text-center">
            <span className={cn("grid h-8 w-8 place-items-center rounded-full border-2 border-ivory text-xs font-bold transition", index <= step ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted")}>{index < step ? <Check size={15} /> : toFa(index + 1)}</span>
            <span className={cn("text-xs sm:text-sm", index <= step ? "font-bold text-ink" : "text-ink-muted")}>{label}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* form */}
        <div className="card-surface p-4 sm:p-6">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><MapPin size={18} /> نشانی تحویل</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {[["fullName", "نام و نام خانوادگی", "نام کامل"], ["phone", "شماره موبایل", "09xxxxxxxxx"], ["postalCode", "کد پستی", "کد پستی"]].map(([id, label, ph]) => (
                  <div key={id}><label className="mb-1 block text-sm text-ink-muted">{label}</label><input id={id} required placeholder={ph} className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
                ))}
              </div>
              <div><label className="mb-1 block text-sm text-ink-muted">نشانی کامل</label><textarea required rows={2} placeholder="استان، شهر، خیابان، پلاک…" className="w-full resize-none rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><Truck size={18} /> روش ارسال</h2>
              {[["post", "پست عادی", "۳ تا ۵ روز کاری", 120000], ["express", "پیک سریع", "۲۴ ساعت", 250000]].map(([id, t, d, c]) => (
                <button key={id} onClick={() => setShipping(id as string)} className={cn("flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border p-3 text-right transition sm:p-4", shipping === id ? "border-ink bg-ivory-2" : "border-clay/60")}>
                  <div><div className="font-medium text-ink">{t}</div><div className="text-xs text-ink-muted">{d}</div></div>
                  <div className="flex items-center gap-2"><span className="text-sm font-bold text-ink">{toFa(formatPrice(c as number))} ت</span><span className={cn("grid h-5 w-5 place-items-center rounded-full border", shipping === id ? "border-ink bg-ink text-cream" : "border-clay")}>{shipping === id && <Check size={12} />}</span></div>
                </button>
              ))}
              <div className="rounded-lg bg-sage/10 p-3 text-xs text-success">سفارش از چند فروشگاه به‌صورت جداگانه ارسال می‌شود.</div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><CreditCard size={18} /> روش پرداخت</h2>
              {[["online", "پرداخت آنلاین (درگاه)"], ["wallet", "کیف پول Homeino"], ["cod", "پرداخت در محل"]].map(([id, t]) => (
                <button key={id} onClick={() => setPay(id as string)} className={cn("flex w-full items-center justify-between rounded-xl border p-4 transition", pay === id ? "border-ink bg-ivory-2" : "border-clay/60")}>
                  <span className="font-medium text-ink">{t}</span>
                  <span className={cn("grid h-5 w-5 place-items-center rounded-full border", pay === id ? "border-ink bg-ink text-cream" : "border-clay")}>{pay === id && <Check size={12} />}</span>
                </button>
              ))}
              <div className="flex items-center gap-2 rounded-lg bg-ivory-2 p-3 text-xs text-ink-muted"><ShieldCheck size={16} className="text-sage" /> پرداخت به‌صورت امن و رمزنگاری‌شده انجام می‌شود. (درگاه به‌زودی فعال می‌شود)</div>
            </div>
          )}
          <div className="mt-6 flex gap-3">
            {step > 0 && <Button variant="ghost" onClick={() => setStep(step - 1)}>مرحله قبل</Button>}
            <Button className="flex-1" onClick={next}>{step < 2 ? "مرحله بعد" : "ثبت نهایی سفارش"}</Button>
          </div>
        </div>

        {/* summary */}
        <aside className="card-surface h-fit p-6 lg:sticky lg:top-24">
          <h3 className="mb-4 font-display font-bold text-ink">سفارش شما</h3>
          <div className="max-h-60 space-y-3 overflow-y-auto pl-1">
            {rows.map(({ item, product, storeId }) => (
              <div key={`${product.id}:${item.offerId ?? "default"}`} className="flex items-center gap-2">
                <SmartImage src={product.images[0]} alt={product.name} className="h-12 w-12 rounded-lg" />
                <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium text-ink">{product.name}</div><div className="text-[11px] text-ink-muted">{toFa(item.qty)} عدد · {getStoreById(storeId)?.name}</div></div>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-2 border-t border-clay/40 pt-4 text-sm">
            <div className="flex justify-between"><span className="text-ink-muted">جمع کالا</span><span className="text-ink">{toFa(formatPrice(subtotal))} ت</span></div>
            <div className="flex justify-between"><span className="text-ink-muted">ارسال</span><span className="text-ink">{toFa(formatPrice(shippingCost))} ت</span></div>
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

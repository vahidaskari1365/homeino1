"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { MapPin, Truck, CreditCard, Check, ShieldCheck, Store, BookMarked } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button } from "@/components/ui/primitives";
import { useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { resolveCartLines, groupCartParcels } from "@/lib/marketplace";
import { placeLocalOrder } from "@/data/localOrders";
import { listSavedAddresses, addSavedAddress } from "@/data/localAddresses";
import { syncCart, createServerOrder } from "@/lib/commerceClient";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useDataVersion } from "@/lib/useDataVersion";
import { toFa, formatPrice, cn, fromFa } from "@/lib/utils";

const STEPS = ["نشانی", "ارسال", "پرداخت"] as const;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, clear } = useCart();
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  useDataVersion(); // live refresh when another tab mutates the local data layer
  // Address book: empty during SSR/first paint (identical HTML), the picker
  // and the save checkbox appear once localStorage is readable.
  const saved = hydrated ? listSavedAddresses() : [];
  const [pickedId, setPickedId] = useState("");
  const [saveToBook, setSaveToBook] = useState(false);
  const [step, setStep] = useState(0);
  const [shipping, setShipping] = useState("post");
  const [pay, setPay] = useState("online");
  const [address, setAddress] = useState<{
    fullName: string; phone: string; city: string; line: string; postalCode: string;
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const lines = resolveCartLines(items);
  const parcels = groupCartParcels(lines, shipping === "express");
  const subtotal = parcels.reduce((s, p) => s + p.subtotal, 0);
  const shippingTotal = parcels.reduce((s, p) => s + p.shippingCost, 0);
  const total = subtotal + shippingTotal;

  const next = async () => {
    if (step < 2) { setStep(step + 1); window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    setSubmitting(true);
    // ---- Real backend first: sync the local cart (by slug) and create the
    // order server-side (DB prices, inventory reservation, snapshots). Falls
    // back to the honest local demo order when the server is unavailable.
    const syncItems = lines.map((l) => ({ slug: l.product.slug, quantity: l.item.qty }));
    try {
      const sync = await syncCart(syncItems, shipping === "express" ? "express" : "post");
      if (sync.ok) {
        const order = await createServerOrder({
          shippingAddress: { ...address, method: shipping, payMethod: pay },
        });
        if (order.ok) {
          clear();
          toast(`سفارش #${toFa(order.data.orderNumber)} در سرور ثبت شد`);
          router.push(`/checkout/success?order=${order.data.orderNumber}`);
          return;
        }
        if (order.status !== 0 && order.status !== 401 && order.status !== 403 && order.status !== 503) {
          // Real server rejection (e.g. out of stock) — surface it honestly.
          toast(order.message ?? "ثبت سفارش ناموفق بود", "error");
          setSubmitting(false);
          return;
        }
      }
    } catch { /* network → demo fallback */ }
    // ---- Demo fallback (sample mode, no DB / guest)
    const order = placeLocalOrder(items, shipping === "express", {
      address: address ?? undefined,
      payMethod: pay,
      shippingMethod: shipping,
    });
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
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                const digits = (key: string) => fromFa(String(fd.get(key) ?? "")).replace(/[^\d]/g, "");
                const data = {
                  fullName: String(fd.get("fullName") ?? "").trim(),
                  phone: digits("phone"),
                  city: String(fd.get("city") ?? "").trim(),
                  line: String(fd.get("line") ?? "").trim(),
                  postalCode: digits("postalCode"),
                };
                if (!/^09\d{9}$/.test(data.phone)) { toast("شماره موبایل باید ۱۱ رقم و با 09 شروع شود", "error"); return; }
                if (!/^\d{10}$/.test(data.postalCode)) { toast("کد پستی باید ۱۰ رقم باشد", "error"); return; }
                setAddress(data);
                // «ذخیره در دفترچهٔ آدرس» — idempotent: the same address never
                // lands twice in the book.
                if (saveToBook) {
                  const res = addSavedAddress(data);
                  if (res.ok && res.created) toast("آدرس در دفترچهٔ آدرس هم ذخیره شد");
                }
                next();
              }}
            >
              <h2 className="flex items-center gap-2 font-display text-lg font-bold text-ink"><MapPin size={18} /> نشانی تحویل</h2>
              {saved.length > 0 && (
                <div className="rounded-xl border border-clay/40 bg-ivory-2 p-3">
                  <label htmlFor="savedAddress" className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-ink"><BookMarked size={13} /> آدرس‌های ذخیره‌شده</label>
                  <select
                    id="savedAddress"
                    value={pickedId}
                    onChange={(e) => {
                      setPickedId(e.target.value);
                      const picked = saved.find((a) => a.id === e.target.value);
                      const form = e.currentTarget.form;
                      if (picked && form) {
                        (form.elements.namedItem("fullName") as HTMLInputElement).value = picked.fullName;
                        (form.elements.namedItem("phone") as HTMLInputElement).value = picked.phone;
                        (form.elements.namedItem("city") as HTMLInputElement).value = picked.city;
                        (form.elements.namedItem("line") as HTMLTextAreaElement).value = picked.line;
                        (form.elements.namedItem("postalCode") as HTMLInputElement).value = picked.postalCode;
                        setSaveToBook(false); // already in the book
                      }
                    }}
                    className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink"
                  >
                    <option value="">— انتخاب کن (یا دستی تایپ کن) —</option>
                    {saved.map((a) => (
                      <option key={a.id} value={a.id}>{a.label} — {a.city} · {a.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div><label htmlFor="fullName" className="mb-1 block text-sm text-ink-muted">نام و نام خانوادگی</label><input id="fullName" name="fullName" required placeholder="نام کامل" className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
                <div><label htmlFor="phone" className="mb-1 block text-sm text-ink-muted">شماره موبایل</label><input id="phone" name="phone" required inputMode="tel" dir="ltr" placeholder="09xxxxxxxxx" className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
                <div><label htmlFor="city" className="mb-1 block text-sm text-ink-muted">شهر</label><input id="city" name="city" required placeholder="شهر" className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
                <div><label htmlFor="postalCode" className="mb-1 block text-sm text-ink-muted">کد پستی</label><input id="postalCode" name="postalCode" required inputMode="numeric" dir="ltr" placeholder="کد پستی" className="w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
              </div>
              <div><label htmlFor="address" className="mb-1 block text-sm text-ink-muted">نشانی کامل</label><textarea id="address" name="address" required rows={2} placeholder="استان، شهر، خیابان، پلاک…" className="w-full resize-none rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink" /></div>
              <label className="flex w-fit cursor-pointer items-center gap-2 text-xs text-ink-muted">
                <input type="checkbox" checked={saveToBook} onChange={(e) => setSaveToBook(e.target.checked)} className="accent-terracotta" />
                ذخیره در دفترچهٔ آدرس برای سفارش‌های بعدی
              </label>
              {/* hidden submit — the footer button clicks it so native required validation runs */}
              <button type="submit" id="address-submit" className="hidden" aria-hidden tabIndex={-1} />
            </form>
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
            <Button
              className="flex-1"
              disabled={submitting}
              onClick={() => {
                if (step === 0) {
                  // Trigger the address form's submit so native `required` validation runs.
                  const submit = document.getElementById("address-submit") as HTMLButtonElement | null;
                  if (submit) { submit.click(); return; }
                }
                void next();
              }}
            >
              {submitting ? "در حال ثبت…" : step < 2 ? "مرحله بعد" : "ثبت نهایی سفارش"}
            </Button>
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

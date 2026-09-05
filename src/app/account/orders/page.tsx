"use client";
import { useState } from "react";
import Link from "next/link";
import { Package, Truck, CheckCircle2, Clock, Ban, X, ChevronLeft } from "lucide-react";
import { Badge, EmptyState, Button, Modal } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { toFa, formatPrice } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { listLocalOrders, cancelLocalOrder, trackLocalOrder, STATUS_LABEL, type LocalOrder } from "@/data/localOrders";

const STATUS_TONE: Record<string, "success" | "accent" | "gold" | "dark"> = {
  delivered: "success",
  shipping: "accent",
  processing: "gold",
  cancelled: "dark",
};
const STATUS_ICON = { delivered: CheckCircle2, shipping: Truck, processing: Clock, cancelled: Ban };

export default function OrdersPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const [version, setVersion] = useState(0);
  const [tracking, setTracking] = useState<LocalOrder | null>(null);
  // Read localStorage only after client hydration so the first paint matches
  // SSR (empty first, then the persisted list appears) — zero console mismatch.
  // `version` lets cancel re-read after a mutation.
  const orders = hydrated ? listLocalOrders() : [];

  function cancel(order: LocalOrder) {
    const updated = cancelLocalOrder(order.id);
    if (!updated) {
      toast("این سفارش قابل لغو نیست", "error");
      return;
    }
    setVersion((v) => v + 1);
    toast(`سفارش #${toFa(order.id)} لغو شد`);
  }

  return (
    <div className="space-y-4" data-orders-version={version}>
      <h1 className="font-display text-xl font-black text-ink">سفارش‌های من</h1>
      <p className="text-xs text-ink-muted">سفارش‌ها در همین مرورگر (دمو بدون دیتابیس) نگهداری می‌شوند؛ هر تغییری — از جمله لغو — همین‌جا ذخیره می‌شود.</p>
      {orders.length ? orders.map((order) => {
        const St = STATUS_ICON[order.status];
        const cancellable = order.status === "processing" || order.status === "shipping";
        return (
          <div key={order.id} className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clay/40 pb-3">
              <div className="flex items-center gap-2"><Package size={16} className="text-ink-muted" /><span className="text-sm font-bold text-ink">سفارش #{toFa(order.id)}</span></div>
              <Badge tone={STATUS_TONE[order.status]}><St size={12} /> {STATUS_LABEL[order.status]}</Badge>
            </div>
            <div className="mt-3 space-y-3">
              {order.parcels.map((parcel) => (
                <div key={parcel.storeId} className="rounded-xl border border-clay/30 p-3">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold text-ink">
                    <span>مرسوله از {parcel.storeName}</span>
                    <span className="text-ink-muted">{toFa(parcel.lines.reduce((n, l) => n + l.qty, 0))} کالا</span>
                  </div>
                  <div className="space-y-1.5">
                    {parcel.lines.map((line) => (
                      <div key={`${line.productId}-${parcel.storeId}`} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          {line.image && <img src={line.image} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                          <span className="text-ink">{line.name}</span>
                        </div>
                        <span className="text-xs text-ink-muted">{toFa(line.qty)} عدد · {toFa(formatPrice(line.price * line.qty))} ت</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-clay/40 pt-3 text-sm">
              <span className="text-ink-muted">ثبت: {order.faDate}</span>
              <span className="font-bold text-ink">{toFa(formatPrice(order.total))} تومان</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setTracking(order)}>پیگیری سفارش</Button>
              {cancellable && <Button size="sm" variant="ghost" onClick={() => cancel(order)}>لغو سفارش</Button>}
            </div>
          </div>
        );
      }) : (
        <EmptyState icon={<Package size={28} />} title="هنوز سفارشی نداری" action={<Link href="/products"><Button>شروع خرید</Button></Link>} />
      )}

      {/* tracking */}
      <Modal open={Boolean(tracking)} onClose={() => setTracking(null)} title={`پیگیری سفارش #${toFa(tracking?.id ?? "")}`} description="مراحل این سفارش در حالت دمو">
        {tracking && (
          <div className="space-y-3">
            {trackLocalOrder(tracking).map((step, index) => (
              <div key={step.label} className="flex items-start gap-3">
                <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs ${step.done ? "border-sage bg-sage/15 text-success" : "border-clay/60 text-ink-muted"}`}>{step.done ? <CheckCircle2 size={15} /> : toFa(index + 1)}</div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-ink">{step.label}</div>
                  {step.note && <div className="text-xs text-ink-muted">{step.note}</div>}
                </div>
              </div>
            ))}
            <div className="flex items-start gap-2 rounded-lg bg-ivory-2 p-3 text-[11px] leading-6 text-ink-muted">
              <X size={13} className="mt-0.5 shrink-0" />
              <span>در دمو، وضعیت سفارش‌های نمونه ثابت است؛ سفارش‌هایی که خودت ثبت می‌کنی در همین مرورگر «در حال پردازش» می‌مانند.</span>
            </div>
            <div className="flex justify-end"><Button size="sm" variant="ghost" onClick={() => setTracking(null)}><ChevronLeft size={15} /> بستن</Button></div>
          </div>
        )}
      </Modal>
    </div>
  );
}

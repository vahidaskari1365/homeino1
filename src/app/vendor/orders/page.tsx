"use client";
import { useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Badge, Button } from "@/components/ui/primitives";
import { toFa, formatPrice } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { listVendorOrders, advanceVendorOrder } from "@/data/vendorSession";
import { getProductById } from "@/data/products";

const LABEL: Record<string, string> = { processing: "در حال پردازش", shipping: "در حال ارسال", delivered: "تحویل شده", cancelled: "لغو شده" };
const TONE: Record<string, "gold" | "accent" | "success" | "dark"> = { processing: "gold", shipping: "accent", delivered: "success", cancelled: "dark" };
const FILTERS = ["all", "processing", "shipping", "delivered"] as const;
const FILTER_FA: Record<string, string> = { all: "همه", processing: "در حال پردازش", shipping: "در حال ارسال", delivered: "تحویل شده" };

export default function VendorOrdersPage() {
  const { toast } = useUi();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState(listVendorOrders());

  const list = items.filter(({ order }) => filter === "all" || order.status === filter);

  function advance(orderId: string) {
    const next = advanceVendorOrder(orderId);
    setItems(listVendorOrders());
    const label = next ? LABEL[next] : null;
    toast(label ? `وضعیت سفارش #${toFa(orderId)} به «${label}» تغییر کرد` : "وضعیت تغییر نکرد", label ? "success" : "info");
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">سفارش‌ها</h1>
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((key) => (
          <button key={key} onClick={() => setFilter(key)} className={`rounded-full border px-4 py-1.5 text-sm transition ${filter === key ? "border-ink bg-ink text-cream" : "border-clay/60 text-ink hover:border-ink"}`}>{FILTER_FA[key]}</button>
        ))}
      </div>

      {list.length === 0 && <div className="card-surface p-10 text-center text-sm text-ink-muted">سفارشی با این وضعیت نیست.</div>}

      <div className="space-y-3">
        {list.map(({ order, total }) => {
          const open = expanded === order.id;
          return (
            <div key={order.id} className="card-surface p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <button type="button" onClick={() => setExpanded(open ? null : order.id)} className="flex items-center gap-2 text-right">
                  <ChevronLeft size={16} className={`text-ink-muted transition ${open ? "-rotate-90" : ""}`} />
                  <span className="font-bold text-ink">#{toFa(order.id)}</span>
                  <Badge tone={TONE[order.status]}>{LABEL[order.status]}</Badge>
                </button>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">{order.customer} · {order.date} · {toFa(order.lines.reduce((n, l) => n + l.qty, 0))} کالا</span>
                  <span className="font-bold text-ink">{toFa(formatPrice(total))} ت</span>
                </div>
              </div>

              {open && (
                <div className="mt-3 space-y-2 border-t border-clay/40 pt-3">
                  {order.lines.map((line) => {
                    const product = getProductById(line.productId);
                    return (
                      <div key={line.productId} className="flex items-center justify-between rounded-xl border border-clay/30 bg-ivory-2/60 px-3 py-2 text-sm">
                        <div className="flex items-center gap-2">
                          {product && <img src={product.images[0]} alt="" className="h-9 w-9 rounded-lg object-cover" />}
                          <span className="font-medium text-ink">{product?.name ?? "محصول حذف‌شده"}</span>
                        </div>
                        <span className="text-xs text-ink-muted">{toFa(line.qty)} عدد · {toFa(formatPrice(line.price * line.qty))} ت</span>
                      </div>
                    );
                  })}
                  {order.status === "processing" && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" onClick={() => advance(order.id)}>ارسال شد</Button>
                    </div>
                  )}
                  {order.status === "shipping" && (
                    <div className="flex justify-end gap-2 pt-1">
                      <Button size="sm" onClick={() => advance(order.id)}>تحویل شد</Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-ink-muted">
        این سفارش‌ها مربوط به فروشگاه نمونهٔ {listVendorOrders()[0]?.storeName ?? "شما"} هستند و تغییر وضعیت فقط در حافظهٔ همین دمو ذخیره می‌شود. — <Link href="/account/orders" className="underline">سفارش‌های من (خریدار) ←</Link>
      </p>
    </div>
  );
}

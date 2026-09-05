"use client";
import { useState } from "react";
import { Badge } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { listVendorOrders, advanceVendorOrder, vendorStoreProfile, type VendorOrder } from "@/data/vendorSession";
import { toFa, formatPrice } from "@/lib/utils";

const LABEL: Record<string, string> = { processing: "در حال پردازش", shipping: "در حال ارسال", delivered: "تحویل شده", cancelled: "لغو شده" };
const TONE: Record<string, "success" | "accent" | "gold" | "dark"> = { delivered: "success", shipping: "accent", processing: "gold", cancelled: "dark" };

export default function AdminOrdersPage() {
  const { toast } = useUi();
  const [orders, setOrders] = useState(listVendorOrders());

  function next(order: VendorOrder) {
    const nextStatus = advanceVendorOrder(order.id);
    if (!nextStatus || nextStatus === order.status) { toast("وضعیت تغییر نکرد", "info"); return; }
    setOrders(listVendorOrders());
    toast(`سفارش #${toFa(order.id)} → ${LABEL[nextStatus]} (در حافظهٔ همین دمو)`);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-xl font-black text-ink">مدیریت سفارش‌ها</h1>
        <Badge>{toFa(orders.length)} سفارش</Badge>
      </div>
      <div className="overflow-hidden card-surface">
        <table className="w-full min-w-[680px] text-sm">
          <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted"><th className="p-3 font-medium">سفارش</th><th className="p-3 font-medium">مشتری</th><th className="p-3 font-medium">فروشگاه</th><th className="p-3 font-medium">مبلغ</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium">عملیات</th></tr></thead>
          <tbody>
            {orders.map(({ order, total }) => (
              <tr key={order.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                <td className="p-3 font-bold text-ink">#{toFa(order.id)}</td>
                <td className="p-3 text-ink">{order.customer}</td>
                <td className="p-3 text-ink">{vendorStoreProfile().name}</td>
                <td className="p-3 whitespace-nowrap text-ink">{toFa(formatPrice(total))} ت</td>
                <td className="p-3"><Badge tone={TONE[order.status]}>{LABEL[order.status]}</Badge></td>
                <td className="p-3">
                  {(order.status === "processing" || order.status === "shipping") && (
                    <button onClick={() => next(order)} className="rounded-lg border border-clay/60 px-3 py-1.5 text-xs text-ink transition hover:border-ink hover:bg-ivory-2">
                      {order.status === "processing" ? "ارسال شد" : "تحویل شد"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {!orders.length && <tr><td colSpan={6} className="p-8 text-center text-sm text-ink-muted">سفارشی ثبت نشده است.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-ink-muted">همین جدول، فهرست سفارش‌های پنل فروشنده را هم تغذیه می‌کند (منبع دادهٔ واحد) — هر تغییر وضعیت در هر دو پنل دیده می‌شود.</p>
    </div>
  );
}

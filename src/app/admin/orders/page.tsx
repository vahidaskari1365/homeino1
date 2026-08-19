"use client";
import { Badge } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

const ORDERS = [
  { id: "102456", customer: "نگار م.", vendor: "نور مبلمان", total: 53200000, status: "delivered", tone: "success" as const },
  { id: "102455", customer: "آرش ر.", vendor: "نور مبلمان", total: 18900000, status: "shipping", tone: "accent" as const },
  { id: "102454", customer: "سارا ک.", vendor: "فرش سرا", total: 9800000, status: "processing", tone: "gold" as const },
  { id: "102453", customer: "محمد ت.", vendor: "لوامینا", total: 3900000, status: "processing", tone: "gold" as const },
];
const LABEL: Record<string, string> = { delivered: "تحویل شده", shipping: "در حال ارسال", processing: "در حال پردازش" };

export default function AdminOrdersPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">مدیریت سفارش‌ها</h1>
      <div className="card-surface overflow-hidden">
        <div className="table-shell">
        <table className="w-full min-w-[600px] text-sm">
          <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted"><th className="p-3 font-medium">سفارش</th><th className="p-3 font-medium">مشتری</th><th className="p-3 font-medium">فروشنده</th><th className="p-3 font-medium">مبلغ</th><th className="p-3 font-medium">وضعیت</th></tr></thead>
          <tbody>
            {ORDERS.map((o) => (
              <tr key={o.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                <td className="p-3 font-bold text-ink">#{toFa(o.id)}</td><td className="p-3 text-ink">{o.customer}</td><td className="p-3 text-ink">{o.vendor}</td><td className="p-3 whitespace-nowrap text-ink">{toFa(o.total.toLocaleString("fa-IR"))} ت</td><td className="p-3"><Badge tone={o.tone}>{LABEL[o.status]}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}

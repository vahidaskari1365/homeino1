"use client";
import { Badge } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

const ORDERS = [
  { id: "102456", customer: "نگار م.", items: 2, total: 53200000, status: "delivered", tone: "success" as const, date: "۱۴۰۳/۰۸/۱۵" },
  { id: "102455", customer: "آرش ر.", items: 1, total: 18900000, status: "shipping", tone: "accent" as const, date: "۱۴۰۳/۰۸/۱۴" },
  { id: "102454", customer: "سارا ک.", items: 1, total: 9800000, status: "processing", tone: "gold" as const, date: "۱۴۰۳/۰۸/۱۳" },
  { id: "102453", customer: "محمد ت.", items: 1, total: 3900000, status: "processing", tone: "gold" as const, date: "۱۴۰۳/۰۸/۱۲" },
];
const LABEL: Record<string, string> = { delivered: "تحویل شده", shipping: "در حال ارسال", processing: "در حال پردازش" };

export default function VendorOrdersPage() {
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">سفارش‌ها</h1>
      <div className="flex flex-wrap gap-2">{["همه", "در حال پردازش", "در حال ارسال", "تحویل شده"].map((t, i) => <span key={t} className={`rounded-full border px-4 py-1.5 text-sm ${i === 0 ? "border-ink bg-ink text-cream" : "border-clay/60 text-ink"}`}>{t}</span>)}</div>
      <div className="space-y-3">
        {ORDERS.map((o) => (
          <div key={o.id} className="card-surface flex flex-wrap items-center justify-between gap-3 p-4">
            <div><div className="flex items-center gap-2"><span className="font-bold text-ink">#{toFa(o.id)}</span><Badge tone={o.tone}>{LABEL[o.status]}</Badge></div><div className="mt-0.5 text-xs text-ink-muted">{o.customer} · {toFa(o.items)} کالا · {o.date}</div></div>
            <div className="flex items-center gap-3"><span className="font-bold text-ink">{toFa(o.total.toLocaleString("fa-IR"))} ت</span><button className="rounded-lg border border-clay/60 px-3 py-1.5 text-sm text-ink hover:bg-ivory-2">جزئیات</button></div>
          </div>
        ))}
      </div>
    </div>
  );
}

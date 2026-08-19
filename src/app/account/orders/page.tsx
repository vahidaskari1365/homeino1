"use client";
import { Package, Truck, CheckCircle2, Clock } from "lucide-react";
import { Badge, EmptyState, Button, ButtonLink } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

const ORDERS = [
  { id: "102456", date: "۱۴۰۳/۰۸/۱۵", status: "delivered", total: 53200000, items: ["کاناپه هلیم ۳ نفره", "ست کوسن پالت خاکی"], store: "نور مبلمان" },
  { id: "102401", date: "۱۴۰۳/۰۸/۰۲", status: "shipping", total: 8900000, items: ["چراغ رومیزی چوبی مینیمال"], store: "لوامینا" },
  { id: "102389", date: "۱۴۰۳/۰۷/۲۰", status: "processing", total: 9800000, items: ["قالیچه بربری دست‌بافت"], store: "فرش سرا" },
];

const STATUS = {
  delivered: { label: "تحویل شده", tone: "success" as const, icon: CheckCircle2 },
  shipping: { label: "در حال ارسال", tone: "accent" as const, icon: Truck },
  processing: { label: "در حال پردازش", tone: "gold" as const, icon: Clock },
};

export default function OrdersPage() {
  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-black text-ink">سفارش‌های من</h1>
      {ORDERS.length ? ORDERS.map((o) => {
        const st = STATUS[o.status as keyof typeof STATUS];
        return (
          <div key={o.id} className="card-surface p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-clay/40 pb-3">
              <div className="flex items-center gap-2"><Package size={16} className="text-ink-muted" /><span className="text-sm font-bold text-ink">سفارش #{toFa(o.id)}</span></div>
              <Badge tone={st.tone}><st.icon size={12} /> {st.label}</Badge>
            </div>
            <div className="mt-3 space-y-1 text-sm">
              {o.items.map((it) => <div key={it} className="text-ink">• {it}</div>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-clay/40 pt-3 text-sm">
              <span className="text-ink-muted">{o.store} · {o.date}</span>
              <span className="font-bold text-ink">{toFa(o.total.toLocaleString("fa-IR"))} تومان</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button size="sm" variant="ghost">جزئیات</Button>
              {o.status === "delivered" && <Button size="sm" variant="outline">ثبت نظر</Button>}
            </div>
          </div>
        );
      }) : <EmptyState icon={<Package size={28} />} title="هنوز سفارشی نداری" action={<ButtonLink href="/products">شروع خرید</ButtonLink>} />}
    </div>
  );
}

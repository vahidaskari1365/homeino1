"use client";
import Link from "next/link";
import { TrendingUp, TrendingDown, Package, ShoppingCart, DollarSign, Eye, Plus } from "lucide-react";
import { ButtonLink, Badge, LogoBlock } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

const stats = [
  { label: "فروش این ماه", value: "۲۴۸ میلیون", change: "+۱۸٪", up: true, icon: DollarSign },
  { label: "سفارش‌ها", value: "۸۶", change: "+۱۲٪", up: true, icon: ShoppingCart },
  { label: "محصولات فعال", value: "۲۳", change: "+۲", up: true, icon: Package },
  { label: "بازدید فروشگاه", value: "۱۲٫۴ هزار", change: "-۴٪", up: false, icon: Eye },
];

const recentOrders = [
  { id: "102456", customer: "نگار م.", total: "۵۳٫۲ میلیون", status: "delivered", tone: "success" as const },
  { id: "102455", customer: "آرش ر.", total: "۱۸٫۹ میلیون", status: "shipping", tone: "accent" as const },
  { id: "102454", customer: "سارا ک.", total: "۹٫۸ میلیون", status: "processing", tone: "gold" as const },
  { id: "102453", customer: "محمد ت.", total: "۳٫۹ میلیون", status: "processing", tone: "gold" as const },
];

const STATUS_LABEL: Record<string, string> = { delivered: "تحویل شده", shipping: "در حال ارسال", processing: "در حال پردازش" };

export default function VendorDashboard() {
  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <LogoBlock char="ن" color="var(--color-terracotta)" size={52} />
          <div><h1 className="font-display text-xl font-black text-ink">خوش آمدی، نور مبلمان</h1><p className="text-sm text-ink-muted">نمای کلی فروش این ماه</p></div>
        </div>
        <ButtonLink href="/vendor/products/new"><Plus size={16} /> افزودن محصول</ButtonLink>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <div className="flex items-center justify-between">
              <s.icon size={20} className="text-ink-muted" />
              <span className={`flex items-center gap-0.5 text-xs font-bold ${s.up ? "text-success" : "text-danger"}`}>{s.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />}{s.change}</span>
            </div>
            <div className="mt-2 font-display text-2xl font-black text-ink">{s.value}</div>
            <div className="text-xs text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="card-surface p-6">
          <div className="mb-4 flex items-center justify-between"><h3 className="font-display font-bold text-ink">سفارش‌های اخیر</h3><Link href="/vendor/orders" className="text-sm text-terracotta-deep">همه ←</Link></div>
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between rounded-xl border border-clay/40 p-3">
                <div><div className="text-sm font-medium text-ink">#{toFa(o.id)}</div><div className="text-xs text-ink-muted">{o.customer}</div></div>
                <div className="flex items-center gap-3"><span className="text-sm font-bold text-ink">{o.total} ت</span><Badge tone={o.tone}>{STATUS_LABEL[o.status]}</Badge></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">عملکرد فروش</h3>
          <div className="flex h-40 items-end justify-between gap-1.5">
            {[40, 65, 50, 80, 55, 90, 70, 100, 75, 85, 60, 95].map((h, i) => (
              <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-terracotta to-terracotta-soft transition-all hover:opacity-80" style={{ height: `${h}%` }} title={`ماه ${toFa(i + 1)}`} />
            ))}
          </div>
          <div className="mt-3 text-center text-xs text-ink-muted">آمار ۱۲ ماه اخیر (نمونه)</div>
        </div>
      </div>
    </div>
  );
}

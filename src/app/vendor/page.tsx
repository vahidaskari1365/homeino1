"use client";
import Link from "next/link";
import { Package, ShoppingCart, DollarSign, Clock, Plus, CheckCircle2, Truck } from "lucide-react";
import { Button, Badge, LogoBlock } from "@/components/ui/primitives";
import { toFa, formatCompactFa, formatPrice } from "@/lib/utils";
import { vendorStats, listVendorOrders, vendorStoreProfile, vendorProductCount } from "@/data/vendorSession";

const ORDER_STATUS_LABEL: Record<string, string> = { delivered: "تحویل شده", shipping: "در حال ارسال", processing: "در حال پردازش", cancelled: "لغو شده" };
const ORDER_STATUS_TONE: Record<string, "success" | "accent" | "gold" | "dark"> = { delivered: "success", shipping: "accent", processing: "gold", cancelled: "dark" };

export default function VendorDashboard() {
  const stats = vendorStats();
  const profile = vendorStoreProfile();
  const recent = listVendorOrders().slice(0, 4);
  const tiles = [
    { label: "فروش این ماه", value: `${toFa(formatCompactFa(stats.monthSales))} ت`, icon: DollarSign },
    { label: "سفارش‌ها", value: toFa(stats.ordersCount), icon: ShoppingCart },
    { label: "محصولات فعال", value: toFa(stats.activeProductCount), icon: Package },
    { label: "در انتظار پردازش", value: toFa(stats.processingCount), icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <LogoBlock char={profile.logoChar} color={profile.logoColor} size={52} />
          <div><h1 className="font-display text-xl font-black text-ink">خوش آمدی، {profile.name}</h1><p className="text-sm text-ink-muted">نمای کلی فروش این ماه</p></div>
        </div>
        <Link href="/vendor/products/new"><Button><Plus size={16} /> افزودن محصول</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {tiles.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <div className="flex items-center justify-between">
              <s.icon size={20} className="text-ink-muted" />
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
            {recent.length ? recent.map(({ order, total }) => (
              <div key={order.id} className="flex items-center justify-between rounded-xl border border-clay/40 p-3">
                <div><div className="text-sm font-medium text-ink">#{toFa(order.id)}</div><div className="text-xs text-ink-muted">{order.customer} · {toFa(order.lines.reduce((n, l) => n + l.qty, 0))} کالا</div></div>
                <div className="flex items-center gap-3"><span className="text-sm font-bold text-ink">{toFa(formatPrice(total))} ت</span><Badge tone={ORDER_STATUS_TONE[order.status] ?? "neutral"}>{ORDER_STATUS_LABEL[order.status] ?? order.status}</Badge></div>
              </div>
            )) : <p className="text-sm text-ink-muted">هنوز سفارشی ثبت نشده است.</p>}
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
          <div className="mt-4 space-y-2 border-t border-clay/40 pt-3 text-xs text-ink-muted">
            <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><CheckCircle2 size={13} className="text-sage" /> تحویل‌شده</span><b className="text-ink">{toFa(stats.deliveredCount)}</b></div>
            <div className="flex items-center justify-between"><span className="flex items-center gap-1.5"><Truck size={13} className="text-terracotta-deep" /> در حال ارسال</span><b className="text-ink">{toFa(stats.shippingCount)}</b></div>
          </div>
        </div>
      </div>
      <p className="text-[11px] text-ink-muted">محصولات ثبت‌شده: {toFa(vendorProductCount())} — این پنل از منبع دادهٔ یکسان پنل فروشنده (vendorSession) تغذیه می‌شود.</p>
    </div>
  );
}

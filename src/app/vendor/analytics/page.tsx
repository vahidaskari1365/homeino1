"use client";
import { TrendingUp, Eye, ShoppingCart, Heart } from "lucide-react";
import { toFa } from "@/lib/utils";

export default function VendorAnalyticsPage() {
  const stats = [
    { label: "بازدید کل", value: "۴۸٫۲ هزار", icon: Eye },
    { label: "تبدیل به سفارش", value: "۳٫۴٪", icon: ShoppingCart },
    { label: "محبوب‌ترین محصول", value: "کاناپه هلیم", icon: Heart },
    { label: "رشد ماهانه", value: "+۲۲٪", icon: TrendingUp },
  ];
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">تحلیل و گزارش</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface p-5"><s.icon size={20} className="text-terracotta-deep" /><div className="mt-2 font-display text-xl font-black text-ink">{s.value}</div><div className="text-xs text-ink-muted">{s.label}</div></div>
        ))}
      </div>
      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">روند فروش</h3>
        <div className="flex h-48 items-end justify-between gap-1.5">
          {[35, 60, 45, 75, 50, 85, 65, 95, 70, 80, 55, 90].map((h, i) => (
            <div key={i} className="group relative flex-1 rounded-t bg-gradient-to-t from-ink to-ink-soft transition-all hover:from-terracotta hover:to-terracotta-deep" style={{ height: `${h}%` }}><span className="absolute -top-5 right-1/2 translate-x-1/2 text-[10px] text-ink-muted opacity-0 group-hover:opacity-100">{toFa(h)}</span></div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">آمار فروش ۱۲ ماه اخیر (داده نمونه)</p>
      </div>
    </div>
  );
}

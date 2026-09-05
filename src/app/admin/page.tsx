"use client";
import Link from "next/link";
import { Users, Store, Package, DollarSign, Sparkles, TrendingUp } from "lucide-react";
import { toFa } from "@/lib/utils";
import { products } from "@/data/products";
import { stores } from "@/data/stores";

// Catalog numbers derive from the same fixtures the storefront shows —
// fantasy counts (۵٬۱۲۰ محصول!) next to a 39-product catalog killed trust.
const stats = [
  { label: "فروشندگان (تأییدشده)", value: toFa(stores.filter((s) => s.verified).length), icon: Store, change: "" },
  { label: "محصولات", value: toFa(products.length), icon: Package, change: "" },
  { label: "کاربران (نمونه)", value: "۱۸٫۴ هزار", icon: Users, change: "+۳۲۰" },
  { label: "درآمد پلتفرم (نمونه)", value: "۲٫۴ میلیارد", icon: DollarSign, change: "+۱۵٪" },
];

const activity = [
  { text: "فروشگاه جدید «ورک‌نست» ثبت شد", time: "۱۰ دقیقه پیش", type: "store" },
  { text: "سفارش #102456 تحویل داده شد", time: "۲۵ دقیقه پیش", type: "order" },
  { text: "۱٬۲۰۰ عملیات AI امروز انجام شد", time: "۱ ساعت پیش", type: "ai" },
  { text: "محصول جدید تأیید شد: کاناپه ماژولار", time: "۲ ساعت پیش", type: "product" },
];

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="card-surface p-6"><h1 className="font-display text-xl font-black text-ink">داشبورد مدیریت</h1><p className="text-sm text-ink-muted">نمای کلی پلتفرم Homeino</p></div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <div className="flex items-center justify-between"><s.icon size={20} className="text-terracotta-deep" />{s.change && <span className="flex items-center gap-0.5 text-xs font-bold text-success"><TrendingUp size={12} />{s.change}</span>}</div>
            <div className="mt-2 font-display text-2xl font-black text-ink">{s.value}</div>
            <div className="text-xs text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">فعالیت‌های اخیر</h3>
          <div className="space-y-3">
            {activity.map((a, i) => (
              <div key={i} className="flex items-start gap-3 border-b border-clay/30 pb-3 last:border-0 last:pb-0">
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ivory-2 text-terracotta-deep">{a.type === "ai" ? <Sparkles size={15} /> : a.type === "order" ? <Package size={15} /> : a.type === "store" ? <Store size={15} /> : <Users size={15} />}</span>
                <div><div className="text-sm text-ink">{a.text}</div><div className="text-xs text-ink-muted">{a.time}</div></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card-surface p-6">
          <h3 className="mb-4 font-display font-bold text-ink">دسترسی سریع</h3>
          <div className="grid grid-cols-2 gap-3">
            {[["کاربران", "/admin/users"], ["محصولات", "/admin/products"], ["سفارش‌ها", "/admin/orders"], ["مصرف AI", "/admin/ai"]].map(([t, h]) => (
              <Link key={t} href={h} className="rounded-xl border border-clay/40 p-4 text-center text-sm font-medium text-ink transition hover:border-ink hover:shadow-sm">{t}</Link>
            ))}
          </div>
          <div className="mt-4 rounded-xl bg-gradient-to-bl from-terracotta to-terracotta-deep p-4 text-white">
            <div className="flex items-center gap-2"><Sparkles size={18} /> مصرف AI امروز</div>
            <div className="mt-1 font-display text-2xl font-black">{toFa("۱۲٬۴۰۰")} عملیات</div>
          </div>
        </div>
      </div>
    </div>
  );
}

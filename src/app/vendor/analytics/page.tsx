"use client";
import { Percent, Wallet, Info } from "lucide-react";
import { Badge } from "@/components/ui/primitives";
import { toFa, formatPrice } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { vendorStats, listVendorOrdersWithBuyers } from "@/data/vendorSession";
import { PLATFORM } from "@/config/platform";

export default function VendorAnalyticsPage() {
  const hydrated = useHasHydrated();
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  // Money cards = real orders (session seeds + buyer-placed ones after hydration).
  const stats = vendorStats(hydrated);
  const rows = hydrated ? listVendorOrdersWithBuyers() : listVendorOrdersWithBuyers().filter((row) => !row.fromBuyer);
  // Bars derive from the 12 most recent order totals — not a hardcoded array.
  const bars = (() => {
    const totals = rows.map(({ total }) => total).slice(0, 12);
    if (!totals.length) return [];
    const max = Math.max(...totals);
    return totals.map((total) => Math.max(10, Math.round((total / max) * 100)));
  })();
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">تحلیل و گزارش</h1>
      <p className="text-sm text-ink-muted">
        ستون تسویهٔ مالی فقط دو کارت دارد: کمیسیون پلتفرم و ماندهٔ تسویه. هر دو از یک منبع واحد ({PLATFORM.vendor.commissionRatePercent}٪ ثابت در config) محاسبه می‌شوند — نه عدد ثابت در صفحه.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="card-surface p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-bold text-ink"><Percent size={18} className="text-terracotta-deep" /> کمیسیون پلتفرم</div>
            <Badge>{toFa(PLATFORM.vendor.commissionRatePercent)}٪ از فروش</Badge>
          </div>
          <div className="mt-3 font-display text-2xl font-black text-ink">{toFa(formatPrice(stats.platformCommission))} <span className="text-sm font-normal text-ink-muted">تومان</span></div>
          <p className="mt-2 text-xs leading-6 text-ink-muted">محاسبه‌شده روی {toFa(stats.deliveredCount)} سفارش تحویل‌شدهٔ این دوره (نمونه). سقف/پله‌های کمیسیون پس از اتصال به سامانهٔ واقعی تسویه اعمال می‌شود.</p>
        </div>

        <div className="card-surface p-6">
          <div className="flex items-center gap-2 text-sm font-bold text-ink"><Wallet size={18} className="text-terracotta-deep" /> ماندهٔ تسویه</div>
          <div className="mt-3 font-display text-2xl font-black text-ink">{toFa(formatPrice(stats.settlementBalance))} <span className="text-sm font-normal text-ink-muted">تومان</span></div>
          <p className="mt-2 text-xs leading-6 text-ink-muted">معادل فروش تحویل‌شده پس از کسر کمیسیون پلتفرم — نمایشی در حالت دمو و هنوز قابل برداشت نیست.</p>
        </div>
      </div>

      <div className="card-surface p-6">
        <h3 className="mb-4 font-display font-bold text-ink">روند فروش</h3>
        <div className="flex h-48 items-end justify-between gap-1.5">
          {bars.map((h, i) => (
            <div key={i} className="group relative flex-1 rounded-t bg-gradient-to-t from-ink to-ink-soft transition-all hover:from-terracotta hover:to-terracotta-deep" style={{ height: `${h}%` }}><span className="absolute -top-5 right-1/2 translate-x-1/2 text-[10px] text-ink-muted opacity-0 group-hover:opacity-100">{toFa(h)}</span></div>
          ))}
        </div>
        <p className="mt-3 text-center text-xs text-ink-muted">ارتفاع میله‌ها از مبلغ ۱۲ سفارش آخر همین فروشگاه محاسبه می‌شود</p>
      </div>

      <div className="flex items-start gap-2 rounded-xl border border-clay/40 bg-ivory-2 p-3 text-[11px] leading-6 text-ink-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-terracotta-deep" />
        <span>گزارش‌های پیشرفته (بازدید، نرخ تبدیل، محبوب‌ترین محصول) بعد از راه‌اندازی پنل تحلیلی واقعی اضافه می‌شوند؛ در این دمو آمارهای مالی فقط از سفارش‌های واقعی همین فروشگاه نمونه محاسبه شده‌اند.</span>
      </div>
    </div>
  );
}

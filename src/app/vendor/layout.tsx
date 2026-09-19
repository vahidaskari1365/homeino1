"use client";
import { useEffect, useState, type ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingCart, Store, BarChart3, PlusCircle, Info, CheckCircle2, Crown, Bell, MessagesSquare } from "lucide-react";
import { DashboardLayout, type NavItem } from "@/components/layout/DashboardLayout";
import { PLATFORM } from "@/config/platform";
import { vendorStoreProfile } from "@/data/vendorSession";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { fetchVendorMeCached, isDemoFallback } from "@/lib/vendorClient";

const NAV: NavItem[] = [
  { label: "داشبورد", href: "/vendor", icon: LayoutDashboard },
  { label: "محصولات", href: "/vendor/products", icon: Package },
  { label: "افزودن محصول", href: "/vendor/products/new", icon: PlusCircle },
  { label: "سفارش‌ها", href: "/vendor/orders", icon: ShoppingCart },
  { label: "فروشگاه", href: "/vendor/store", icon: Store },
  { label: "تحلیل و گزارش", href: "/vendor/analytics", icon: BarChart3 },
  { label: "اطلاع‌رسانی‌ها", href: "/vendor/notifications", icon: Bell }, // صندوق پیام فروشنده — Task 59
  { label: "پیام‌های مشتریان", href: "/vendor/messages", icon: MessagesSquare }, // گفتگوی مشتری و فروشگاه — Task 60
  { label: "خرید پکیج", href: "/vendor/package", icon: Crown }, // فقط در پنل فروشنده — Task 58
];

type BannerMode = "unknown" | "demo" | "real";

export default function VendorLayout({ children }: { children: ReactNode }) {
  // subscribe: after hydration the persisted session (store name) lands here
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  // Honest mode banner: one shared /api/vendor/me probe decides whether the
  // panel is talking to the REAL backend or running on the local demo store.
  const [bannerMode, setBannerMode] = useState<BannerMode>("unknown");

  useEffect(() => {
    let alive = true;
    void fetchVendorMeCached().then((res) => {
      if (!alive) return;
      if (res.ok) setBannerMode("real");
      else if (isDemoFallback(res)) setBannerMode("demo");
      else setBannerMode("unknown"); // 401/403 — the page itself shows the honest state
    });
    return () => { alive = false; };
  }, []);

  return (
    <DashboardLayout items={NAV} title="پنل فروشنده" badge={vendorStoreProfile().name}>
      {bannerMode === "real" && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-sage/40 bg-sage/10 px-4 py-2.5 text-xs leading-6 text-ink">
          <CheckCircle2 size={14} className="mt-1 shrink-0 text-success" />
          <span>اتصال واقعی برقرار است — داده‌های این پنل از سرور هومینو می‌آید و تغییرات روی فروشگاه واقعی شما اعمال می‌شود.</span>
        </div>
      )}
      {bannerMode === "demo" && PLATFORM.vendor.demo.enabled && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/8 px-4 py-2.5 text-xs leading-6 text-ink">
          <Info size={14} className="mt-1 shrink-0 text-gold" />
          <span>{PLATFORM.vendor.demo.label} داده‌های این پنل از همان کاتالوگ دموی سایت خوانده می‌شود و تغییرات در همین مرورگر ذخیره می‌شوند — با رفرش هم نمی‌پرند. با راه‌اندازی سرور، دادهٔ واقعی جایگزین می‌شود.</span>
        </div>
      )}
      {children}
    </DashboardLayout>
  );
}

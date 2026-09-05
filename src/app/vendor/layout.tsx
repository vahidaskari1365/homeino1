"use client";
import type { ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingCart, Store, BarChart3, PlusCircle, Info } from "lucide-react";
import { DashboardLayout, type NavItem } from "@/components/layout/DashboardLayout";
import { PLATFORM } from "@/config/platform";
import { vendorStoreProfile } from "@/data/vendorSession";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";

const NAV: NavItem[] = [
  { label: "داشبورد", href: "/vendor", icon: LayoutDashboard },
  { label: "محصولات", href: "/vendor/products", icon: Package },
  { label: "افزودن محصول", href: "/vendor/products/new", icon: PlusCircle },
  { label: "سفارش‌ها", href: "/vendor/orders", icon: ShoppingCart },
  { label: "فروشگاه", href: "/vendor/store", icon: Store },
  { label: "تحلیل و گزارش", href: "/vendor/analytics", icon: BarChart3 },
];

export default function VendorLayout({ children }: { children: ReactNode }) {
  // subscribe: after hydration the persisted session (store name) lands here
  const vsVersion = useVendorSessionVersion();
  void vsVersion;
  return (
    <DashboardLayout items={NAV} title="پنل فروشنده" badge={vendorStoreProfile().name}>
      {PLATFORM.vendor.demo.enabled && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/8 px-4 py-2.5 text-xs leading-6 text-ink">
          <Info size={14} className="mt-1 shrink-0 text-gold" />
          <span>{PLATFORM.vendor.demo.label} داده‌های این پنل از همان کاتالوگ دموی سایت خوانده می‌شود و تغییرات در همین مرورگر ذخیره می‌شوند — با رفرش هم نمی‌پرند.</span>
        </div>
      )}
      {children}
    </DashboardLayout>
  );
}

"use client";
import type { ReactNode } from "react";
import { LayoutDashboard, User, Settings, Sparkles, Package, Wand2, Tag, MapPin } from "lucide-react";
import { DashboardLayout, type NavItem } from "@/components/layout/DashboardLayout";
import { useAuth } from "@/stores/useApp";

const NAV: NavItem[] = [
  { label: "نمای کلی", href: "/account", icon: LayoutDashboard },
  { label: "پروفایل", href: "/account/profile", icon: User },
  { label: "اعتبار AI", href: "/account/credits", icon: Sparkles },
  { label: "سفارش‌ها", href: "/account/orders", icon: Package },
  { label: "آدرس‌های من", href: "/account/addresses", icon: MapPin },
  { label: "آگهی‌های من", href: "/account/ads", icon: Tag },
  { label: "طراحی‌های من", href: "/account/designs", icon: Wand2 },
  { label: "تنظیمات", href: "/account/settings", icon: Settings },
];

export default function AccountLayout({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  return (
    <DashboardLayout items={NAV} title="حساب من" badge={user?.name?.[0]}>
      {children}
    </DashboardLayout>
  );
}

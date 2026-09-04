"use client";
import type { ReactNode } from "react";
import { LayoutDashboard, Users, Package, ShoppingCart, Sparkles, Store, Workflow } from "lucide-react";
import { DashboardLayout, type NavItem } from "@/components/layout/DashboardLayout";

const NAV: NavItem[] = [
  { label: "داشبورد", href: "/admin", icon: LayoutDashboard },
  { label: "کاربران", href: "/admin/users", icon: Users },
  { label: "فروشندگان", href: "/admin/vendors", icon: Store },
  { label: "محصولات", href: "/admin/products", icon: Package },
  { label: "سفارش‌ها", href: "/admin/orders", icon: ShoppingCart },
  { label: "مصرف AI", href: "/admin/ai", icon: Sparkles },
  { label: "اتوماسیون", href: "/admin/automation", icon: Workflow },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout items={NAV} title="پنل مدیریت" badge="ادمین">{children}</DashboardLayout>;
}

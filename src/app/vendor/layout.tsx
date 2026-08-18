"use client";
import type { ReactNode } from "react";
import { LayoutDashboard, Package, ShoppingCart, Store, BarChart3, PlusCircle } from "lucide-react";
import { DashboardLayout, type NavItem } from "@/components/layout/DashboardLayout";

const NAV: NavItem[] = [
  { label: "داشبورد", href: "/vendor", icon: LayoutDashboard },
  { label: "محصولات", href: "/vendor/products", icon: Package },
  { label: "افزودن محصول", href: "/vendor/products/new", icon: PlusCircle },
  { label: "سفارش‌ها", href: "/vendor/orders", icon: ShoppingCart },
  { label: "فروشگاه", href: "/vendor/store", icon: Store },
  { label: "تحلیل و گزارش", href: "/vendor/analytics", icon: BarChart3 },
];

export default function VendorLayout({ children }: { children: ReactNode }) {
  return <DashboardLayout items={NAV} title="پنل فروشنده" badge="نور مبلمان">{children}</DashboardLayout>;
}

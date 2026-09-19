import type { Metadata } from "next";
import { storesRepository } from "@/repositories/stores";
import { StoresBrowser } from "./StoresBrowser";

// ============================================================
// /stores — فهرست فروشگاه‌ها روی دیتابیس واقعی (Task 60)
// فروشگاه‌های تازه‌تأییدِ بک‌اند بلافاصله در همین فهرست دیده می‌شوند؛
// بدون DB، همان فهرست نمونهٔ محلی (honest fallback).
// ============================================================

export const revalidate = 60;

export const metadata: Metadata = {
  title: "فروشگاه‌ها و برندها | هومینو",
  description: "فروشگاه‌های منتخب دکوراسیون و چیدمان خانه در هومینو — خرید از فروشگاه‌های تأییدشده.",
};

export default async function StoresPage() {
  const stores = await storesRepository.list();
  return <StoresBrowser stores={stores} />;
}

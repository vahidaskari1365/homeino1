import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "مجله Homeino — راهنمای خرید و ایده‌های خانه",
  description:
    "مقاله‌ها، راهنمای انتخاب، ترندها و ایده‌های الهام‌بخش برای خانه‌ای که دوست داری.",
  alternates: { canonical: "/magazine" },
  openGraph: {
    title: "مجله Homeino",
    description: "مقاله‌ها، راهنما و ایده‌های الهام‌بخش خانه.",
    type: "website",
    locale: "fa_IR",
    url: "/magazine",
  },
};

export default function MagazineLayout({ children }: { children: React.ReactNode }) {
  return children;
}

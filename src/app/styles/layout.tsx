import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "معرفی سبک‌های طراحی داخلی — راهنمای کامل انتخاب سبک",
  description:
    "سبک طراحی خانه‌ات را آگاهانه کشف کن؛ راهنمای حرفه‌ای رنگ، متریال، مبلمان، نورپردازی و تفاوت ۱۲ سبک دکوراسیون، همراه با محصولات هماهنگ.",
  alternates: { canonical: "/styles" },
  openGraph: {
    title: "معرفی سبک‌های طراحی داخلی — Homeino",
    description: "رنگ، متریال، مبلمان، نور و محصولات مناسب هر سبک را حرفه‌ای بشناس.",
    type: "website",
    locale: "fa_IR",
    url: "/styles",
  },
};

export default function StylesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

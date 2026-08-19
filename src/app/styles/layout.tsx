import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "سبک‌های طراحی داخلی — راهنما و محصولات پیشنهادی",
  description:
    "سبک طراحی خانه‌ی موردعلاقه‌ات را کشف کن؛ از مدرن و اسکاندیناوی تا کلاسیک و بوهو — با پالت، ویژگی‌ها و محصولات مناسب هر سبک.",
  alternates: { canonical: "/styles" },
  openGraph: {
    title: "سبک‌های طراحی داخلی — Homeino",
    description: "پالت، ویژگی و محصولات مناسب هر سبک.",
    type: "website",
    locale: "fa_IR",
    url: "/styles",
  },
};

export default function StylesLayout({ children }: { children: React.ReactNode }) {
  return children;
}

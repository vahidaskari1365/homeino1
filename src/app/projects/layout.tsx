import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "پروژه‌های طراحی داخلی واقعی",
  description: "پروژه‌های اجراشده با مشخصات، محصولات و راهنمای اقتباس در خانه‌ی خودت.",
  alternates: { canonical: "/projects" },
  openGraph: {
    title: "پروژه‌های واقعی — Homeino",
    description: "پروژه‌های اجراشده با محصولات و راهنمای اقتباس.",
    type: "website",
    locale: "fa_IR",
    url: "/projects",
  },
};

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

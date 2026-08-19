import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "بازارگاه دست دوم — خرید و فروش امن",
  description: "اجناس دست دوم با کیفیت، قیمت شفاف و ضمانت انتقال — از فروشندگان تأییدشده Homeino.",
  alternates: { canonical: "/second-hand" },
  openGraph: {
    title: "بازارگاه دست دوم — Homeino",
    description: "خرید و فروش امن اجناس دست دوم.",
    type: "website",
    locale: "fa_IR",
    url: "/second-hand",
  },
};

export default function SecondHandLayout({ children }: { children: React.ReactNode }) {
  return children;
}

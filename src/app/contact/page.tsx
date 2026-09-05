import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/shared";
import { Phone, Mail, MapPin, MessageCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "تماس با ما",
  description: "راه‌های ارتباط با تیم پشتیبانی هومینو: تلفن، ایمیل و شبکه‌های اجتماعی.",
  alternates: { canonical: "/contact" },
};

export default function ContactPage() {
  const phone = process.env.NEXT_PUBLIC_SUPPORT_PHONE;
  const email = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;
  const whatsapp = process.env.NEXT_PUBLIC_WHATSAPP_URL;
  const channels = [
    { icon: Phone, label: "تلفن پشتیبانی", value: phone, ltr: true, href: phone ? `tel:${phone}` : undefined },
    { icon: Mail, label: "ایمیل", value: email, ltr: true, href: email ? `mailto:${email}` : undefined },
    { icon: MessageCircle, label: "واتس‌اپ", value: whatsapp ? "پاسخ‌گویی در ساعات کاری" : undefined, ltr: false, href: whatsapp },
    { icon: MapPin, label: "نشانی", value: "تهران — دفتر مرکزی (پس از لانچ رسمی اعلام می‌شود)", ltr: false, href: undefined },
  ] as const;

  return (
    <Container className="py-10">
      <PageHeader title="تماس با ما" desc="هر سوالی داری بپرس — تیم هومینو پاسخ‌گوست" />
      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        {channels.map(({ icon: Icon, label, value, ltr, href }) => (
          <div key={label} className="card-surface flex items-start gap-3 p-5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ivory-2 text-terracotta"><Icon size={18} /></span>
            <div className="min-w-0">
              <div className="text-sm font-bold text-ink">{label}</div>
              {href && value ? (
                <a href={href} target={href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer" dir={ltr ? "ltr" : "rtl"} className="mt-1 block truncate text-sm text-terracotta-deep hover:underline">{value}</a>
              ) : (
                <p className="mt-1 text-sm text-ink-muted">{value ?? "به‌زودی فعال می‌شود"}</p>
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-8 max-w-3xl rounded-xl bg-sage/10 p-5 text-sm leading-7 text-success">
        ساعات پاسخ‌گویی: شنبه تا پنجشنبه، ۹ تا ۱۸. برای پیگیری سفارش، از بخش «سفارش‌های من» در حساب کاربری‌ات
        وضعیت لحظه‌ای مرسوله‌ها را ببین؛ برای موارد فوری، تلفن پشتیبانی در دسترس‌ترین راه است.
      </div>
    </Container>
  );
}

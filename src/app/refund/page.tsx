import type { Metadata } from "next";
import { Container, PageHeader } from "@/components/shared";

export const metadata: Metadata = {
  title: "رویه بازگشت کالا",
  description: "شرایط و مراحل بازگشت کالا در هومینو مطابق قانون حمایت از حقوق مصرف‌کنندگان.",
  alternates: { canonical: "/refund" },
};

const STEPS: [string, string][] = [
  ["۱. درخواست", "تا ۷ روز پس از تحویل، از بخش «سفارش‌های من» روی سفارش، گزینه‌ی بازگشت را انتخاب کن یا با پشتیبانی تماس بگیر. دلیل بازگشت را کوتاه بنویس."],
  ["۲. بررسی و هماهنگی", "تیم هومینو حداکثر تا ۲ روز کاری وضعیت درخواست را اعلام می‌کند و هماهنگی‌های ارسال را انجام می‌دهد؛ در مورد کالای معیوب، هزینه‌ی ارسال برگشتی با فروشنده است."],
  ["۳. بازرسی کالا", "کالا باید سالم، تمیز و در بسته‌بندی اصلی باشد. کالاهای سفارشی‌ساخت (مثلاً سایز خاص) و کالاهای بهداشتی بازشده، مشمول بازگشت نیستند."],
  ["۴. بازگشت وجه", "پس از تأیید بازرسی، وجه حداکثر تا ۷ روز کاری به همان کارت/حساب پرداخت‌شده برمی‌گردد. مبلغ کامل کالا + هزینه‌ی ارسال اولیه (در کالای معیوب) بازگردانده می‌شود."],
];

export default function RefundPage() {
  return (
    <Container className="py-10">
      <PageHeader title="رویه بازگشت کالا" desc="۷ روز ضمانت بی‌قیدوشرط بازگشت — طبق قانون حقوق مصرف‌کننده" />
      <div className="mx-auto max-w-3xl space-y-4">
        {STEPS.map(([title, body]) => (
          <div key={title} className="card-surface p-5">
            <div className="font-display font-bold text-ink">{title}</div>
            <p className="mt-1 leading-7 text-ink-muted">{body}</p>
          </div>
        ))}
        <div className="rounded-xl bg-gold/10 p-5 text-sm leading-7 text-ink">
          <strong>نکته مهم:</strong> اصالت کالا در هومینو شرط اصلی فروشندگان است. اگر کالای دریافتی با توضیحات صفحه‌ی
          محصول مغایرت داشت (جنس، ابعاد یا رنگ ثبت‌شده)، بدون هیچ قید زمانی حق بازگشت داری و هزینه‌ها کاملاً با فروشنده است.
        </div>
      </div>
    </Container>
  );
}

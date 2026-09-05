"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { CheckCircle2, Package, Home, Sparkles, Info } from "lucide-react";
import { Container } from "@/components/shared";
import { Button } from "@/components/ui/primitives";
import { toFa, formatPrice } from "@/lib/utils";
import { listLocalOrders, STATUS_LABEL } from "@/data/localOrders";

function SuccessInner() {
  const sp = useSearchParams();
  const order = listLocalOrders().find((o) => o.id === sp.get("order")) ?? null;

  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-sage/15"><CheckCircle2 size={44} className="text-success" /></div>
        <h1 className="font-display text-3xl font-black text-ink">سفارش شما ثبت شد! 🎉</h1>
        <p className="mt-2 text-ink-muted">ممنون از خریدت. سفارشت در حال پردازش است و هر فروشنده آن را جداگانه ارسال می‌کند.</p>

        <div className="mt-6 card-surface p-5 text-right">
          <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">شماره سفارش</span><span className="font-bold text-ink">#{toFa(order?.id ?? "")}</span></div>
          {order && (
            <>
              <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">وضعیت</span><span className="font-bold text-success">{STATUS_LABEL[order.status]}</span></div>
              <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">تعداد مرسوله</span><span className="font-bold text-ink">{toFa(order.parcels.length)}</span></div>
              <div className="flex justify-between py-2 text-sm"><span className="text-ink-muted">مبلغ</span><span className="font-bold text-ink">{toFa(formatPrice(order.total))} تومان</span></div>
            </>
          )}
          {!order && <div className="py-2 text-sm text-ink-muted">سفارش در این مرورگر یافت نشد.</div>}
        </div>

        {order && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-clay/40 bg-ivory-2 p-3 text-right text-[11px] leading-6 text-ink-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-terracotta-deep" />
            <span>سفارش در همین مرورگر ذخیره شد (دمو بدون دیتابیس) و می‌توانی آن را از «سفارش‌های من» لغو یا پیگیری کنی.</span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/account/orders"><Button><Package size={16} /> پیگیری سفارش</Button></Link>
          <Link href="/products"><Button variant="ghost">ادامه خرید</Button></Link>
          <Link href="/ai/design"><Button variant="outline"><Sparkles size={16} /> طراحی اتاق با AI</Button></Link>
        </div>
        <Link href="/" className="mt-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><Home size={15} /> بازگشت به خانه</Link>
      </div>
    </Container>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<Container className="py-20 text-center text-sm text-ink-muted">در حال بارگذاری…</Container>}><SuccessInner /></Suspense>;
}

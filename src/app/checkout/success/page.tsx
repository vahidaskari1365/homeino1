"use client";
import Link from "next/link";
import { CheckCircle2, Package, Home, Sparkles } from "lucide-react";
import { Container } from "@/components/shared";
import { Button } from "@/components/ui/primitives";
import { toFa } from "@/lib/utils";

// Generated once at module load (not during render) → keeps the component pure
const ORDER_NO = Math.floor(100000 + Math.random() * 900000);

export default function SuccessPage() {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-sage/15"><CheckCircle2 size={44} className="text-success" /></div>
        <h1 className="font-display text-3xl font-black text-ink">سفارش شما ثبت شد! 🎉</h1>
        <p className="mt-2 text-ink-muted">ممنون از خریدت. سفارشت در حال پردازش است و به‌زودی ارسال می‌شود.</p>

        <div className="mt-6 card-surface p-5 text-right">
          <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">شماره سفارش</span><span className="font-bold text-ink">#{toFa(ORDER_NO)}</span></div>
          <div className="flex justify-between py-2 text-sm"><span className="text-ink-muted">وضعیت</span><span className="font-bold text-success">در حال پردازش</span></div>
        </div>

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

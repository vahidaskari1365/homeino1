"use client";
import Link from "next/link";
import { CheckCircle2, Store, Home } from "lucide-react";
import { Container } from "@/components/shared";

export default function VendorRegisterDone() {
  return (
    <Container className="py-20">
      <div className="mx-auto max-w-md text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-sage/15"><CheckCircle2 size={42} className="text-success" /></div>
        <h1 className="font-display text-2xl font-black text-ink">درخواستت ثبت شد!</h1>
        <p className="mt-2 text-sm leading-7 text-ink-muted">فروشگاهت با وضعیت «در انتظار بررسی» در پنل مدیریت ثبت شد. کارشناسان Homeino به‌زودی با تو تماس می‌گیرند.</p>
        <div className="mt-6 flex justify-center gap-2 text-xs text-ink-muted">
          <Link href="/vendor" className="flex items-center gap-1.5 rounded-xl border border-clay/50 bg-ivory-2 px-4 py-2.5 text-ink transition hover:border-ink"><Store size={14} /> پنل فروشندهٔ نمونه</Link>
          <Link href="/admin/vendors" className="flex items-center gap-1.5 rounded-xl border border-clay/50 bg-ivory-2 px-4 py-2.5 text-ink transition hover:border-ink"><Home size={14} /> مدیریت فروشندگان</Link>
        </div>
        <p className="mt-6"><Link href="/" className="text-sm text-ink-muted underline">بازگشت به خانه</Link></p>
      </div>
    </Container>
  );
}

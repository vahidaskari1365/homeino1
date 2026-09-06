"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { CheckCircle2, Package, Home, Sparkles, Info } from "lucide-react";
import { Container } from "@/components/shared";
import { Button } from "@/components/ui/primitives";
import { toFa, formatPrice } from "@/lib/utils";
import { listLocalOrders, orderDisplayStatus, STATUS_LABEL, PAY_LABEL, SHIPPING_LABEL } from "@/data/localOrders";
import { destinationLine } from "@/lib/orderTracking";
import { fetchServerOrderByNumber } from "@/lib/commerceClient";

// Status → honest text tone (cancelled was green before — a lie).
const STATUS_TONE: Record<string, string> = {
  delivered: "text-success",
  shipping: "text-ink",
  processing: "text-ink",
  cancelled: "text-ink-muted",
};

/** Local order shape (demo) or server order shape (DB) — displayed uniformly. */
interface OrderView {
  id: string;
  status: string;
  total: number;
  parcels?: unknown[];
  shippingMethod?: string;
  payMethod?: string;
  destination?: string | null;
  source: "local" | "server";
}

function SuccessInner() {
  const sp = useSearchParams();
  const orderNumber = sp.get("order") ?? "";
  const [order, setOrder] = useState<OrderView | null>(null);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    if (!orderNumber) {
      const t = setTimeout(() => setSearched(true), 0);
      return () => clearTimeout(t);
    }
    // 1) Local demo order (guest / no-DB flow) — synchronous lookup, deferred
    // state update (no cascading render inside the effect body).
    const local = listLocalOrders().find((o) => o.id === orderNumber);
    if (local) {
      const t = setTimeout(() => {
        setOrder({
          id: local.id,
          status: orderDisplayStatus(local),
          total: local.total,
          parcels: local.parcels,
          shippingMethod: local.shippingMethod,
          payMethod: local.payMethod,
          destination: destinationLine(local),
          source: "local",
        });
        setSearched(true);
      }, 0);
      return () => clearTimeout(t);
    }
    // 2) Not local → a REAL server order (HO-…). Fetch it by number.
    let alive = true;
    (async () => {
      const res = await fetchServerOrderByNumber(orderNumber);
      if (!alive) return;
      if (res.ok) {
        const so = res.data as unknown as Record<string, unknown>;
        const addr = so.shippingAddress as { city?: string; line?: string; method?: string } | null;
        setOrder({
          id: String(so.orderNumber ?? orderNumber),
          status: String(so.status ?? "pending"),
          total: Number(so.total ?? 0),
          shippingMethod: addr?.method,
          destination: addr ? [addr.city, addr.line].filter(Boolean).join("، ") : null,
          source: "server",
        });
      }
      setSearched(true);
    })();
    return () => {
      alive = false;
    };
  }, [orderNumber]);

  const status = order?.status ?? null;

  return (
    <Container className="py-20">
      <div className="mx-auto max-w-lg text-center">
        <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full bg-sage/15"><CheckCircle2 size={44} className="text-success" /></div>
        <h1 className="font-display text-3xl font-black text-ink">سفارش شما ثبت شد! 🎉</h1>
        <p className="mt-2 text-ink-muted">ممنون از خریدت. سفارشت در حال پردازش است و هر فروشنده آن را جداگانه ارسال می‌کند.</p>

        <div className="mt-6 card-surface p-5 text-right">
          <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">شماره سفارش</span><span className="font-bold text-ink">#{toFa(orderNumber)}</span></div>
          {order && (
            <>
              <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">وضعیت</span><span className={`font-bold ${STATUS_TONE[status ?? ""] ?? "text-ink"}`}>{(STATUS_LABEL as Record<string, string>)[status ?? ""] ?? status}</span></div>
              {order.destination && <div className="flex justify-between gap-4 border-b border-clay/40 py-2 text-sm"><span className="shrink-0 text-ink-muted">تحویل به</span><span className="text-left font-medium text-ink">{order.destination}</span></div>}
              {order.shippingMethod && <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">ارسال</span><span className="font-bold text-ink">{SHIPPING_LABEL[order.shippingMethod] ?? order.shippingMethod}</span></div>}
              {order.payMethod && <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">پرداخت</span><span className="font-bold text-ink">{PAY_LABEL[order.payMethod] ?? order.payMethod}</span></div>}
              {order.parcels && <div className="flex justify-between border-b border-clay/40 py-2 text-sm"><span className="text-ink-muted">تعداد مرسوله</span><span className="font-bold text-ink">{toFa(order.parcels.length)}</span></div>}
              <div className="flex justify-between py-2 text-sm"><span className="text-ink-muted">مبلغ</span><span className="font-bold text-ink">{toFa(formatPrice(order.total))} تومان</span></div>
            </>
          )}
          {!order && searched && <div className="py-2 text-sm text-ink-muted">سفارش یافت نشد — اگر وارد حساب نشده بودی، سفارش در همین مرورگر ذخیره شده است.</div>}
        </div>

        {order && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-clay/40 bg-ivory-2 p-3 text-right text-xs leading-6 text-ink-muted">
            <Info size={14} className="mt-0.5 shrink-0 text-terracotta-deep" />
            <span>
              {order.source === "server"
                ? "سفارش در سرور ثبت شد و از «سفارش‌های من» در هر دستگاهی قابل پیگیری است. سفارش‌های در انتظار تأیید را می‌توانی از همان‌جا لغو کنی."
                : "سفارش در همین مرورگر ذخیره شد (دمو بدون دیتابیس) و می‌توانی آن را از «سفارش‌های من» لغو یا پیگیری کنی."}
            </span>
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/account/orders"><Button><Package size={16} /> پیگیری سفارش</Button></Link>
          <Link href="/products"><Button variant="ghost">ادامه خرید</Button></Link>
          <Link href="/ai/design"><Button variant="outline"><Sparkles size={16} /> طراحی اتاق با هومینو استودیو</Button></Link>
        </div>
        <Link href="/" className="mt-6 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"><Home size={15} /> بازگشت به خانه</Link>
      </div>
    </Container>
  );
}

export default function SuccessPage() {
  return <Suspense fallback={<Container className="py-20 text-center text-sm text-ink-muted">در حال بارگذاری…</Container>}><SuccessInner /></Suspense>;
}

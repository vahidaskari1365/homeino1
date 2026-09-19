"use client";
// ============================================================
// /vendor/messages — گفتگوی مشتریان (Task 60 — درخواست مالک)
//
// «پیغام جدید» مشتری از صفحهٔ فروشگاه اینجا می‌رسد (و تا فعال‌شدن
// پنل پیامک مالک، اعلان درون‌سایتی + وضعیت SMS صادقانه). فروشنده
// از همین صفحه پاسخ می‌دهد؛ پاسخ در صفحهٔ فروشگاه برای همان مشتری
// نمایش داده می‌شود.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { LogIn, MessageCircle, MessagesSquare, RefreshCw, Send, Info } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { cn, toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import {
  fetchVendorMessageThread,
  fetchVendorMessageThreads,
  isDemoFallback,
  replyToCustomer,
  faDate,
  type VendorMessageRow,
  type VendorThreadSummary,
} from "@/lib/vendorClient";

export default function VendorMessagesPage() {
  const { toast } = useUi();
  const [loading, setLoading] = useState(true);
  const [honest, setHonest] = useState<string | null>(null);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [threads, setThreads] = useState<VendorThreadSummary[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [threadItems, setThreadItems] = useState<VendorMessageRow[]>([]);
  const [threadLoading, setThreadLoading] = useState(false);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const loadThreads = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    const res = await fetchVendorMessageThreads();
    if (res.ok) {
      setThreads(res.data.threads);
      setHonest(null);
    } else if (isDemoFallback(res)) {
      setHonest("این بخش با اتصال واقعی سرور فعال می‌شود — در حالت دمو پیام واقعی وجود ندارد.");
    } else if (res.status === 401) {
      setAuthNeeded(true);
    } else {
      setHonest(res.message ?? "دریافت پیام‌ها ناموفق بود");
    }
    setLoading(false);
    return res;
  }, []);

  const openThread = useCallback(async (customerId: string) => {
    setSelected(customerId);
    setThreadLoading(true);
    const res = await fetchVendorMessageThread(customerId);
    setThreadLoading(false);
    if (res.ok) {
      setThreadItems(res.data.items);
      // خواندن پیام‌های مشتری سمت سرور ثبت شد — badge فهرست را صفر کن
      setThreads((prev) => prev.map((t) => (t.customerId === customerId ? { ...t, unread: 0 } : t)));
    } else if (!isDemoFallback(res)) {
      toast(res.message ?? "دریافت گفتگو ناموفق بود", "error");
    }
  }, [toast]);

  useEffect(() => {
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      // لینک اعلان «پیام مشتری»: /vendor/messages?customer=<uuid>
      const fromLink = new URLSearchParams(window.location.search).get("customer");
      const res = await loadThreads();
      if (!alive || !res.ok) return;
      if (fromLink && /^[0-9a-f-]{36}$/i.test(fromLink)) void openThread(fromLink);
      else if (res.data.threads.length === 1) void openThread(res.data.threads[0].customerId);
    })();
    return () => { alive = false; };
  }, [loadThreads, openThread]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [threadItems]);

  async function send() {
    if (!selected || !reply.trim() || sending) return;
    setSending(true);
    const res = await replyToCustomer(selected, reply.trim());
    setSending(false);
    if (res.ok) {
      setReply("");
      setThreadItems((prev) => [...prev, res.data.message]);
      setThreads((prev) => prev.map((t) =>
        t.customerId === selected
          ? { ...t, lastBody: res.data.message.body, lastSenderRole: "vendor", lastAt: res.data.message.createdAt }
          : t,
      ));
      toast("پاسخ ارسال شد", "success");
    } else {
      toast(res.message ?? "ارسال پاسخ ناموفق بود", "error");
    }
  }

  if (loading) {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت پیام‌ها…</div>;
  }

  if (authNeeded) {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">گفتگوی مشتریان فقط با حساب کاربریِ متصل به فروشگاه شما در دسترس است.</p>
        <a href="/login?next=%2Fvendor%2Fmessages" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }

  const activeThread = threads.find((t) => t.customerId === selected) ?? null;

  return (
    <div className="space-y-5">
      <div className="card-surface flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-terracotta/12 text-terracotta-deep"><MessagesSquare size={19} /></span>
          <div>
            <h1 className="font-display text-xl font-black text-ink">پیام‌های مشتریان</h1>
            <p className="text-xs text-ink-muted">گفتگوی مستقیم مشتری‌ها از صفحهٔ فروشگاه شما — پاسخ همین‌جا داده می‌شود.</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => void loadThreads(true)}><RefreshCw size={14} /> بروزرسانی</Button>
      </div>

      {honest && (
        <p className="flex items-start gap-2 rounded-xl border border-gold/30 bg-gold/8 px-4 py-3 text-xs leading-6 text-ink">
          <Info size={14} className="mt-0.5 shrink-0 text-gold" />
          <span>{honest}</span>
        </p>
      )}

      {!honest && threads.length === 0 ? (
        <div className="card-surface p-10 text-center">
          <MessageCircle size={26} className="mx-auto text-ink-muted" />
          <h2 className="mt-3 font-display text-base font-bold text-ink">هنوز گفتگویی ندارید</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">
            وقتی مشتری از صفحهٔ فروشگاه شما پیام بفرستد، همین‌جا می‌آید و اعلان آن به «اطلاع‌رسانی‌ها» هم می‌رود.
          </p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          {/* فهرست رشته‌ها */}
          <div className={cn("space-y-2", selected && "hidden lg:block")}>
            {threads.map((t) => (
              <button
                key={t.customerId}
                type="button"
                onClick={() => void openThread(t.customerId)}
                className={cn(
                  "card-surface w-full p-4 text-right transition-colors",
                  selected === t.customerId && "border-terracotta/50 bg-terracotta/5",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold text-ink">{t.customerName}</span>
                  {t.unread > 0 && (
                    <span className="grid h-5 min-w-5 place-items-center rounded-full bg-gold px-1.5 text-2xs font-bold text-ink">{toFa(t.unread)}</span>
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-xs leading-6 text-ink-muted">
                  {t.lastSenderRole === "vendor" ? "شما: " : ""}{t.lastBody}
                </p>
                <p className="mt-1 text-2xs text-ink-muted">{faDate(t.lastAt)}</p>
              </button>
            ))}
          </div>

          {/* گفتگوی فعال */}
          {selected && (
            <div className="card-surface flex max-h-[70vh] flex-col p-0">
              <div className="flex items-center justify-between gap-2 border-b border-clay/30 p-4">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink">{activeThread?.customerName ?? "مشتری"}</p>
                  {activeThread?.customerEmail && <p className="truncate text-2xs text-ink-muted">{activeThread.customerEmail}</p>}
                </div>
                <Button variant="ghost" className="lg:hidden" onClick={() => setSelected(null)}>بازگشت</Button>
              </div>
              <div className="min-h-40 flex-1 space-y-3 overflow-y-auto p-4">
                {threadLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-ink-muted"><Spinner /> در حال بارگذاری…</div>
                ) : threadItems.length === 0 ? (
                  <p className="py-8 text-center text-sm text-ink-muted">پیامی در این گفتگو نیست.</p>
                ) : (
                  threadItems.map((m) => (
                    <div key={m.id} className={cn("flex", m.senderRole === "vendor" ? "justify-start" : "justify-end")}>
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-7",
                        m.senderRole === "vendor"
                          ? "rounded-bl-md bg-ivory-2 text-ink"
                          : "rounded-br-md bg-terracotta/12 text-ink",
                      )}>
                        <p className="whitespace-pre-wrap">{m.body}</p>
                        <p className="mt-1 text-2xs text-ink-muted">{faDate(m.createdAt)}</p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={bottomRef} />
              </div>
              <div className="flex items-end gap-2 border-t border-clay/30 p-3">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
                  rows={2}
                  maxLength={2000}
                  placeholder="پاسخ خود را بنویسید…"
                  className="min-h-11 flex-1 resize-none rounded-xl border border-clay/50 bg-ivory px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-terracotta"
                />
                <Button disabled={!reply.trim() || sending} onClick={() => void send()} className="shrink-0">
                  {sending ? <Spinner /> : <Send size={14} />} ارسال
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

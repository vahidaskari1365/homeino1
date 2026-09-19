"use client";
// ============================================================
// StoreMessagePanel — گفتگوی مستقیم مشتری با فروشگاه (Task 60)
//
// «اگر خواستید برای پیام «پیغام جدید» بین مشتری و فروشنده هم چیزی بگذار»
// مشتری از همین باکس به فروشگاه پیام می‌دهد؛ پیام جدید در پنل فروشنده
// (اطلاع‌رسانی‌ها + پیام‌های مشتریان) می‌افتد و با فعال‌شدن پنل پیامک
// مالک، SMS هم برای فروشنده می‌رود. صداقت: بدون ورود → دعوت به ورود؛
// فروشگاه دمو → توضیح صادقانه؛ خطای واقعی → پیام واقعی.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { LogIn, MessagesSquare, Send } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { cn, toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";

interface MessageRow {
  id: string;
  senderRole: "customer" | "vendor";
  body: string;
  createdAt: string;
}

type Mode = "loading" | "ready" | "guest" | "demo" | "error";

export function StoreMessagePanel({
  slug,
  source,
  className,
}: {
  slug: string;
  source: "db" | "demo";
  className?: string;
}) {
  const { toast } = useUi();
  const [mode, setMode] = useState<Mode>("loading");
  const [errorText, setErrorText] = useState("");
  const [items, setItems] = useState<MessageRow[]>([]);
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // فروشگاه دمو (فیکسچر محلی) حساب واقعی ندارد — شبکه بلاخره صادقانه
    let alive = true;
    void (async () => {
      await Promise.resolve();
      if (!alive) return;
      if (source === "demo") { setMode("demo"); return; }
      try {
        const res = await fetch(`/api/stores/${encodeURIComponent(slug)}/messages`);
        const json = (await res.json().catch(() => null)) as
          | { ok: true; data: { items: MessageRow[] } }
          | { ok: false; error?: { message?: string } } | null;
        if (!alive) return;
        if (res.ok && json?.ok) {
          setItems(json.data.items);
          setMode("ready");
        } else if (res.status === 401) {
          setMode("guest");
        } else if (res.status === 404) {
          setMode("demo");
        } else {
          setErrorText(json && "error" in json && json.error?.message ? json.error.message : "دریافت گفتگو ناموفق بود");
          setMode("error");
        }
      } catch {
        if (alive) { setErrorText("ارتباط با سرور برقرار نشد"); setMode("error"); }
      }
    })();
    return () => { alive = false; };
  }, [slug, source]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [items]);

  const send = useCallback(async () => {
    const text = body.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      const res = await fetch(`/api/stores/${encodeURIComponent(slug)}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const json = (await res.json().catch(() => null)) as
        | { ok: true; data: { message: MessageRow } }
        | { ok: false; error?: { message?: string } } | null;
      if (res.ok && json?.ok) {
        setItems((prev) => [...prev, json.data.message]);
        setBody("");
        toast("پیام شما برای فروشگاه ارسال شد", "success");
      } else {
        toast(json && "error" in json && json.error?.message ? json.error.message : "ارسال پیام ناموفق بود", "error");
      }
    } catch {
      toast("ارتباط با سرور برقرار نشد", "error");
    } finally {
      setSending(false);
    }
  }, [body, sending, slug, toast]);

  const faTime = (iso: string) => {
    try {
      return new Intl.DateTimeFormat("fa-IR", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));
    } catch { return ""; }
  };

  return (
    <section className={cn("card-surface p-5", className)} aria-label="گفتگو با فروشگاه">
      <h2 className="flex items-center gap-2 font-display font-bold text-ink">
        <MessagesSquare size={18} className="text-terracotta-deep" /> گفتگو با فروشگاه
      </h2>

      {mode === "loading" && (
        <p className="mt-4 flex items-center gap-2 text-sm text-ink-muted"><Spinner /> در حال بررسی گفتگو…</p>
      )}

      {mode === "guest" && (
        <div className="mt-4">
          <p className="text-sm leading-7 text-ink-muted">
            برای گفتگوی مستقیم با این فروشگاه، ابتدا وارد حساب کاربری شوید — پیام شما مستقیم به پنل فروشگاه می‌رسد.
          </p>
          <a href={`/login?next=${encodeURIComponent(`/stores/${slug}`)}`} className="mt-3 inline-block">
            <Button variant="outline"><LogIn size={14} /> ورود برای ارسال پیام</Button>
          </a>
        </div>
      )}

      {mode === "demo" && (
        <p className="mt-4 text-sm leading-7 text-ink-muted">
          این فروشگاه نمونهٔ نمایشی است و پیام واقعی نمی‌پذیرد — فروشگاه‌های واقعیِ متصل به هومینو از همین بخش پاسخ می‌دهند.
        </p>
      )}

      {mode === "error" && (
        <p className="mt-4 text-sm leading-7 text-ink-muted">{errorText}</p>
      )}

      {mode === "ready" && (
        <>
          {items.length > 0 && (
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-xl bg-ivory-2/60 p-3">
              {items.map((m) => (
                <div key={m.id} className={cn("flex", m.senderRole === "customer" ? "justify-end" : "justify-start")}>
                  <div className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-7",
                    m.senderRole === "customer" ? "rounded-br-md bg-terracotta/12 text-ink" : "rounded-bl-md bg-ivory text-ink",
                  )}>
                    <p className="whitespace-pre-wrap">{m.body}</p>
                    <p className="mt-1 text-2xs text-ink-muted">{faTime(m.createdAt)}</p>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
          <div className="mt-4 flex items-end gap-2">
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); } }}
              rows={2}
              maxLength={2000}
              placeholder="سؤال خود را از فروشگاه بپرسید…"
              className="min-h-11 flex-1 resize-none rounded-xl border border-clay/50 bg-ivory px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-muted focus:border-terracotta"
            />
            <Button disabled={!body.trim() || sending} onClick={() => void send()} className="shrink-0">
              {sending ? <Spinner /> : <Send size={14} />} ارسال
            </Button>
          </div>
          <p className="mt-2 text-2xs text-ink-muted">
            پاسخ فروشگاه در همین بخش نمایش داده می‌شود{items.length > 0 ? ` — ${toFa(items.length)} پیام در این گفتگو` : ""}.
          </p>
        </>
      )}
    </section>
  );
}

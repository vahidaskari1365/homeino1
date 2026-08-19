"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, XCircle, Info, X, GitCompare, ArrowUp } from "lucide-react";
import { useUi, useCredits } from "@/stores/useApp";
import { useCompare } from "@/stores/useShop";
import { toFa } from "@/lib/utils";

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function GlobalChrome() {
  const { setAiPanel, toasts, dismissToast } = useUi();
  const balance = useCredits((state) => state.balance);
  const compareCount = useCompare((state) => state.ids.length);
  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 700);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {showTop && (
        <button onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} className="fixed bottom-24 right-4 z-30 grid h-11 w-11 place-items-center rounded-full bg-ink/90 text-cream shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-terracotta-deep active:scale-95 lg:bottom-6 lg:right-6" aria-label="بازگشت به بالای صفحه">
          <ArrowUp size={19} />
        </button>
      )}

      <button onClick={() => setAiPanel(true)} className="fixed bottom-6 left-6 z-40 hidden items-center gap-2 rounded-full bg-ink py-2.5 pl-4 pr-2.5 text-cream shadow-[var(--shadow-lift)] transition hover:-translate-y-0.5 hover:bg-terracotta-deep active:scale-95 lg:flex" aria-label="باز کردن دستیار هوشمند">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-terracotta"><Sparkles size={16} /></span><span className="text-sm font-bold">دستیار AI</span>
      </button>

      <div aria-live="polite" aria-relevant="additions" className="pointer-events-none fixed inset-x-3 bottom-24 z-[150] flex flex-col items-center gap-2 lg:inset-x-auto lg:bottom-6 lg:right-6 lg:items-end">
        {toasts.map((toast) => {
          const Icon = ICONS[toast.type ?? "success"];
          return (
            <div key={toast.id} role={toast.type === "error" ? "alert" : "status"} className="pointer-events-auto flex w-full max-w-sm animate-[fadeUp_.3s_ease] items-center gap-3 rounded-[var(--radius-md)] border border-clay/35 bg-cream px-3 py-2.5 text-sm text-ink shadow-[var(--shadow-card)]">
              <Icon size={18} className={toast.type === "error" ? "shrink-0 text-danger" : toast.type === "info" ? "shrink-0 text-info" : "shrink-0 text-success"} />
              <span className="min-w-0 flex-1 leading-6">{toast.text}</span>
              <button onClick={() => dismissToast(toast.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-ink-muted hover:bg-ivory-2 hover:text-ink" aria-label="بستن پیام"><X size={15} /></button>
            </div>
          );
        })}
      </div>

      {compareCount > 0 && (
        <div className="fixed inset-x-3 bottom-[4.6rem] z-30 flex min-w-0 items-center justify-between gap-3 rounded-[var(--radius-md)] border border-white/10 bg-ink px-3 py-2.5 text-cream shadow-[var(--shadow-lift)] sm:inset-x-auto sm:left-4 sm:w-[min(420px,calc(100vw-2rem))] lg:bottom-6 lg:left-auto lg:right-20">
          <span className="flex min-w-0 items-center gap-2 text-xs sm:text-sm"><GitCompare size={17} className="shrink-0 text-gold-soft" /><span className="truncate">{toFa(compareCount)} محصول آماده مقایسه</span></span>
          <Link href="/compare" className="shrink-0 rounded-lg bg-terracotta px-3 py-2 text-xs font-bold text-white transition hover:bg-terracotta-soft">مقایسه</Link>
        </div>
      )}

      <Link href="/account/credits" className="fixed right-4 top-[7.8rem] z-30 hidden items-center gap-1.5 rounded-full border border-clay/45 bg-cream/92 px-3 py-2 text-xs font-bold text-ink shadow-sm backdrop-blur transition hover:border-gold lg:flex">
        <Sparkles size={13} className="text-gold" /> {toFa(balance)} اعتبار
      </Link>
    </>
  );
}

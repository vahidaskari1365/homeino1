"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle2, XCircle, Info, X, GitCompare, ArrowUp } from "lucide-react";
import { useUi, useCredits } from "@/stores/useApp";
import { useCompare } from "@/stores/useShop";
import { toFa } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";

const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

/** Floating AI button + scroll-to-top + toast stack + compare bar.
 *  Also owns the ONE-TIME rehydration of every persisted store: zustand's
 *  persist rehydrates at module init on the client, which makes badge
 *  counts (cart/wishlist/credits) differ from the SSR HTML → hydration
 *  mismatch. `skipHydration: true` + rehydrate here (post-mount) fixes it. */
export function GlobalChrome() {
  const { setAiPanel, toasts, dismissToast } = useUi();
  const balance = useCredits((s) => s.balance);
  const cmpCount = useCompare((s) => s.ids.length);
  const [showTop, setShowTop] = useState(false);
  const hydrated = useHasHydrated();

  useEffect(() => {
    import("@/stores/hydration").then(({ rehydratePersistedStores }) => rehydratePersistedStores());
  }, []);

  // 0 until hydration → identical SSR/client first paint, no mismatch.
  const hydratedBalance = hydrated ? balance : 0;

  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      {/* Scroll to top */}
      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-36 right-5 z-40 grid h-11 w-11 place-items-center rounded-full bg-ink/80 text-cream shadow-[var(--shadow-card)] backdrop-blur transition hover:bg-ink active:scale-90 lg:bottom-6 lg:right-6"
          aria-label="بازگشت به بالا"
        >
          <ArrowUp size={20} />
        </button>
      )}

      {/* Floating AI button */}
      <button
        onClick={() => setAiPanel(true)}
        className="fixed bottom-20 left-5 z-40 flex items-center gap-2 rounded-full bg-ink py-3 pl-4 pr-3 text-cream shadow-[var(--shadow-lift)] transition hover:scale-105 active:scale-95 lg:bottom-6 lg:left-6"
        aria-label="دستیار هومینو"
      >
        <span className="grid h-8 w-8 place-items-center rounded-full bg-terracotta"><Sparkles size={17} /></span>
        <span className="hidden text-sm font-medium sm:inline">دستیار هومینو</span>
      </button>

      {/* Toasts */}
      <div role="status" aria-live="polite" className="fixed bottom-24 right-4 z-[120] flex flex-col gap-2 lg:bottom-6 lg:right-6">
        {toasts.map((t) => {
          const Icon = ICONS[t.type ?? "success"];
          return (
            <div key={t.id} className="flex animate-[fadeUp_0.3s_ease] items-center gap-2 rounded-xl border border-clay/40 bg-cream px-4 py-3 text-sm text-ink shadow-[var(--shadow-card)]">
              <Icon size={17} className={t.type === "error" ? "text-danger" : t.type === "info" ? "text-info" : "text-sage"} />
              <span>{t.text}</span>
              <button onClick={() => dismissToast(t.id)} className="text-ink-muted hover:text-ink"><X size={14} /></button>
            </div>
          );
        })}
      </div>

      {/* Compare bar */}
      {cmpCount > 0 && (
        <div className="fixed inset-x-0 bottom-32 z-40 mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-clay/40 bg-ink px-4 py-3 text-cream shadow-[var(--shadow-lift)] sm:bottom-6 lg:mx-6 lg:right-6 lg:left-auto lg:w-auto lg:translate-x-0" style={{ margin: "0 1rem" }}>
          <span className="flex items-center gap-2 text-sm"><GitCompare size={17} /> {toFa(cmpCount)} محصول برای مقایسه</span>
          <Link href="/compare" className="rounded-lg bg-terracotta px-4 py-1.5 text-sm font-medium text-white transition hover:bg-terracotta-deep">مقایسه</Link>
        </div>
      )}

      {/* credit chip (top-left hint) */}
      <Link href="/account/credits" className="fixed right-4 top-20 z-30 hidden items-center gap-1.5 rounded-full border border-clay/50 bg-cream/90 px-3 py-1.5 text-xs font-medium text-ink shadow-sm backdrop-blur transition hover:border-ink lg:flex">
        <Sparkles size={13} className="text-terracotta-deep" /> {toFa(hydratedBalance)} اعتبار
      </Link>

    </>
  );
}

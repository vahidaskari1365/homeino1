"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Gift, Copy, Check, X } from "lucide-react";
import { fetchMarketingStats } from "@/lib/commerceClient";
import { CountdownTimer } from "./CountdownTimer";
import { toFa } from "@/lib/utils";

const STORAGE_KEY = "homeino:exit-shown";

/**
 * Exit-intent popup (desktop) — fires ONCE per session, only when the
 * campaign is genuinely live in the DB, and never fakes a deadline.
 */
export function ExitIntentPopup() {
  const [campaign, setCampaign] = useState<{ code: string; percentOff: number; endsAt: string | null } | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        if (sessionStorage.getItem(STORAGE_KEY)) return; // already shown this session
      } catch { /* private mode → still allowed */ }
    }
    let alive = true;
    const startedAt = Date.now();
    fetchMarketingStats().then((res) => {
      if (!alive) return;
      if (res.ok && res.data.campaign?.active) setCampaign(res.data.campaign);
    });

    const onLeave = (e: MouseEvent) => {
      if (!campaign || e.clientY > 0) return;
      if (Date.now() - startedAt < 8_000) return; // avoid instant popups
      setOpen(true);
      try {
        sessionStorage.setItem(STORAGE_KEY, "1");
      } catch { /* ignore */ }
      document.removeEventListener("mouseout", onLeave);
    };
    document.addEventListener("mouseout", onLeave);
    return () => {
      alive = false;
      document.removeEventListener("mouseout", onLeave);
    };
  }, [campaign]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open || !campaign) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(campaign.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* code visible anyway */ }
  };

  return (
    <div
      className="fixed inset-0 z-[130] grid place-items-center bg-ink/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="پیشنهاد ویژه"
      onClick={() => setOpen(false)}
    >
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[var(--radius-xl)] bg-cream p-6 text-center shadow-[var(--shadow-lift)] sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button onClick={() => setOpen(false)} className="absolute left-3 top-3 text-ink-muted transition hover:text-ink" aria-label="بستن">
          <X size={18} />
        </button>
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-terracotta-deep">
          <Gift size={28} />
        </span>
        <h3 className="mt-3 font-display text-xl font-black text-ink">
          یک لحظه صبر کن! {toFa(campaign.percentOff)}٪ تخفیف مال تو
        </h3>
        <p className="mt-2 text-sm leading-6 text-ink-muted">
          همین حالا اعتبار هومینو استودیو را با کد زیر ارزان‌تر بگیر — قبل از تمام شدن کمپین.
        </p>
        <button
          onClick={copy}
          className="mx-auto mt-4 flex items-center gap-2 rounded-xl border-2 border-dashed border-terracotta/60 bg-terracotta/5 px-5 py-2.5 font-display text-lg font-black tracking-widest text-terracotta-deep transition hover:bg-terracotta/10"
          aria-label={`کپی کد ${campaign.code}`}
        >
          {campaign.code}
          {copied ? <Check size={17} className="text-success" /> : <Copy size={17} />}
        </button>
        {campaign.endsAt && (
          <div className="mt-3 flex justify-center">
            <div className="rounded-xl bg-ink px-3 py-2">
              <CountdownTimer endsAt={campaign.endsAt} size="sm" />
            </div>
          </div>
        )}
        <Link
          href="/account/credits"
          className="mt-5 block rounded-xl bg-terracotta px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-soft)] transition hover:bg-terracotta-deep"
        >
          دریافت تخفیف
        </Link>
        <button onClick={() => setOpen(false)} className="mt-2 text-2xs text-ink-muted transition hover:text-ink">
          الان نمی‌خواهم
        </button>
      </div>
    </div>
  );
}

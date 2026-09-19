"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Flame, Sparkles, Copy, Check } from "lucide-react";
import { fetchMarketingStats } from "@/lib/commerceClient";
import { CountdownTimer } from "./CountdownTimer";
import { toFa, cn } from "@/lib/utils";

/**
 * Campaign banner — REAL scarcity: the countdown and the remaining count
 * both come from the DB coupon row. When the campaign is over (or data is
 * unavailable) the banner disappears entirely. Never fake urgency.
 */
export function PromoBanner({ compact = false }: { compact?: boolean }) {
  const [campaign, setCampaign] = useState<{
    code: string;
    percentOff: number;
    label: string;
    endsAt: string | null;
    remaining: number | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchMarketingStats().then((res) => {
      if (!alive) return;
      if (res.ok && res.data.campaign?.active) setCampaign(res.data.campaign);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!campaign) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(campaign.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — code is visible anyway */
    }
  };

  if (compact) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-gold/40 bg-gradient-to-l from-ink to-terracotta-deep px-4 py-3 text-cream">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Flame size={17} className="text-gold-soft" />
          {toFa(campaign.percentOff)}٪ تخفیف خرید اعتبار با کد
          <button onClick={copy} className="flex items-center gap-1 rounded-lg bg-white/12 px-2 py-1 font-display text-xs tracking-wider transition hover:bg-white/20" aria-label={`کپی کد ${campaign.code}`}>
            {campaign.code}
            {copied ? <Check size={13} className="text-sage" /> : <Copy size={13} />}
          </button>
        </div>
        {campaign.endsAt && <CountdownTimer endsAt={campaign.endsAt} size="sm" />}
      </div>
    );
  }

  return (
    <section aria-label="کمپین ویژه" className="py-4">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8">
        <div className={cn(
          "relative overflow-hidden rounded-[var(--radius-lg)] bg-gradient-to-l from-ink via-terracotta-deep to-ink p-4 text-cream shadow-[var(--shadow-card)] sm:p-5",
        )}>
          <div className="grain absolute inset-0 opacity-20" />
          <div className="relative flex flex-col items-center justify-between gap-3 sm:flex-row">
            <div className="flex items-center gap-3 text-center sm:text-right">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold-soft"><Sparkles size={22} /></span>
              <div>
                <div className="font-display text-base font-black sm:text-lg">
                  {toFa(campaign.percentOff)}٪ تخفیف خرید اعتبار — کمپین راه‌اندازی
                </div>
                <div className="mt-0.5 flex flex-wrap items-center justify-center gap-2 text-xs text-cream/70 sm:justify-start">
                  <button onClick={copy} className="flex items-center gap-1 rounded-lg border border-white/25 bg-white/10 px-2.5 py-1 font-display font-bold tracking-wider transition hover:bg-white/20" aria-label={`کپی کد ${campaign.code}`}>
                    کد: {campaign.code}
                    {copied ? <Check size={13} className="text-sage" /> : <Copy size={13} />}
                  </button>
                  {campaign.remaining != null && campaign.remaining > 0 && (
                    <span className="rounded-full bg-gold/15 px-2 py-0.5 font-bold text-gold-soft">
                      فقط {toFa(campaign.remaining)} نفر اول
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {campaign.endsAt && <CountdownTimer endsAt={campaign.endsAt} />}
              <Link href="/account/credits" className="rounded-xl bg-gold px-4 py-2 text-sm font-black text-ink shadow transition hover:brightness-110">
                دریافت تخفیف
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

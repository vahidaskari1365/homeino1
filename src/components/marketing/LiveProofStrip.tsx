"use client";
import { useEffect, useState } from "react";
import { Sparkles, Users, TrendingUp } from "lucide-react";
import { fetchMarketingStats } from "@/lib/commerceClient";
import { toFa } from "@/lib/utils";

/**
 * Live social-proof strip — REAL counters from the DB (designs in the last
 * 24h + all-time). Hidden entirely when there is nothing real to show.
 */
export function LiveProofStrip() {
  const [stats, setStats] = useState<{ todayDesigns: number; totalDesigns: number } | null>(null);

  useEffect(() => {
    let alive = true;
    fetchMarketingStats().then((res) => {
      if (alive && res.ok) setStats({ todayDesigns: res.data.todayDesigns, totalDesigns: res.data.totalDesigns });
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!stats || (stats.todayDesigns === 0 && stats.totalDesigns === 0)) return null;

  const items = [
    stats.todayDesigns > 0
      ? { icon: TrendingUp, text: `${toFa(stats.todayDesigns)} طراحی در ۲۴ ساعت گذشته` }
      : null,
    stats.totalDesigns > 0
      ? { icon: Sparkles, text: `${toFa(stats.totalDesigns)} فضا تا امروز با هومینو طراحی شده` }
      : null,
    { icon: Users, text: "همراه فروشگاه‌های منتخب و معتبر دکوراسیون" },
  ].filter(Boolean) as { icon: typeof TrendingUp; text: string }[];

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl border border-clay/35 bg-cream/60 px-5 py-3" role="status">
      {items.map(({ icon: Icon, text }) => (
        <span key={text} className="flex items-center gap-1.5 text-xs font-bold text-ink sm:text-sm">
          <Icon size={15} className="text-terracotta-deep" /> {text}
        </span>
      ))}
    </div>
  );
}

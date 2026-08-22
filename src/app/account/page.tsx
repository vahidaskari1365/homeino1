"use client";
import Link from "next/link";
import { Sparkles, Package, Heart, Wand2, TrendingUp, ArrowLeft } from "lucide-react";
import { Button, LogoBlock, Badge } from "@/components/ui/primitives";
import { useAuth, useCredits } from "@/stores/useApp";
import { useWishlist, useCart } from "@/stores/useShop";
import { aiDesigns } from "@/data/inspirations";
import { products } from "@/data/products";
import { toFa } from "@/lib/utils";

export default function AccountOverview() {
  const user = useAuth((s) => s.user);
  const balance = useCredits((s) => s.balance);
  const wish = useWishlist((s) => s.total());
  const cart = useCart((s) => s.items.length);

  const stats = [
    { label: "اعتبار AI", value: toFa(balance), icon: Sparkles, color: "text-gold" },
    { label: "سفارش‌ها", value: toFa(3), icon: Package, color: "text-terracotta-deep" },
    { label: "علاقه‌مندی", value: toFa(wish), icon: Heart, color: "text-danger" },
    { label: "سبد خرید", value: toFa(cart), icon: TrendingUp, color: "text-sage" },
  ];

  return (
    <div className="space-y-6">
      <div className="card-surface flex flex-wrap items-center gap-4 p-6">
        <LogoBlock char={user?.avatar ?? "م"} color="var(--color-ink)" size={56} />
        <div className="flex-1">
          <h1 className="font-display text-xl font-black text-ink">سلام، {user?.name} 👋</h1>
          <p className="text-sm text-ink-muted">{user?.email}</p>
        </div>
        <Link href="/ai/design"><Button><Wand2 size={16} /> طراحی جدید</Button></Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card-surface p-5">
            <s.icon size={22} className={s.color} />
            <div className="mt-2 font-display text-2xl font-black text-ink">{s.value}</div>
            <div className="text-xs text-ink-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* recent designs */}
        <div className="card-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-ink">طراحی‌های اخیر</h3>
            <Link href="/account/designs" className="text-sm text-terracotta-deep">همه ←</Link>
          </div>
          <div className="space-y-3">
            {aiDesigns.slice(0, 3).map((d) => (
              <Link key={d.id} href={`/ai/result/${d.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-ivory-2">
                <img src={d.afterImage} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{d.title}</div><div className="text-xs text-ink-muted">{d.createdAt}</div></div>
                <Badge tone="gold">{toFa(d.creditsUsed)}</Badge>
              </Link>
            ))}
          </div>
        </div>
        {/* recommendations */}
        <div className="card-surface p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display font-bold text-ink">پیشنهادها برای تو</h3>
            <Link href="/products" className="text-sm text-terracotta-deep">بیشتر ←</Link>
          </div>
          <div className="space-y-3">
            {products.filter((p) => p.aiRecommended).slice(0, 3).map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-ivory-2">
                <img src={p.images[0]} alt="" className="h-12 w-12 rounded-lg object-cover" />
                <div className="min-w-0 flex-1"><div className="truncate text-sm font-medium text-ink">{p.name}</div><div className="text-xs text-ink-muted">{p.brand}</div></div>
                <ArrowLeft size={15} className="text-ink-muted" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

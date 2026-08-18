"use client";
import { use, useState } from "react";
import { notFound } from "next/navigation";
import { BadgeCheck, MapPin, Package, Star } from "lucide-react";
import { Container, Breadcrumb, ProductGrid } from "@/components/shared";
import { Button, LogoBlock, Rating, Chip } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getStore, stores } from "@/data/stores";
import { productsByStore } from "@/data/products";
import { useWishlist } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";

export default function StoreDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const store = getStore(slug);
  if (!store) notFound();
  const products = productsByStore(store!.id);
  const [sort, setSort] = useState<"all" | "trending" | "discount">("all");
  const wl = useWishlist(); const { toast } = useUi();
  const wished = wl.stores.includes(store!.id);
  const list = products.filter((p) => sort === "all" ? true : sort === "trending" ? p.trending : p.oldPrice);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "فروشگاه‌ها", href: "/stores" }, { label: store!.name }]} />

      <Reveal>
        <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
          <SmartImage src={store!.cover} alt={store!.name} className="h-48 w-full sm:h-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-ink/20" />
        </div>
        <div className="relative -mt-12 flex flex-col items-start gap-4 px-1 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <div className="card-surface p-2"><LogoBlock char={store!.logo} color={store!.logoColor} size={72} /></div>
            <div className="pb-1">
              <div className="flex items-center gap-2">
                <h1 className="font-display text-2xl font-black text-ink">{store!.name}</h1>
                {store!.verified && <BadgeCheck size={20} className="text-sage" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-ink-muted">
                <span className="flex items-center gap-1"><MapPin size={14} /> {store!.city}</span>
                <span className="flex items-center gap-1"><Package size={14} /> {toFa(store!.productCount)} محصول</span>
                <span className="flex items-center gap-1"><Star size={14} className="fill-gold text-gold" /> {toFa(store!.rating.toFixed(1))} ({toFa(store!.reviewsCount)})</span>
              </div>
            </div>
          </div>
          <Button variant={wished ? "primary" : "outline"} onClick={() => { wl.toggleStore(store!.id); toast(wished ? "حذف شد" : "فروشگاه دنبال شد"); }} className="mb-2">
            {wished ? "دنبال می‌کنی ✓" : "دنبال کردن فروشگاه"}
          </Button>
        </div>
      </Reveal>

      <p className="mt-6 max-w-2xl leading-8 text-ink-muted">{store!.description}</p>

      <div className="mt-6 flex flex-wrap gap-2">
        {[["all", "همه"], ["trending", "محبوب‌ها"], ["discount", "تخفیف‌دار"]].map(([k, l]) => (
          <Chip key={k} active={sort === k} onClick={() => setSort(k as typeof sort)}>{l}</Chip>
        ))}
      </div>

      <div className="mt-6"><ProductGrid products={list} /></div>
    </Container>
  );
}

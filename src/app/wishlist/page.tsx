"use client";
import { useState } from "react";
import Link from "next/link";
import { Heart, Package, ImageIcon, Sparkles, Store as StoreIcon, Lightbulb, FolderHeart } from "lucide-react";
import { Container, PageHeader, ProductGrid } from "@/components/shared";
import { ButtonLink, EmptyState, Tabs } from "@/components/ui/primitives";
import { StoreCard, InspirationCard } from "@/components/cards";
import { useWishlist } from "@/stores/useShop";
import { getProductById } from "@/data/products";
import { getInspiration } from "@/data/inspirations";
import { getAiDesign } from "@/data/inspirations";
import { getStoreById } from "@/data/stores";
import { toFa } from "@/lib/utils";

const TABS = [
  { id: "products", label: "محصولات", icon: Package },
  { id: "inspirations", label: "الهام", icon: ImageIcon },
  { id: "designs", label: "طراحی‌های AI", icon: Sparkles },
  { id: "stores", label: "فروشگاه‌ها", icon: StoreIcon },
] as const;

export default function WishlistPage() {
  const wl = useWishlist();
  const [tab, setTab] = useState<typeof TABS[number]["id"]>("products");

  const products = wl.products.map((id) => getProductById(id)).filter(Boolean);
  const insp = wl.inspirations.map((id) => getInspiration(id)).filter(Boolean);
  const designs = wl.designs.map((id) => getAiDesign(id)).filter(Boolean);
  const stores = wl.stores.map((id) => getStoreById(id)).filter(Boolean);
  const count = { products: products.length, inspirations: insp.length, designs: designs.length, stores: stores.length };

  return (
    <Container className="py-10">
      <PageHeader eyebrow="فضای شخصی من" title="ذخیره‌های من" desc={`در مجموع ${toFa(wl.total())} مورد ذخیره شده.`} action={<ButtonLink href="/collections" variant="outline"><FolderHeart size={17} /> مدیریت کالکشن‌ها</ButtonLink>} />

      <Tabs items={TABS.map((item) => ({ ...item, count: count[item.id] }))} value={tab} onChange={setTab} ariaLabel="نوع علاقه‌مندی" className="mb-8" />

      {tab === "products" && (products.length ? (
        <>
          {/* WISHLIST INTELLIGENCE — analyze saved products */}
          <div className="mb-4 space-y-2 rounded-xl border border-gold/25 bg-gold/5 p-3">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div className="flex items-center gap-2"><Sparkles size={16} className="shrink-0 text-gold" /><p className="text-xs text-ink-muted">می‌خوای این محصولات رو با هم توی خونه‌ات ببینی؟</p></div>
              <ButtonLink href="/ai/design" size="sm" variant="accent" className="w-full sm:w-auto">طراحی با این وسایل</ButtonLink>
            </div>
            {/* Style analysis */}
            {(() => {
              const styleCounts: Record<string, number> = {};
              products.forEach((p) => { p?.styleSlugs.forEach((s) => { styleCounts[s] = (styleCounts[s] || 0) + 1; }); });
              const topStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]).slice(0, 2);
              if (topStyles.length > 0) {
                const labels: Record<string, string> = { modern: "مدرن", scandinavian: "اسکاندیناوی", minimalist: "مینیمال", japandi: "ژاپندی", classic: "کلاسیک", luxury: "لوکس", industrial: "صنعتی", bohemian: "بوهمی", rustic: "روستیک", contemporary: "معاصر" };
                return (
                  <p className="flex items-center gap-1 text-[11px] text-ink-muted"><Lightbulb size={12} className="text-gold" /> {toFa(products.length)} محصول ذخیره کرده‌ای که عمدتاً با سبک <b className="text-ink">{topStyles.map(([s]) => labels[s] || s).join(" و ")}</b> هماهنگ هستند.</p>
                );
              }
              return null;
            })()}
          </div>
          <ProductGrid products={products as never} />
        </>
      ) : <EmptyState icon={<Heart size={28} />} title="محصولی ذخیره نکرده‌ای" action={<ButtonLink href="/products">کاوش محصولات</ButtonLink>} />)}
      {tab === "inspirations" && (insp.length ? <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">{insp.map((i, idx) => i && <InspirationCard key={i.id} insp={i} index={idx} />)}</div> : <EmptyState icon={<ImageIcon size={28} />} title="ایده‌ای ذخیره نکرده‌ای" action={<ButtonLink href="/inspiration">گالری الهام</ButtonLink>} />)}
      {tab === "designs" && (designs.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => d && (
            <Link key={d.id} href={`/ai/result/${d.id}`} className="card-surface overflow-hidden">
              <img src={d.afterImage} alt={d.title} className="aspect-video w-full object-cover" />
              <div className="p-4"><div className="text-xs text-ink-muted">{d.room}</div><div className="font-display font-bold text-ink">{d.title}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState icon={<Sparkles size={28} />} title="طراحی AI‌ای ذخیره نکرده‌ای" action={<ButtonLink href="/ai">ورود به AI استودیو</ButtonLink>} />)}
      {tab === "stores" && (stores.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{stores.map((s) => s && <StoreCard key={s.id} store={s} />)}</div> : <EmptyState icon={<StoreIcon size={28} />} title="فروشگاهی دنبال نمی‌کنی" action={<ButtonLink href="/stores">کاوش فروشگاه‌ها</ButtonLink>} />)}
    </Container>
  );
}

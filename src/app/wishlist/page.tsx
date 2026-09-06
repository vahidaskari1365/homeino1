"use client";
import { useState } from "react";
import Link from "next/link";
import { Heart, Package, ImageIcon, Sparkles, Store as StoreIcon, Lightbulb } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { Button, EmptyState } from "@/components/ui/primitives";
import { StoreCard, InspirationCard } from "@/components/cards";
import { useWishlist } from "@/stores/useShop";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { getProductById } from "@/data/products";
import { getStyle } from "@/data/styles";
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
  const hydrated = useHasHydrated();
  const sessions = useDesignSessions((s) => s.sessions);

  const products = wl.products.map((id) => getProductById(id)).filter(Boolean);
  const insp = wl.inspirations.map((id) => getInspiration(id)).filter(Boolean);
  // Saved AI designs: real persisted sessions first, then the fixture seeds —
  // a saved ds_* id used to land in a black hole and never render.
  const designs = [
    ...(hydrated ? sessions.filter((s) => wl.designs.includes(s.id)).map((s) => ({ id: s.id, title: s.title, afterImage: s.afterImage, room: s.roomType })) : []),
    ...wl.designs.flatMap((id) => {
      const d = getAiDesign(id);
      return d ? [{ id: d.id, title: d.title, afterImage: d.afterImage, room: d.room }] : [];
    }),
  ];
  const stores = wl.stores.map((id) => getStoreById(id)).filter(Boolean);
  const count = { products: products.length, inspirations: insp.length, designs: designs.length, stores: stores.length };

  return (
    <Container className="py-10">
      <PageHeader eyebrow="حساب کاربری" title="علاقه‌مندی‌های من" desc={`در مجموع ${toFa(wl.total())} مورد ذخیره شده.`} />

      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition ${tab === t.id ? "border-ink bg-ink text-cream" : "border-clay/60 text-ink hover:border-ink"}`}>
            <t.icon size={15} /> {t.label} <span className="text-xs opacity-60">{toFa(count[t.id])}</span>
          </button>
        ))}
      </div>

      {tab === "products" && (products.length ? (
        <>
          {/* WISHLIST INTELLIGENCE — analyze saved products */}
          <div className="mb-4 space-y-2 rounded-xl border border-gold/25 bg-gold/5 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><Sparkles size={16} className="text-gold" /><p className="text-xs text-ink-muted">می‌خوای این محصولات رو با هم توی خونه‌ات ببینی؟</p></div>
              <Link href="/ai/design"><Button size="sm" className="btn-accent">طراحی با این وسایل</Button></Link>
            </div>
            {/* Style analysis */}
            {(() => {
              const styleCounts: Record<string, number> = {};
              products.forEach((p) => { p?.styleSlugs.forEach((s) => { styleCounts[s] = (styleCounts[s] || 0) + 1; }); });
              const topStyles = Object.entries(styleCounts).sort((a, b) => b[1] - a[1]).slice(0, 2);
              if (topStyles.length > 0) {
                return (
                  <p className="flex items-center gap-1 text-2xs text-ink-muted"><Lightbulb size={12} className="text-gold" /> {toFa(products.length)} محصول ذخیره کرده‌ای که عمدتاً با سبک <b className="text-ink">{topStyles.map(([slug]) => getStyle(slug)?.name ?? slug).join(" و ")}</b> هماهنگ هستند.</p>
                );
              }
              return null;
            })()}
          </div>
          <FilterableProductGrid
            products={products.filter((product) => product != null)}
            layout="compact"
            emptyDescription="فیلتر سبک یا سایر فیلترهای علاقه‌مندی‌ها را تغییر بده."
          />
        </>
      ) : <EmptyState icon={<Heart size={28} />} title="محصولی ذخیره نکرده‌ای" action={<Link href="/products"><Button>کاوش محصولات</Button></Link>} />)}
      {tab === "inspirations" && (insp.length ? <div className="columns-2 gap-4 sm:columns-3 lg:columns-4 [&>*]:mb-4">{insp.map((i, idx) => i && <InspirationCard key={i.id} insp={i} index={idx} />)}</div> : <EmptyState icon={<ImageIcon size={28} />} title="ایده‌ای ذخیره نکرده‌ای" action={<Link href="/inspiration"><Button>گالری الهام</Button></Link>} />)}
      {tab === "designs" && (designs.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <Link key={d.id} href={`/ai/result/${d.id}`} className="card-surface overflow-hidden">
              <img src={d.afterImage} alt={d.title} className="aspect-video w-full object-cover" />
              <div className="p-4"><div className="text-xs text-ink-muted">{d.room}</div><div className="font-display font-bold text-ink">{d.title}</div></div>
            </Link>
          ))}
        </div>
      ) : <EmptyState icon={<Sparkles size={28} />} title="طراحی هومینو استودیو ذخیره نکرده‌ای" action={<Link href="/ai/design"><Button>ورود به هومینو استودیو</Button></Link>} />)}
      {tab === "stores" && (stores.length ? <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">{stores.map((s) => s && <StoreCard key={s.id} store={s} />)}</div> : <EmptyState icon={<StoreIcon size={28} />} title="فروشگاهی دنبال نمی‌کنی" action={<Link href="/stores"><Button>کاوش فروشگاه‌ها</Button></Link>} />)}
    </Container>
  );
}

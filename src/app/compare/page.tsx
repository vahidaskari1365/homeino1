"use client";
import Link from "next/link";
import { GitCompare, X, Check, BadgeCheck, Truck, RotateCcw } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, ButtonLink, EmptyState, Rating, Price } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCompare, useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { getProductById } from "@/data/products";
import { getStoreById } from "@/data/stores";
import { getBestOffer } from "@/data/offers";
import { PLATFORM } from "@/config/platform";
import { toFa } from "@/lib/utils";

export default function ComparePage() {
  const { ids, remove, clear } = useCompare();
  const addToCart = useCart((s) => s.add);
  const { toast } = useUi();
  const items = ids.map((id) => getProductById(id)!).filter(Boolean);
  const rows: { label: string; render: (p: NonNullable<ReturnType<typeof getProductById>>) => React.ReactNode }[] = [
    { label: "قیمت", render: (p) => { const offer = getBestOffer(p.id); return <Price price={offer?.price ?? p.price} oldPrice={offer?.oldPrice ?? p.oldPrice} />; } },
    { label: "فروشنده", render: (p) => { const offer = getBestOffer(p.id); const store = getStoreById(offer?.storeId ?? p.storeId); return <span className="inline-flex items-center justify-center gap-1">{store?.name ?? "—"}{store?.verified && <BadgeCheck size={13} className="text-success" />}</span>; } },
    { label: "امتیاز و نظر", render: (p) => <Rating value={p.rating} count={p.reviewsCount} /> },
    { label: "تعداد خرید", render: (p) => `${toFa(p.purchaseCount)} خرید` },
    { label: "ارسال", render: (p) => { const offer = getBestOffer(p.id); return <span className="inline-flex items-center gap-1"><Truck size={13} />{offer?.shippingDays ?? "در صفحه محصول"}</span>; } },
    { label: "بازگشت", render: () => <span className="inline-flex items-center gap-1"><RotateCcw size={13} />{toFa(PLATFORM.policies.returnDays)} روز</span> },
    { label: "ابعاد", render: (p) => p.dimensions ?? "—" },
    { label: "جنس", render: (p) => p.materials.join("، ") },
    { label: "رنگ‌ها", render: (p) => <span className="flex justify-center gap-1">{p.colors.slice(0, 4).map((c) => <span key={c.name} title={c.name} className="h-4 w-4 rounded-full border border-clay/40" style={{ background: c.hex }} />)}</span> },
    { label: "موجودی", render: (p) => p.inStock ? <span className="inline-flex items-center gap-1 text-success"><Check size={16} /> موجود</span> : <span className="text-danger">ناموجود</span> },
    { label: "سبک", render: (p) => p.styleSlugs.join("، ") },
  ];

  if (items.length === 0) {
    return (
      <Container className="py-16">
        <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "مقایسه" }]} />
        <div className="mt-8"><EmptyState icon={<GitCompare size={32} />} title="هیچ محصولی برای مقایسه نیست" desc="از روی کارت محصولات، آن‌ها را برای مقایسه اضافه کن." action={<ButtonLink href="/products">کاوش محصولات</ButtonLink>} /></div>
      </Container>
    );
  }

  return (
    <Container className="py-10">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "مقایسه" }]} />
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-black text-ink">مقایسه محصولات ({toFa(items.length)})</h1>
        <Button variant="ghost" onClick={clear}>پاک کردن همه</Button>
      </div>

      <div className="mt-8 overflow-x-auto pb-2">
        <div className="min-w-[480px] sm:min-w-[640px]">
          {/* header row */}
          <div className="grid" style={{ gridTemplateColumns: `140px repeat(${items.length}, 1fr)` }}>
            <div />
            {items.map((p) => (
              <div key={p.id} className="px-3 text-center">
                <div className="relative">
                  <button onClick={() => remove(p.id)} aria-label="حذف از مقایسه" className="absolute left-0 top-0 grid h-9 w-9 place-items-center rounded-full bg-ivory-2 text-ink-muted hover:text-danger"><X size={14} /></button>
                  <SmartImage src={p.images[0]} alt={p.name} className="mx-auto aspect-square w-full rounded-xl" />
                </div>
                <Link href={`/products/${p.slug}`} className="mt-2 block line-clamp-2 text-sm font-medium text-ink hover:text-terracotta-deep">{p.name}</Link>
                <div className="text-xs text-ink-muted">{p.brand}</div>
                <Button size="sm" className="mt-3 w-full" disabled={!p.inStock} onClick={() => { addToCart(p.id, 1, getBestOffer(p.id)?.id); toast("به سبد اضافه شد"); }}>افزودن به سبد</Button>
              </div>
            ))}
          </div>
          {/* attribute rows */}
          {rows.map((r, i) => (
            <div key={r.label} className={`grid items-center border-t border-clay/40 ${i % 2 ? "bg-ivory-2/50" : ""}`} style={{ gridTemplateColumns: `140px repeat(${items.length}, 1fr)` }}>
              <div className="px-3 py-3 text-xs font-bold text-ink-muted">{r.label}</div>
              {items.map((p) => <div key={p.id} className="px-3 py-3 text-center text-sm text-ink">{r.render(p)}</div>)}
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import { Heart, ShoppingBag, Sparkles, Wand2 } from "lucide-react";
import Link from "next/link";
import { Container, Breadcrumb } from "@/components/shared";
import { Button, Badge} from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { getInspiration, inspirations } from "@/data/inspirations";
import { getProductById } from "@/data/products";
import { getStyle } from "@/data/styles";
import { useWishlist, useCart } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { cn, toFa } from "@/lib/utils";

export default function InspirationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const insp = getInspiration(id);
  if (!insp) notFound();
  const style = getStyle(insp!.styleSlug);
  const wl = useWishlist(); const addToCart = useCart((s) => s.add); const { toast } = useUi();
  const wished = wl.inspirations.includes(insp!.id);
  const featured = insp!.productIds.map((pid) => getProductById(pid)).filter(Boolean);
  const more = inspirations.filter((i) => i.id !== insp!.id).slice(0, 4);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "الهام", href: "/inspiration" }, { label: insp!.title }]} />

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.4fr_1fr]">
        <div className="overflow-hidden rounded-[var(--radius-xl)]">
          <SmartImage src={insp!.image} alt={insp!.title} className="aspect-[4/3] w-full" />
        </div>
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge tone="dark">{insp!.room}</Badge>
            {style && <Badge tone="accent">{style.name}</Badge>}
            {insp!.tags.map((t) => <Badge key={t}>#{t}</Badge>)}
          </div>
          <h1 className="mt-4 font-display text-3xl font-black text-ink">{insp!.title}</h1>
          <p className="mt-3 leading-8 text-ink-muted">
            این طراحی از سبک {style?.name} الهام گرفته شده. محصولات استفاده‌شده در این طراحی را می‌توانی مستقیماً از Homeino بخری یا با هومینو استودیو، مشابه آن را برای اتاق خودت بسازی.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button variant={wished ? "primary" : "outline"} onClick={() => { wl.toggleInspiration(insp!.id); toast(wished ? "حذف شد" : "ذخیره شد"); }}>
              <Heart size={16} className={cn(wished && "fill-current")} /> {wished ? "ذخیره شد" : "ذخیره ایده"}
            </Button>
            <Link href="/ai/design"><Button className="btn-accent"><Wand2 size={16} /> بساز مشابهش با هومینو استودیو</Button></Link>
            {style && <Link href={`/styles/${style.slug}`}><Button variant="ghost">سبک {style.name} ←</Button></Link>}
          </div>

          <div className="mt-5 flex items-center gap-1">
            {style?.colorPalette.map((color) => <span key={color.hex} className="h-8 w-8 rounded-full border border-clay/40" style={{ background: color.hex }} title={color.name} />)}
          </div>
        </div>
      </div>

      {/* shoppable products */}
      <div className="mt-12">
        <div className="mb-5 flex items-center gap-2">
          <Sparkles size={20} className="text-gold" />
          <h2 className="font-display text-2xl font-bold text-ink">محصولات داخل این طراحی</h2>
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((p) => p && (
            <div key={p.id} className="card-surface overflow-hidden">
              <SmartImage src={p.images[0]} alt={p.name} className="aspect-square w-full" />
              <div className="p-4">
                <div className="text-xs text-ink-muted">{p.brand}</div>
                <div className="line-clamp-1 font-medium text-ink">{p.name}</div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="font-bold text-ink">{toFa(p.price.toLocaleString("fa-IR"))} <span className="text-2xs text-ink-muted">تومان</span></span>
                  <button onClick={() => { addToCart(p.id); toast("به سبد اضافه شد"); }} aria-label="افزودن به سبد" className="btn-accent grid h-9 w-9 place-items-center rounded-lg"><ShoppingBag size={15} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* more inspiration */}
      <div className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">ایده‌های بیشتر</h2>
        <div className="columns-2 gap-4 sm:columns-4 [&>*]:mb-4">
          {more.map((m, i) => (
            <a key={m.id} href={`/inspiration/${m.id}`} className="block">
              <SmartImage src={m.image} alt={m.title} className={cn("w-full rounded-2xl", i % 2 ? "aspect-[4/5]" : "aspect-square")} />
            </a>
          ))}
        </div>
      </div>
    </Container>
  );
}

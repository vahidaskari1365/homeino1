"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container, Breadcrumb, ProductGrid } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal } from "@/components/motion/Reveal";
import { getStyle, styles } from "@/data/styles";
import { productsByStyle } from "@/data/products";
import { inspirations } from "@/data/inspirations";
import { articles } from "@/data/content";
import { stores } from "@/data/stores";
import { InspirationCard } from "@/components/cards";
import { Check, Wand2, ArrowLeft } from "lucide-react";
import { toFa } from "@/lib/utils";

export default function StyleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const style = getStyle(slug);
  if (!style) notFound();
  const products = productsByStyle(slug);
  const ins = inspirations.filter((i) => i.styleSlug === slug).slice(0, 4);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "سبک‌ها", href: "/styles" }, { label: style!.name }]} />

      <Reveal>
        <div className="relative mt-5 overflow-hidden rounded-[var(--radius-xl)]">
          <SmartImage src={style!.image} alt={style!.name} className="h-56 w-full sm:h-72" />
          <div className="absolute inset-0 bg-gradient-to-l from-ink/90 to-ink/20" />
          <div className="absolute inset-0 flex flex-col justify-center p-8 text-cream">
            <div className="text-xs uppercase tracking-widest text-cream/60">{style!.nameEn}</div>
            <h1 className="mt-1 font-display text-4xl font-black">{style!.name}</h1>
            <p className="mt-1 text-cream/75">{style!.tagline}</p>
            <div className="mt-4 flex gap-2">
              {style!.palette.map((c) => <span key={c} className="h-9 w-9 rounded-full border-2 border-cream/40" style={{ background: c }} />)}
            </div>
          </div>
        </div>
      </Reveal>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="leading-9 text-ink-muted">{style!.description}</p>
          {/* AI design CTA — connects discovery to AI loop */}
          <Link href={`/ai`} className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-gold/25 bg-gold/5 p-4 transition hover:border-gold/40">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold/15 text-gold"><Wand2 size={18} /></span>
              <div><p className="text-sm font-bold text-ink">این سبک رو تو خونه‌ات ببین</p><p className="text-[11px] text-ink-muted">عکس اتاقت رو بده، با هوش مصنوعی با سبک {style!.name} بچینش</p></div>
            </div>
            <ArrowLeft size={18} className="shrink-0 text-gold" />
          </Link>
        </div>
        <div className="card-surface p-6">
          <h3 className="mb-3 font-display font-bold text-ink">ویژگی‌های کلیدی</h3>
          <div className="space-y-2">
            {style!.traits.map((t) => (
              <div key={t} className="flex items-center gap-2 text-sm text-ink-muted"><Check size={16} className="text-sage" /> {t}</div>
            ))}
          </div>
          {/* Color palette — Pinterest-shareable */}
          <div className="mt-4 border-t border-clay/30 pt-3">
            <p className="mb-2 text-xs font-bold text-ink-muted">پالت رنگی این سبک</p>
            <div className="flex gap-2">{style!.palette.map((hex) => <div key={hex} className="flex flex-col items-center gap-1"><span className="h-10 w-10 rounded-lg border border-clay/40" style={{ background: hex }} /><span className="font-mono text-[9px] text-ink-muted">{hex}</span></div>)}</div>
          </div>
        </div>
      </div>

      {/* Products in this style */}
      <div className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">محصولات به سبک {style!.name} ({toFa(products.length)})</h2>
        {products.length > 0 ? <ProductGrid products={products} /> : <p className="text-sm text-ink-muted">به‌زودی محصولات بیشتری در این سبک اضافه می‌شود.</p>}
      </div>

      {/* Stores selling this style */}
      <div className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">فروشگاه‌های سبک {style!.name}</h2>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {stores.filter((s) => s.categorySlugs.some((c) => products.some((p) => p.categorySlug === c))).slice(0, 4).map((s) => (
            <Link key={s.id} href={`/stores/${s.slug}`} className="card-surface flex items-center gap-3 p-3 transition hover:-translate-y-1">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl font-display font-bold text-cream" style={{ backgroundColor: s.logoColor }}>{s.logo}</span>
              <div className="min-w-0"><p className="line-clamp-1 text-sm font-bold text-ink">{s.name}</p><p className="text-[11px] text-ink-muted">{s.city}</p></div>
            </Link>
          ))}
        </div>
      </div>

      {/* Inspiration in this style */}
      {ins.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-5 font-display text-2xl font-bold text-ink">الهام از این سبک</h2>
          <div className="columns-2 gap-4 sm:columns-4 [&>*]:mb-4">
            {ins.map((i, idx) => <InspirationCard key={i.id} insp={i} index={idx} />)}
          </div>
        </div>
      )}

      {/* Related content — magazine */}
      <div className="mt-12">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">راهنمای سبک {style!.name}</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {articles.filter((a) => a.category === "سبک‌ها").slice(0, 2).map((a) => (
            <Link key={a.id} href={`/magazine/${a.slug}`} className="group flex items-center gap-3 rounded-xl border border-clay/40 bg-cream p-3 transition hover:border-gold/40">
              <SmartImage src={a.cover} alt={a.title} className="h-16 w-16 shrink-0 rounded-lg" />
              <div className="min-w-0"><p className="line-clamp-2 text-xs font-bold text-ink">{a.title}</p><p className="text-[10px] text-ink-muted">{a.category} · {toFa(a.readTime)} دقیقه</p></div>
            </Link>
          ))}
        </div>
      </div>
    </Container>
  );
}

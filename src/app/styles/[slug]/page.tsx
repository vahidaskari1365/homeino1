import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Check, Home, Lamp, Layers3, Palette, Shapes, Sofa } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { productsByStyle } from "@/data/products";
import { stylesRepository } from "@/repositories/styles";
import { toFa } from "@/lib/utils";

export default async function StyleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [style, styleCatalog] = await Promise.all([
    stylesRepository.bySlug(slug),
    stylesRepository.list(),
  ]);
  if (!style) notFound();

  const productCount = productsByStyle(style.slug).length;
  const currentIndex = styleCatalog.findIndex((item) => item.slug === style.slug);
  const nextStyle = styleCatalog[(currentIndex + 1) % styleCatalog.length];

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "معرفی سبک‌ها", href: "/styles" }, { label: `سبک ${style.name}` }]} />

      <header className="relative mt-5 min-h-[430px] overflow-hidden rounded-[var(--radius-xl)] sm:min-h-[520px]">
        <SmartImage src={style.image} alt={style.imageAlt} priority className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-l from-ink/95 via-ink/65 to-ink/10" />
        <div className="relative flex min-h-[430px] max-w-2xl flex-col justify-center p-6 text-cream sm:min-h-[520px] sm:p-10 lg:p-14">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-gold-soft"><BookOpen size={14} /> {style.nameEn}</div>
          <h1 className="mt-3 font-display text-4xl font-black sm:text-6xl">سبک {style.name}</h1>
          <p className="mt-2 text-lg font-bold text-cream/90">{style.tagline}</p>
          <p className="mt-4 max-w-xl text-sm leading-8 text-cream/72">{style.shortDescription}</p>
          <div className="mt-7 flex flex-col gap-2 sm:flex-row">
            <Link href={`/products?style=${style.slug}`} className="btn-accent inline-flex min-h-12 items-center justify-center gap-2 px-6 text-sm font-black">
              مشاهده محصولات این سبک <ArrowLeft size={17} />
            </Link>
            <Link href="/styles" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cream/30 bg-cream/8 px-6 text-sm font-bold text-cream backdrop-blur transition hover:bg-cream/15">
              همه معرفی‌ها
            </Link>
          </div>
          <p className="mt-3 text-xs text-cream/55">{toFa(productCount)} محصول با فیلتر «{style.name}» آماده‌ی مشاهده است.</p>
        </div>
      </header>

      <nav aria-label="بخش‌های راهنمای سبک" className="sticky top-24 z-30 mt-5 overflow-x-auto rounded-2xl border border-clay/45 bg-cream/90 p-2 shadow-[var(--shadow-soft)] backdrop-blur">
        <div className="flex min-w-max gap-1">
          {[
            ["شناخت سبک", "overview"],
            ["رنگ و متریال", "palette"],
            ["مبلمان و نور", "furniture"],
            ["مناسب برای", "suitable"],
          ].map(([label, anchor]) => <a key={anchor} href={`#${anchor}`} className="rounded-xl px-4 py-2 text-xs font-bold text-ink-muted transition hover:bg-ivory-2 hover:text-ink">{label}</a>)}
        </div>
      </nav>

      <div className="mx-auto max-w-5xl">
        <section id="overview" className="grid gap-6 py-12 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <p className="text-xs font-bold text-terracotta-deep">شناخت سبک</p>
            <h2 className="mt-2 text-2xl font-black text-ink">این سبک دقیقاً چیست؟</h2>
            <p className="mt-4 leading-9 text-ink-muted">{style.description}</p>
            {style.comparisonNote && (
              <div className="mt-5 rounded-2xl border-r-4 border-gold bg-gold/8 p-5">
                <h3 className="text-sm font-black text-ink">مرز این سبک با سبک‌های مشابه</h3>
                <p className="mt-2 text-sm leading-7 text-ink-muted">{style.comparisonNote}</p>
              </div>
            )}
          </div>
          <aside className="card-surface p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-lg font-black text-ink"><Check size={18} className="text-terracotta-deep" /> نشانه‌های قابل تشخیص</h2>
            <ul className="mt-4 space-y-3">
              {style.keyFeatures.map((feature) => <li key={feature} className="flex items-start gap-2 text-sm leading-7 text-ink-muted"><span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />{feature}</li>)}
            </ul>
            <div className="mt-5 border-t border-clay/35 pt-4">
              <p className="text-xs font-black text-ink">میزان شلوغی بصری</p>
              <p className="mt-1 text-xs leading-6 text-ink-muted">{style.visualDensity}</p>
            </div>
          </aside>
        </section>

        <section id="palette" className="border-y border-clay/40 py-12">
          <div className="mb-6">
            <p className="text-xs font-bold text-terracotta-deep">رنگ و سطح</p>
            <h2 className="mt-2 text-2xl font-black text-ink">پالت و متریال سبک {style.name}</h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="card-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-black text-ink"><Palette size={18} className="text-gold" /> پالت پیشنهادی</h3>
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
                {style.colorPalette.map((color) => (
                  <div key={color.hex} className="overflow-hidden rounded-xl border border-clay/40 bg-cream">
                    <span className="block h-20 w-full sm:h-28" style={{ backgroundColor: color.hex }} />
                    <span className="block p-2 text-center"><strong className="block text-[11px] text-ink">{color.name}</strong><span dir="ltr" className="mt-0.5 block font-mono text-[9px] text-ink-muted">{color.hex}</span></span>
                  </div>
                ))}
              </div>
            </div>
            <div className="card-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-black text-ink"><Layers3 size={18} className="text-gold" /> مواد سازنده‌ی فضا</h3>
              <div className="mt-5 flex flex-wrap gap-2">
                {style.materials.map((material) => <span key={material} className="rounded-xl border border-clay/45 bg-ivory-2/60 px-3 py-2 text-sm font-bold text-ink">{material}</span>)}
              </div>
              <p className="mt-5 border-t border-clay/35 pt-4 text-xs leading-7 text-ink-muted">برای نتیجه‌ای طبیعی، یک متریال غالب انتخاب کن و بقیه را در نقش مکمل به‌کار ببر؛ نمونه و بافت واقعی ماده مهم‌تر از نام آن است.</p>
            </div>
          </div>
        </section>

        <section id="furniture" className="py-12">
          <div className="mb-6">
            <p className="text-xs font-bold text-terracotta-deep">چیدمان</p>
            <h2 className="mt-2 text-2xl font-black text-ink">مبلمان، نور و جزئیات</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="card-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-black text-ink"><Sofa size={18} className="text-terracotta-deep" /> مبلمان مناسب</h3>
              <p className="mt-3 text-sm leading-8 text-ink-muted">{style.furnitureCharacteristics}</p>
            </div>
            <div className="card-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-black text-ink"><Lamp size={18} className="text-terracotta-deep" /> نورپردازی مناسب</h3>
              <p className="mt-3 text-sm leading-8 text-ink-muted">{style.lightingCharacteristics}</p>
            </div>
            <div className="card-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-black text-ink"><Shapes size={18} className="text-terracotta-deep" /> زبان فرم</h3>
              <p className="mt-3 text-sm leading-8 text-ink-muted">{style.formCharacteristics}</p>
            </div>
            <div className="card-surface p-5 sm:p-6">
              <h3 className="flex items-center gap-2 text-base font-black text-ink"><Layers3 size={18} className="text-terracotta-deep" /> تزئینات</h3>
              <p className="mt-3 text-sm leading-8 text-ink-muted">{style.decorCharacteristics}</p>
            </div>
          </div>
        </section>

        <section id="suitable" className="rounded-[var(--radius-xl)] bg-ink p-6 text-cream sm:p-8 lg:p-10">
          <div className="grid gap-7 lg:grid-cols-[1fr_0.8fr] lg:items-center">
            <div>
              <p className="text-xs font-bold text-gold-soft">آیا برای تو مناسب است؟</p>
              <h2 className="mt-2 text-2xl font-black">سبک {style.name} برای چه کسانی است؟</h2>
              <p className="mt-4 text-sm leading-8 text-cream/70">{style.suitableFor}</p>
            </div>
            <div className="rounded-2xl bg-cream/8 p-5">
              <h3 className="flex items-center gap-2 text-sm font-black"><Home size={17} className="text-sage-soft" /> فضاهای مناسب</h3>
              <div className="mt-4 flex flex-wrap gap-2">{style.suitableRooms.map((room) => <span key={room} className="rounded-full border border-cream/15 bg-cream/8 px-3 py-1.5 text-xs text-cream/85">{room}</span>)}</div>
            </div>
          </div>
        </section>

        <section className="my-12 overflow-hidden rounded-[var(--radius-xl)] border border-gold/30 bg-gradient-to-l from-gold/15 to-cream p-6 sm:p-8">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold text-terracotta-deep">قدم بعدی</p>
              <h2 className="mt-2 text-2xl font-black text-ink">محصولات هماهنگ با سبک {style.name}</h2>
              <p className="mt-2 text-sm text-ink-muted">فهرست محصولات با فیلتر فعال «سبک: {style.name}» باز می‌شود و می‌توانی آن را با دسته، قیمت، رنگ، متریال و موجودی ترکیب کنی.</p>
            </div>
            <Link href={`/products?style=${style.slug}`} className="btn-primary inline-flex min-h-12 shrink-0 items-center justify-center gap-2 px-6 text-sm font-black">
              مشاهده محصولات این سبک <ArrowLeft size={17} />
            </Link>
          </div>
        </section>

        <div className="flex flex-col items-stretch justify-between gap-3 border-t border-clay/40 pt-7 sm:flex-row sm:items-center">
          <Link href="/styles" className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-ink-muted transition hover:text-ink"><ArrowRight size={16} /> بازگشت به معرفی همه سبک‌ها</Link>
          <Link href={`/styles/${nextStyle.slug}`} className="inline-flex min-h-11 items-center justify-end gap-2 text-sm font-bold text-terracotta-deep transition hover:underline">راهنمای بعدی: {nextStyle.name} <ArrowLeft size={16} /></Link>
        </div>
      </div>
    </Container>
  );
}

import Link from "next/link";
import { ArrowLeft, BookOpen, Check, Home, Lamp, Layers3, Palette, Shapes, Sofa, Users } from "lucide-react";
import type { Style } from "@/types";
import { Container, PageHeader } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { productsByStyle } from "@/data/products";
import { stylesRepository } from "@/repositories/styles";
import { toFa } from "@/lib/utils";

function StyleGuideSection({ style, index, total }: { style: Style; index: number; total: number }) {
  const productCount = productsByStyle(style.slug).length;

  return (
    <article id={`style-${style.slug}`} className="scroll-mt-40 overflow-hidden rounded-[var(--radius-xl)] border border-clay/40 bg-cream shadow-[var(--shadow-soft)]">
      <div className="grid lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="relative min-h-72 overflow-hidden lg:min-h-full">
          <SmartImage src={style.image} alt={style.imageAlt} priority={index === 0} className="absolute inset-0 h-full w-full" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/85 via-ink/10 to-transparent" />
          <div className="absolute right-5 top-5 rounded-full border border-cream/25 bg-ink/45 px-3 py-1 text-xs font-bold text-cream backdrop-blur">
            {toFa(index + 1).padStart(2, "۰")} / {toFa(total)}
          </div>
          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-gold-soft">{style.nameEn}</p>
            <h2 className="mt-1 font-display text-3xl font-black text-cream sm:text-4xl">سبک {style.name}</h2>
            <p className="mt-1 text-sm text-cream/75">{style.tagline}</p>
          </div>
        </div>

        <div className="p-5 sm:p-7 lg:p-8">
          <p className="text-base font-bold leading-8 text-ink">{style.shortDescription}</p>
          <p className="mt-3 text-sm leading-8 text-ink-muted">{style.description}</p>

          <section className="mt-6" aria-labelledby={`${style.slug}-features`}>
            <h3 id={`${style.slug}-features`} className="mb-3 flex items-center gap-2 text-base font-black text-ink"><Check size={17} className="text-terracotta-deep" /> ویژگی‌های اصلی</h3>
            <div className="flex flex-wrap gap-2">
              {style.keyFeatures.map((feature) => <span key={feature} className="rounded-full border border-clay/45 bg-ivory-2/65 px-3 py-1.5 text-xs text-ink">{feature}</span>)}
            </div>
          </section>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <section className="rounded-2xl border border-clay/35 bg-ivory/55 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-ink"><Palette size={16} className="text-terracotta-deep" /> پالت رنگ</h3>
              <div className="mt-3 grid grid-cols-5 gap-1.5">
                {style.colorPalette.map((color) => (
                  <div key={color.hex} className="min-w-0 text-center">
                    <span className="block aspect-square w-full rounded-lg border border-ink/10 shadow-sm" style={{ backgroundColor: color.hex }} title={`${color.name} ${color.hex}`} />
                    <span className="mt-1 block truncate text-2xs text-ink-muted">{color.name}</span>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-clay/35 bg-ivory/55 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-ink"><Layers3 size={16} className="text-terracotta-deep" /> متریال‌های رایج</h3>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {style.materials.map((material) => <span key={material} className="rounded-lg bg-cream px-2.5 py-1.5 text-2xs text-ink-muted shadow-sm">{material}</span>)}
              </div>
            </section>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-clay/35 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-ink"><Sofa size={16} className="text-gold" /> مبلمان مناسب</h3>
              <p className="mt-2 text-xs leading-6 text-ink-muted">{style.furnitureCharacteristics}</p>
            </div>
            <div className="rounded-2xl border border-clay/35 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-ink"><Lamp size={16} className="text-gold" /> نورپردازی</h3>
              <p className="mt-2 text-xs leading-6 text-ink-muted">{style.lightingCharacteristics}</p>
            </div>
            <div className="rounded-2xl border border-clay/35 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-ink"><Shapes size={16} className="text-gold" /> فرم و تزئینات</h3>
              <p className="mt-2 text-xs leading-6 text-ink-muted">{style.formCharacteristics} {style.decorCharacteristics}</p>
            </div>
            <div className="rounded-2xl border border-clay/35 p-4">
              <h3 className="flex items-center gap-2 text-sm font-black text-ink"><Layers3 size={16} className="text-gold" /> میزان شلوغی فضا</h3>
              <p className="mt-2 text-xs leading-6 text-ink-muted">{style.visualDensity}</p>
            </div>
          </div>

          <section className="mt-4 rounded-2xl bg-ink p-4 text-cream">
            <h3 className="flex items-center gap-2 text-sm font-black"><Users size={16} className="text-gold-soft" /> مناسب چه کسانی است؟</h3>
            <p className="mt-2 text-xs leading-6 text-cream/70">{style.suitableFor}</p>
            <div className="mt-3 border-t border-cream/10 pt-3">
              <p className="mb-2 flex items-center gap-2 text-xs font-bold"><Home size={14} className="text-sage-soft" /> فضاهای مناسب</p>
              <div className="flex flex-wrap gap-1.5">{style.suitableRooms.map((room) => <span key={room} className="rounded-full bg-cream/10 px-2.5 py-1 text-2xs text-cream/85">{room}</span>)}</div>
            </div>
          </section>

          {style.comparisonNote && (
            <aside className="mt-4 rounded-xl border-r-4 border-gold bg-gold/8 px-4 py-3 text-xs leading-6 text-ink-muted">
              <strong className="text-ink">تفاوت مهم: </strong>{style.comparisonNote}
            </aside>
          )}

          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <Link href={`/products?style=${style.slug}`} className="btn-primary inline-flex min-h-12 flex-1 items-center justify-center gap-2 px-5 text-sm font-bold">
              مشاهده محصولات این سبک
              <ArrowLeft size={16} />
            </Link>
            <Link href={`/styles/${style.slug}`} className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-clay/65 px-5 text-sm font-bold text-ink transition hover:border-ink hover:bg-ivory-2">
              <BookOpen size={16} /> راهنمای کامل {style.name}
            </Link>
          </div>
          <p className="mt-2 text-center text-2xs text-ink-muted">{toFa(productCount)} محصول هماهنگ در Homeino</p>
        </div>
      </div>
    </article>
  );
}

export default async function StylesPage() {
  const styleCatalog = await stylesRepository.list();

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="معرفی سبک‌ها"
        title="سبک دکوراسیون خودت را آگاهانه پیدا کن"
        desc="از رنگ و متریال تا مبلمان و نور؛ تفاوت سبک‌ها را ببین و انتخابی متناسب با خانه و شیوه‌ی زندگی‌ات داشته باش."
        action={<Link href="/products" className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-clay/65 bg-cream px-4 text-sm font-bold text-ink transition hover:border-ink"><Sofa size={16} /> همه محصولات</Link>}
      />

      <section className="mb-8 grid gap-4 rounded-[var(--radius-xl)] border border-clay/40 bg-ink p-5 text-cream sm:p-7 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
        <div>
          <p className="text-xs font-bold text-gold-soft">از سلیقه تا تصمیم خرید</p>
          <h2 className="mt-2 max-w-2xl text-2xl font-black sm:text-3xl">اسم سبک کافی نیست؛ منطق پشت انتخاب‌ها را بشناس</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-cream/70">هر راهنما نشان می‌دهد چه رنگ، متریال، فرم و نوری آن سبک را می‌سازد؛ بعد می‌توانی مستقیماً محصولات هماهنگ را با فیلتر فعال ببینی.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-2xl bg-cream/8 p-3"><strong className="block text-xl text-gold-soft">{toFa(styleCatalog.length)}</strong><span className="text-cream/60">سبک معتبر</span></div>
          <div className="rounded-2xl bg-cream/8 p-3"><strong className="block text-xl text-gold-soft">۷</strong><span className="text-cream/60">معیار بررسی</span></div>
          <div className="rounded-2xl bg-cream/8 p-3"><strong className="block text-xl text-gold-soft">۱</strong><span className="text-cream/60">مسیر تا محصول</span></div>
        </div>
      </section>

      <nav aria-label="دسترسی سریع به سبک‌ها" className="sticky top-24 z-30 -mx-2 mb-8 overflow-x-auto rounded-2xl border border-clay/45 bg-cream/90 p-2 shadow-[var(--shadow-soft)] backdrop-blur">
        <div className="flex min-w-max items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1.5 px-2 text-xs font-black text-ink"><BookOpen size={14} className="text-terracotta-deep" /> برو به:</span>
          {styleCatalog.map((style) => (
            <a key={style.id} href={`#style-${style.slug}`} className="rounded-xl px-3 py-2 text-xs font-bold text-ink-muted transition hover:bg-ivory-2 hover:text-ink">{style.name}</a>
          ))}
        </div>
      </nav>

      <div className="space-y-10">
        {styleCatalog.map((style, index) => <StyleGuideSection key={style.id} style={style} index={index} total={styleCatalog.length} />)}
      </div>
    </Container>
  );
}

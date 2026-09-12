import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Lightbulb, ShoppingBag } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { Chip } from "@/components/ui/primitives";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { trendCategoryBySlug, trendCategoryList, briefsByCategory } from "@/lib/trends";
import { SITE_URL } from "@/config/site";

/**
 * هاب ترندِ دسته‌ای — کلستر سئوی هر دسته:
 *   /trends/category/{slug} (این صفحه)  ↔  /category/{productSlug} (صفحه خرید)
 * همه بریف‌های یک دسته (تا ۱۲۰ روز) اینجا جمع می‌شوند + پرسش‌وپاسخ‌ها به‌صورت
 * FAQPage JSON-LD برای قابلیت استناد در پاسخ‌های هوش مصنوعی‌ها (GEO).
 */

export function generateStaticParams() {
  return trendCategoryList.map(({ meta }) => ({ slug: meta.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const meta = trendCategoryBySlug(slug);
  if (!meta) return { title: "یافت نشد" };
  const list = briefsByCategory(meta.label);
  const titles = list.slice(0, 3).map((b) => b.title).join("، ");
  return {
    title: `ترندهای ${meta.label} — مرجع فارسی ترند ${meta.label} | هومینو`,
    description: `${meta.description ?? `تازه‌ترین ترندهای ${meta.label} از معتبرترین منابع جهانی دیزاین، بازنویسی اختصاصی به فارسی.`} آخرین‌ها: ${titles}`.slice(0, 300),
    alternates: { canonical: `/trends/category/${meta.slug}` },
    openGraph: {
      title: `ترندهای ${meta.label} — هومینو`,
      description: meta.description,
      type: "website",
    },
  };
}

export default async function TrendCategoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const meta = trendCategoryBySlug(slug);
  if (!meta) notFound();
  const list = briefsByCategory(meta.label);
  if (list.length === 0) notFound();

  const faqs = list.filter((b) => b.faq && b.faq.length > 0).flatMap((b) => b.faq ?? []).slice(0, 8);

  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `ترندهای ${meta.label} — هومینو`,
    url: `${SITE_URL}/trends/category/${meta.slug}`,
    description: meta.description,
    hasPart: list.slice(0, 30).map((b) => ({
      "@type": "NewsArticle",
      headline: b.title,
      url: `${SITE_URL}/trends/${b.date}#${b.slug}`,
      datePublished: b.date,
      inLanguage: "fa-IR",
    })),
  };
  const faqLd =
    faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((f) => ({
            "@type": "Question",
            name: f.q,
            acceptedAnswer: { "@type": "Answer", text: f.a },
          })),
        }
      : null;

  return (
    <Container className="py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      {faqLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />}

      <PageHeader
        eyebrow="هاب ترند هومینو"
        title={`ترندهای ${meta.label}`}
        desc={
          meta.description ??
          `تازه‌ترین ترندهای ${meta.label} را هر روز از معتبرترین منابع جهانی جمع می‌کنیم، به فارسیِ مستقل بازنویسی می‌کنیم و نسخه کاربردی‌اش برای خانه ایرانی کنارش می‌آید.`
        }
      />

      <div className="-mt-4 mb-8 flex flex-wrap items-center gap-3">
        <Link href="/trends" className="inline-flex items-center gap-1.5 text-sm font-bold text-terracotta-deep">
          <ArrowRight size={15} /> همه ترندهای روز
        </Link>
        {meta.productSlug && (
          <Link
            href={`/category/${meta.productSlug}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-sm font-bold text-ink transition hover:bg-gold/20"
          >
            <ShoppingBag size={15} /> خرید {meta.label} در هومینو
          </Link>
        )}
      </div>

      <RevealGroup className="grid gap-6 md:grid-cols-2">
        {list.map((b) => (
          <RevealItem key={b.slug}>
            <article className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] card-surface">
              <Link href={`/trends/${b.date}#${b.slug}`} className="relative block aspect-[16/9] overflow-hidden">
                <SmartImage src={b.cover} alt={b.title} className="h-full w-full" />
                <span className="absolute right-3 top-3 rounded-full bg-cream/92 px-2.5 py-1 text-2xs font-bold text-ink backdrop-blur">{b.dateFa}</span>
              </Link>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg font-black leading-snug text-ink">
                  <Link href={`/trends/${b.date}#${b.slug}`} className="hover:text-terracotta-deep">{b.title}</Link>
                </h2>
                <p className="mt-2 flex-1 text-sm leading-7 text-ink-muted">{b.summary}</p>
                <div className="mt-3 rounded-xl border border-gold/30 bg-gold/8 p-3">
                  <div className="flex items-center gap-1.5 text-2xs font-black text-terracotta-deep"><Lightbulb size={12} /> برای خانه ایرانی</div>
                  <p className="mt-1 text-xs leading-6 text-ink">{b.takeaway}</p>
                </div>
                {b.faq && b.faq.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {b.faq.map((f) => (
                      <details key={f.q} className="rounded-xl border border-clay/40 bg-cream/60 p-3">
                        <summary className="cursor-pointer text-xs font-black text-ink">{f.q}</summary>
                        <p className="mt-1.5 text-xs leading-6 text-ink-muted">{f.a}</p>
                      </details>
                    ))}
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-x-2 text-2xs text-ink-muted">
                  <span>
                    منبع:{" "}
                    <a href={b.source.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink hover:text-terracotta-deep">
                      {b.source.name}
                    </a>
                  </span>
                  <span>· {b.dateFa}</span>
                </div>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>

      {/* شبکه هاب‌ها — لینک‌سازی متقابل بین همه دسته‌ها */}
      {trendCategoryList.length > 1 && (
        <section className="mt-14">
          <h2 className="mb-4 text-sm font-black text-ink">هاب‌های ترند دیگر</h2>
          <div className="flex flex-wrap gap-2">
            {trendCategoryList
              .filter(({ meta: m }) => m.slug !== meta.slug)
              .map(({ meta: m, count }) => (
                <Link key={m.slug} href={`/trends/category/${m.slug}`} className="group">
                  <Chip active={false}>
                    {m.label}
                    <span className="mr-1 text-2xs text-ink-muted group-hover:text-terracotta-deep">({count})</span>
                  </Chip>
                </Link>
              ))}
          </div>
          <Link href="/trends" className="mt-6 inline-flex items-center gap-1.5 text-sm font-bold text-terracotta-deep">
            همه دسته‌ها و ترندهای روز <ArrowLeft size={15} />
          </Link>
        </section>
      )}
    </Container>
  );
}

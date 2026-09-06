import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Lightbulb } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { briefsByDate, trendDates } from "@/lib/trends";
import { SITE_URL } from "@/config/site";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function generateStaticParams() {
  return trendDates.map((date) => ({ date }));
}

export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  if (!ISO_DATE.test(date)) return { title: "یافت نشد" };
  const list = briefsByDate(date);
  return {
    title: `ترندهای دیزاین خانه — ${list[0]?.dateFa ?? date} | هومینو`,
    description: `خلاصه‌ی ترندهای روز دکوراسیون و دیزاین داخلی در ${list[0]?.dateFa ?? date} — بازنویسی اختصاصی هومینو از معتبرترین منابع جهانی: ${list.map((b) => b.title).join("، ")}`.slice(0, 300),
    alternates: { canonical: `/trends/${date}` },
  };
}

export default async function TrendDatePage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!ISO_DATE.test(date)) notFound();
  const list = briefsByDate(date);
  if (list.length === 0) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `ترندهای دیزاین خانه — ${list[0].dateFa}`,
    url: `${SITE_URL}/trends/${date}`,
    hasPart: list.map((b) => ({
      "@type": "NewsArticle",
      headline: b.title,
      url: `${SITE_URL}/trends/${date}#${b.slug}`,
      datePublished: b.date,
    })),
  };

  return (
    <Container className="py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader
        eyebrow="آرشیو ترندها"
        title={`ترندهای روز ${list[0].dateFa}`}
        desc="خلاصه‌های این روز از دنیای دیزاین داخلی — بازنویسی اختصاصی تحریریه هومینو از منابع جهانی."
      />
      <div className="-mt-4 mb-10">
        <Link href="/trends" className="inline-flex items-center gap-1.5 text-sm font-bold text-terracotta-deep">
          <ArrowRight size={15} /> همه ترندهای روز
        </Link>
      </div>

      <RevealGroup className="grid gap-6 md:grid-cols-2">
        {list.map((b) => (
          <RevealItem key={b.slug}>
            <article id={b.slug} className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] card-surface">
              <div className="relative aspect-[16/9] overflow-hidden">
                <SmartImage src={b.cover} alt={b.title} className="h-full w-full" />
                <span className="absolute right-3 top-3 rounded-full bg-cream/92 px-2.5 py-1 text-2xs font-bold text-ink backdrop-blur">{b.category}</span>
              </div>
              <div className="flex flex-1 flex-col p-5">
                <h2 className="font-display text-lg font-black leading-snug text-ink">{b.title}</h2>
                <p className="mt-2 flex-1 text-sm leading-7 text-ink-muted">{b.summary}</p>
                <div className="mt-3 rounded-xl border border-gold/30 bg-gold/8 p-3">
                  <div className="flex items-center gap-1.5 text-2xs font-black text-terracotta-deep"><Lightbulb size={12} /> برای خانه ایرانی</div>
                  <p className="mt-1 text-xs leading-6 text-ink">{b.takeaway}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-2 text-2xs text-ink-muted">
                  <span>منبع: <a href={b.source.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink hover:text-terracotta-deep">{b.source.name}</a></span>
                  {b.extraSources?.map((s) => (
                    <span key={s.url}>· <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-terracotta-deep">{s.name}</a></span>
                  ))}
                </div>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </Container>
  );
}

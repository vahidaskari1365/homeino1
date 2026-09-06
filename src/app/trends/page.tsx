import type { Metadata } from "next";
import Link from "next/link";
import { Newspaper, Repeat2, Link2, ArrowLeft, Rss, Lightbulb } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { SectionHeading, Chip } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { trendBriefs, briefsByDate, latestTrendDate, trendDates } from "@/lib/trends";
import { SITE_URL } from "@/config/site";

export const metadata: Metadata = {
  title: "ترندهای روز دیزاین خانه — مرجع فارسی ترند دکوراسیون",
  description:
    "هر روز مهم‌ترین ترندهای دیزاین داخلی و دکوراسیون خانه را از معتبرترین منابع جهانی (Architectural Digest، Dezeen، Vogue و …) گردآوری و به فارسیِ روان و اختصاصی بازنویسی می‌کنیم؛ با ذکر منبع و با نسخه‌ی کاربردی برای خانه‌های ایرانی.",
  alternates: { canonical: "/trends" },
};

const HOW = [
  { icon: Newspaper, title: "پژوهش روزانه از منابع معتبر", desc: "فیدها و مطالب تازه‌ی معتبرترین نشریات دیزاین دنیا هر روز بررسی می‌شود." },
  { icon: Repeat2, title: "بازنویسی اختصاصی، نه ترجمه", desc: "تحریریه هومینو واقعیت‌ها را جمع می‌کند و متن مستقل فارسی می‌نویسد؛ کپی و ترجمه‌ی تحت‌اللفظی ممنوع است." },
  { icon: Link2, title: "منبع شفاف کنار هر ترند", desc: "لینک مطلب اصلی همیشه دیده می‌شود تا بتوانید خودتان راستی‌آزمایی کنید." },
];

export default function TrendsPage() {
  const today = latestTrendDate();
  const todayBriefs = today ? briefsByDate(today) : [];
  const archiveDates = trendDates.filter((d) => d !== today);
  const [lead, ...rest] = todayBriefs;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "ترندهای روز دیزاین خانه — هومینو",
    url: `${SITE_URL}/trends`,
    hasPart: trendBriefs.slice(0, 20).map((b) => ({
      "@type": "NewsArticle",
      headline: b.title,
      url: `${SITE_URL}/trends/${b.date}#${b.slug}`,
      datePublished: b.date,
    })),
  };

  return (
    <Container className="py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <PageHeader
        eyebrow="مرجع ترند هومینو"
        title="ترندهای روز دیزاین خانه"
        desc="هر روز، مهم‌ترین اتفاق‌های دنیای دیزاین داخلی را از معتبرترین منابع جهانی جمع می‌کنیم، به فارسیِ روان و مستقل بازنویسی می‌کنیم و نسخه‌ی کاربردی‌اش برای خانه‌های ایرانی را کنارش می‌گذاریم."
      />
      <div className="-mt-4 mb-10 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
        <Rss size={14} className="text-terracotta-deep" />
        <span>به‌روزرسانی روزانه ·</span>
        <a href="/feed.xml" className="font-bold text-terracotta-deep underline decoration-clay hover:decoration-terracotta">
          دنبال‌کردن با RSS
        </a>
      </div>

      {/* how it works — trust strip */}
      <RevealGroup className="mb-12 grid gap-3 sm:grid-cols-3">
        {HOW.map(({ icon: Icon, title, desc }) => (
          <RevealItem key={title}>
            <div className="flex h-full gap-3 rounded-[var(--radius-lg)] border border-clay/30 bg-cream/60 p-4">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/12 text-success"><Icon size={18} /></span>
              <div>
                <div className="text-sm font-black text-ink">{title}</div>
                <p className="mt-1 text-xs leading-6 text-ink-muted">{desc}</p>
              </div>
            </div>
          </RevealItem>
        ))}
      </RevealGroup>

      {today && lead ? (
        <>
          <Reveal>
            <SectionHeading
              eyebrow={`تازه‌ترین · ${lead.dateFa}`}
              title="امروز در دنیای دیزاین"
              desc="خلاصه‌های امروز از مرزهای دیزاین داخلی — بازنویسی اختصاصی تحریریه هومینو."
              action={<Link href="/magazine" className="inline-flex items-center gap-1 text-sm font-bold text-terracotta-deep">مقالات عمیق مجله <ArrowLeft size={16} /></Link>}
            />
          </Reveal>

          {/* lead brief — editorial row */}
          <Reveal>
            <article id={lead.slug} className="mb-6 grid overflow-hidden rounded-[var(--radius-xl)] card-surface md:grid-cols-2">
              <div className="relative min-h-56 overflow-hidden md:min-h-full">
                <SmartImage src={lead.cover} alt={lead.title} className="absolute inset-0 h-full w-full" />
                <span className="absolute right-4 top-4 rounded-full bg-terracotta px-3 py-1 text-xs font-bold text-cream">{lead.category}</span>
              </div>
              <div className="flex flex-col p-6 sm:p-8">
                <h2 className="font-display text-2xl font-black leading-snug text-ink">{lead.title}</h2>
                <p className="mt-3 flex-1 leading-8 text-ink-muted">{lead.summary}</p>
                <div className="mt-4 rounded-2xl border border-gold/30 bg-gold/8 p-4">
                  <div className="flex items-center gap-1.5 text-xs font-black text-terracotta-deep"><Lightbulb size={14} /> برای خانه ایرانی</div>
                  <p className="mt-1.5 text-sm leading-7 text-ink">{lead.takeaway}</p>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
                  <span>منبع: <a href={lead.source.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink hover:text-terracotta-deep">{lead.source.name}</a></span>
                  {lead.extraSources?.map((s) => (
                    <span key={s.url}>· <a href={s.url} target="_blank" rel="noopener noreferrer" className="hover:text-terracotta-deep">{s.name}</a></span>
                  ))}
                  <span>· {toFaSafe(lead.readTime)} دقیقه</span>
                </div>
              </div>
            </article>
          </Reveal>

          {/* rest of today */}
          <RevealGroup className="grid gap-6 md:grid-cols-2">
            {rest.map((b) => (
              <RevealItem key={b.slug}>
                <article id={b.slug} className="flex h-full flex-col overflow-hidden rounded-[var(--radius-lg)] card-surface">
                  <div className="relative aspect-[16/9] overflow-hidden">
                    <SmartImage src={b.cover} alt={b.title} className="h-full w-full" />
                    <span className="absolute right-3 top-3 rounded-full bg-cream/92 px-2.5 py-1 text-2xs font-bold text-ink backdrop-blur">{b.category}</span>
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="font-display text-lg font-black leading-snug text-ink">{b.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-7 text-ink-muted">{b.summary}</p>
                    <div className="mt-3 rounded-xl border border-gold/30 bg-gold/8 p-3">
                      <span className="text-2xs font-black text-terracotta-deep">برای خانه ایرانی: </span>
                      <span className="text-xs leading-6 text-ink">{b.takeaway}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-2 text-2xs text-ink-muted">
                      <span>منبع: <a href={b.source.url} target="_blank" rel="noopener noreferrer" className="font-bold text-ink hover:text-terracotta-deep">{b.source.name}</a></span>
                      <span>· {b.dateFa}</span>
                    </div>
                  </div>
                </article>
              </RevealItem>
            ))}
          </RevealGroup>
        </>
      ) : (
        <div className="rounded-[var(--radius-lg)] border border-clay/35 bg-cream/60 p-8 text-center text-ink-muted">
          هنوز بریف امروز منتشر نشده؛ به‌زودی برمی‌گردیم.
        </div>
      )}

      {/* archive */}
      {archiveDates.length > 0 && (
        <section className="mt-14">
          <SectionHeading eyebrow="آرشیو" title="روزهای پیشین" desc="بریف‌های ترند روزهای قبل، روزبه‌روز نگه‌داری می‌شوند." />
          <div className="flex flex-wrap gap-2">
            {archiveDates.map((d) => {
              const list = briefsByDate(d);
              return (
                <Link key={d} href={`/trends/${d}`} className="group">
                  <Chip active={false}>
                    {list[0]?.dateFa ?? d}
                    <span className="mr-1 text-2xs text-ink-muted group-hover:text-terracotta-deep">({list.length} ترند)</span>
                  </Chip>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </Container>
  );
}

function toFaSafe(n: number): string {
  return String(n).replace(/\d/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

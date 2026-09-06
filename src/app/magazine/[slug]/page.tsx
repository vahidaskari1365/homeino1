"use client";
import { use } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Clock, ArrowRight, Share2 } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { Button } from "@/components/ui/primitives";
import { getArticle, articles } from "@/data/content";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";

export default function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const article = getArticle(slug);
  if (!article) notFound();
  const { toast } = useUi();
  const more = articles.filter((a) => a.slug !== slug).slice(0, 3);

  return (
    <Container className="py-8">
      <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "مجله", href: "/magazine" }, { label: article!.title }]} />
      <article className="mx-auto mt-6 max-w-3xl">
        <span className="text-xs font-semibold text-terracotta-deep">{article!.category}</span>
        <h1 className="mt-2 font-display text-4xl font-black leading-tight text-ink text-balance">{article!.title}</h1>
        <div className="mt-4 flex items-center gap-4 text-sm text-ink-muted">
          <span>توسط {article!.author}</span><span>•</span><span className="flex items-center gap-1"><Clock size={14} /> {toFa(article!.readTime)} دقیقه</span><span>•</span><span>{article!.date}</span>
        </div>
        <SmartImage src={article!.cover} alt={article!.title} className="mt-6 aspect-[16/9] w-full rounded-2xl" />
        <div className="mt-7 space-y-5 text-lg leading-9 text-ink">
          <p className="text-xl font-medium text-ink">{article!.excerpt}</p>
          {article!.content.map((p, i) => <p key={i}>{p}</p>)}
        </div>
        {article!.sources && article!.sources.length > 0 && (
          <aside className="mt-8 rounded-2xl border border-clay/35 bg-cream/60 p-5">
            <div className="text-sm font-black text-ink">منابع و مآخذ</div>
            <ul className="mt-2 space-y-1.5 text-sm">
              {article!.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="text-terracotta-deep underline decoration-clay transition hover:decoration-terracotta">{s.name}</a>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-6 text-ink-muted">
              این مطلب تولید اختصاصی تحریریه هومینو است؛ واقعیت‌ها از منابع بالا گردآوری و به‌صورت مستقل بازنویسی شده‌اند و ترجمه یا کپیِ تحت‌اللفظی نیستند.
            </p>
          </aside>
        )}
        <div className="mt-8 flex items-center justify-between border-y border-clay/40 py-4">
          <Button variant="outline" onClick={async () => {
            const result = await shareContent({ title: article!.title, text: article!.excerpt, url: buildShareUrl(`/magazine/${article!.slug}`) });
            if (result.method === "failed") toast("اشتراک‌گذاری انجام نشد", "error");
            else toast(result.method === "native" ? "پنجره اشتراک‌گذاری باز شد" : "لینک مقاله کپی شد", "info");
          }}><Share2 size={16} /> اشتراک‌گذاری</Button>
          <Link href="/magazine" className="inline-flex items-center gap-1 text-sm text-terracotta-deep"><ArrowRight size={15} /> بازگشت به مجله</Link>
        </div>
      </article>

      <div className="mx-auto mt-12 max-w-5xl">
        <h2 className="mb-5 font-display text-2xl font-bold text-ink">مطالب مرتبط</h2>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {more.map((a) => (
            <Link key={a.id} href={`/magazine/${a.slug}`} className="group card-surface overflow-hidden">
              <SmartImage src={a.cover} alt={a.title} className="aspect-[16/10] w-full" />
              <div className="p-4"><span className="text-xs text-terracotta-deep">{a.category}</span><h3 className="mt-1 font-display font-bold text-ink transition group-hover:text-terracotta-deep">{a.title}</h3></div>
            </Link>
          ))}
        </div>
      </div>
    </Container>
  );
}

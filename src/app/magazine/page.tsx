"use client";
import Link from "next/link";
import { Clock} from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { AgentRunStatus } from "@/components/AgentRunStatus";
import { SmartImage } from "@/components/ui/SmartImage";
import { Chip } from "@/components/ui/primitives";
import { RevealGroup, RevealItem, Reveal } from "@/components/motion/Reveal";
import { articles } from "@/data/content";
import { useState } from "react";
import { toFa } from "@/lib/utils";

export default function MagazinePage() {
  const [cat, setCat] = useState("همه");
  const cats = ["همه", ...Array.from(new Set(articles.map((a) => a.category)))];
  const list = cat === "همه" ? articles : articles.filter((a) => a.category === cat);
  const [feature, ...rest] = list;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="مجله Homeino" title="الهام و راهنمای خانه" desc="راهنمای خرید، سبک‌ها، نورپردازی و ترندهای دکوراسیون — برای ساختن خانه‌ای بهتر." />
      <AgentRunStatus />
      <div className="mb-8 flex flex-wrap gap-2">{cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>

      {feature && (
        <Reveal>
          <Link href={`/magazine/${feature.slug}`} className="group relative mb-8 block overflow-hidden rounded-[var(--radius-xl)]">
            <SmartImage src={feature.cover} alt={feature.title} className="h-64 w-full sm:h-80" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/30 to-transparent" />
            <div className="absolute bottom-0 max-w-xl p-7 text-cream">
              <span className="rounded-full bg-terracotta px-3 py-1 text-xs font-bold">{feature.category}</span>
              <h2 className="mt-3 font-display text-3xl font-black leading-tight">{feature.title}</h2>
              <p className="mt-2 text-cream/75">{feature.excerpt}</p>
              <div className="mt-2 flex items-center gap-2 text-xs text-cream/60"><Clock size={13} /> {toFa(feature.readTime)} دقیقه مطالعه · {feature.date}</div>
            </div>
          </Link>
        </Reveal>
      )}

      <RevealGroup className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {rest.map((a) => (
          <RevealItem key={a.id}>
            <Link href={`/magazine/${a.slug}`} className="group flex h-full flex-col card-surface overflow-hidden">
              <SmartImage src={a.cover} alt={a.title} className="aspect-[16/10] w-full" />
              <div className="flex flex-1 flex-col p-5">
                <span className="text-xs font-semibold text-terracotta-deep">{a.category}</span>
                <h3 className="mt-1 font-display text-lg font-bold text-ink transition group-hover:text-terracotta-deep">{a.title}</h3>
                <p className="mt-1.5 flex-1 text-sm leading-7 text-ink-muted">{a.excerpt}</p>
                <div className="mt-3 flex items-center justify-between text-xs text-ink-muted"><span>{a.author}</span><span className="flex items-center gap-1"><Clock size={12} /> {toFa(a.readTime)} دقیقه</span></div>
              </div>
            </Link>
          </RevealItem>
        ))}
      </RevealGroup>
    </Container>
  );
}

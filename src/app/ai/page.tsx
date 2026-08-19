"use client";
import Link from "next/link";
import { Wand2, Sparkles, Edit3, Boxes, LayoutGrid, Plus, ArrowLeft, ImagePlus, History } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Badge, ButtonLink } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { Reveal, RevealGroup, RevealItem } from "@/components/motion/Reveal";
import { useCredits } from "@/stores/useApp";
import { aiDesigns } from "@/data/inspirations";
import { AI_MODES } from "@/services/ai";
import { toFa } from "@/lib/utils";

const MODE_ICONS: Record<string, typeof Wand2> = {
  "room-redesign": ImagePlus, "prompt-to-design": Wand2, "image-edit": Edit3,
  "product-in-room": Boxes, "decor-suggest": Sparkles, "full-concept": LayoutGrid,
};

export default function AIStudioHome() {
  const balance = useCredits((s) => s.balance);

  return (
    <Container className="py-10">
      {/* Hero */}
      <Reveal>
        <div className="relative mb-8 overflow-hidden rounded-[var(--radius-2xl)] bg-gradient-to-bl from-ink to-ink-soft p-8 text-cream sm:p-12">
          <div className="absolute inset-0 grain opacity-30" />
          <div className="pointer-events-none absolute -left-[10%] -top-[20%] h-[70vh] w-[55vw] animate-[aurora_14s_ease-in-out_infinite_alternate] bg-[radial-gradient(closest-side,rgba(30,93,68,0.28),rgba(30,93,68,0.12)_55%,transparent)]" />
          <div className="relative flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-lg">
              <Badge tone="dark" className="mb-4 border-gold/30 bg-white/10 text-gold-soft"><Sparkles size={13} /> استودیوی هوشمند دکوراسیون</Badge>
              <h1 className="font-display text-3xl font-black leading-tight sm:text-4xl">خانه‌ات را با هوش مصنوعی طراحی کن</h1>
              <p className="mt-3 text-cream/70">عکس خانه‌ات را آپلود کن، وسایل انتخاب کن، یا فقط توصیف کن — هوش مصنوعی Homeino فضایت را طراحی می‌کند.</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ButtonLink href="/ai/design" size="lg" variant="gold"><Wand2 size={18} /> شروع طراحی جدید</ButtonLink>
                <ButtonLink href="/ai/history" size="lg" variant="outline" className="border-cream/30 bg-transparent text-cream hover:bg-white/10"><History size={18} /> تاریخچه طراحی‌ها</ButtonLink>
              </div>
            </div>
            {/* Credit card */}
            <div className="rounded-2xl border border-gold/25 bg-white/5 p-5 text-center backdrop-blur">
              <Sparkles size={24} className="mx-auto mb-2 text-gold" />
              <div className="font-display text-3xl font-black text-gold-soft">{toFa(balance)}</div>
              <div className="text-xs text-cream/60">اعتبار موجود</div>
              <Link href="/account/credits" className="mt-3 block text-[11px] text-gold-soft hover:underline">خرید اعتبار</Link>
            </div>
          </div>
        </div>
      </Reveal>

      {/* Modes — the AI journey entry points */}
      <PageHeader eyebrow="ابزارهای طراحی" title="چطور می‌خوای طراحی کنی؟" />
      <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {AI_MODES.map((mode) => {
          const Icon = MODE_ICONS[mode.id] ?? Sparkles;
          return (
            <RevealItem key={mode.id}>
              <Link href={`/ai/design`} className="group flex h-full flex-col card-surface p-5 transition hover:-translate-y-1 hover:shadow-[var(--shadow-card)]">
                <div className="mb-4 flex items-center justify-between">
                  <span className="grid h-12 w-12 place-items-center rounded-xl bg-terracotta/10 text-terracotta-deep transition group-hover:bg-terracotta group-hover:text-white"><Icon size={22} /></span>
                  <Badge tone="gold">{toFa(mode.cost)} اعتبار</Badge>
                </div>
                <h3 className="font-display text-lg font-bold text-ink">{mode.title}</h3>
                <p className="mt-1 flex-1 text-sm leading-7 text-ink-muted">{mode.desc}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-terracotta-deep">شروع <ArrowLeft size={15} className="transition group-hover:-translate-x-1" /></span>
              </Link>
            </RevealItem>
          );
        })}
      </RevealGroup>

      {/* Recent designs */}
      <div className="mt-12">
        <PageHeader title="طراحی‌های اخیر" action={<ButtonLink href="/ai/history" variant="ghost" size="sm">همه طراحی‌ها</ButtonLink>} />
        {aiDesigns.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {aiDesigns.slice(0, 4).map((d) => (
              <Link key={d.id} href={`/ai/result/${d.id}`} className="group relative overflow-hidden rounded-2xl">
                <SmartImage src={d.afterImage} alt={d.title} className="aspect-square w-full transition group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/90 to-transparent" />
                <div className="absolute bottom-0 p-3 text-cream">
                  <div className="text-[10px] text-gold-soft">{d.style} · {toFa(d.creditsUsed)} اعتبار</div>
                  <div className="line-clamp-1 text-sm font-bold">{d.title}</div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="card-surface flex flex-col items-center justify-center px-6 py-16 text-center">
            <Wand2 size={36} className="mb-3 text-ink-muted" />
            <p className="text-sm font-medium text-ink-muted">هنوز طراحی‌ای نساختی</p>
            <ButtonLink href="/ai/design" className="mt-4"><Plus size={16} /> اولین طراحی‌ات را بساز</ButtonLink>
          </div>
        )}
      </div>

      {/* Journey guide */}
      <div className="mt-12 rounded-[var(--radius-xl)] border border-clay/40 bg-ivory-2 p-6">
        <h3 className="mb-4 flex items-center gap-2 font-display text-lg font-bold text-ink"><Sparkles size={18} className="text-gold" /> مسیر طراحی</h3>
        <div className="flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          {["کشف ایده", "آپلود عکس", "تحلیل فضا", "انتخاب وسایل", "تولید طراحی", "بازبینی", "ویرایش", "خرید"].map((step, i, arr) => (
            <span key={step} className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-lg bg-cream px-3 py-1.5 font-medium text-ink">
                <span className="grid h-5 w-5 place-items-center rounded-md bg-terracotta/15 text-[10px] font-bold text-terracotta-deep">{toFa(i + 1)}</span>
                {step}
              </span>
              {i < arr.length - 1 && <ArrowLeft size={14} className="text-clay" />}
            </span>
          ))}
        </div>
      </div>
    </Container>
  );
}

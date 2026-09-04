"use client";
import Link from "next/link";
import { History, Sparkles, Wand2, ShoppingBag } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { SmartImage } from "@/components/ui/SmartImage";
import { Badge, EmptyState, Button } from "@/components/ui/primitives";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { useCredits } from "@/stores/useApp";
import { toFa } from "@/lib/utils";
import { useHasHydrated } from "@/lib/useHasHydrated";

function faDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
}

export default function AIHistoryPage() {
  const balance = useCredits((s) => s.balance);
  const history = useCredits((s) => s.history);
  const sessions = useDesignSessions((s) => s.sessions);
  const hydrated = useHasHydrated();
  const designs = hydrated ? sessions : [];

  return (
    <Container className="py-10">
      <PageHeader eyebrow="AI استودیو" title="تاریخچه طراحی‌ها" desc="همه‌ی طراحی‌هایی که ساخته‌ای را اینجا پیدا کن." action={<Link href="/ai/design"><Button><Sparkles size={16} /> طراحی جدید</Button></Link>} />

      <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
        {/* designs */}
        <div className="space-y-3">
          {designs.length > 0 ? designs.map((d) => (
            <div key={d.id} className="group card-surface overflow-hidden transition hover:-translate-y-0.5">
              <div className="flex gap-4 p-3">
                <Link href={`/ai/result/${d.id}`} className="relative shrink-0">
                  <SmartImage src={d.afterImage} alt={d.title} className="h-24 w-24 shrink-0 rounded-xl" />
                  {d.beforeImage && <SmartImage src={d.beforeImage} alt="" className="absolute -bottom-2 -left-2 h-12 w-12 rounded-lg border-2 border-cream" />}
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge tone="dark">{d.roomType}</Badge>
                    {d.style && <Badge tone="accent">{d.style}</Badge>}
                    <Badge tone="gold">{d.products.length} محصول</Badge>
                  </div>
                  <Link href={`/ai/result/${d.id}`}><h3 className="mt-1.5 truncate font-display font-bold text-ink transition hover:text-terracotta-deep">{d.title}</h3></Link>
                  <p className="truncate text-xs text-ink-muted">{d.prompt}</p>
                  <div className="mt-1 flex items-center gap-3 text-xs text-ink-muted">
                    <span>{faDate(d.createdAt)}</span>
                    <span className="flex items-center gap-1"><Sparkles size={11} className="text-gold" /> {toFa(d.creditsUsed)} اعتبار</span>
                  </div>
                </div>
              </div>
              {/* CONTINUE — not a dead-end */}
              <div className="flex border-t border-clay/30">
                <Link href={`/ai/design?session=${d.id}`} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-terracotta-deep transition hover:bg-ivory-2"><Wand2 size={13} /> ادامه طراحی</Link>
                <Link href={`/ai/result/${d.id}`} className="flex flex-1 items-center justify-center gap-1.5 border-r border-clay/30 py-2.5 text-[11px] font-bold text-ink-muted transition hover:bg-ivory-2"><ShoppingBag size={13} /> مشاهده محصولات</Link>
              </div>
            </div>
          )) : (
            <EmptyState icon={<History size={28} />} title="هنوز طراحی‌ای نساخته‌ای" action={<Link href="/ai/design"><Button>اولین طراحی‌ات را بساز</Button></Link>} />
          )}
        </div>

        {/* credit usage */}
        <aside className="card-surface h-fit p-5 lg:sticky lg:top-24">
          <h3 className="mb-3 font-display font-bold text-ink">مصرف اعتبار</h3>
          <div className="mb-4 rounded-xl bg-ivory-2 p-4 text-center">
            <div className="font-display text-3xl font-black text-ink">{toFa(balance)}</div>
            <div className="text-xs text-ink-muted">اعتبار باقی‌مانده</div>
          </div>
          <div className="space-y-2">
            {history.slice(0, 6).map((t) => (
              <div key={t.id} className="flex items-center justify-between border-b border-clay/30 py-2 text-sm last:border-0">
                <span className="text-ink-muted">{t.reason}</span>
                <span className={t.amount > 0 ? "font-bold text-success" : "font-bold text-danger"}>{t.amount > 0 ? "+" : ""}{toFa(t.amount)}</span>
              </div>
            ))}
          </div>
          <Link href="/account/credits"><Button variant="ghost" className="mt-3 w-full">خرید اعتبار</Button></Link>
        </aside>
      </div>
    </Container>
  );
}

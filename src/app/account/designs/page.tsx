"use client";
import Link from "next/link";
import { Wand2, Sparkles, MoreHorizontal, Copy, Share2 } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { aiDesigns } from "@/data/inspirations";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";

export default function MyDesignsPage() {
  const { toast } = useUi();
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black text-ink">طراحی‌های من</h1>
        <Link href="/ai/design"><Button><Wand2 size={16} /> طراحی جدید</Button></Link>
      </div>

      {aiDesigns.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {aiDesigns.map((d) => (
            <div key={d.id} className="card-surface overflow-hidden">
              <Link href={`/ai/result/${d.id}`} className="group relative block">
                <img src={d.afterImage} alt={d.title} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
                {d.beforeImage && <img src={d.beforeImage} alt="" className="absolute bottom-2 left-2 h-16 w-16 rounded-lg border-2 border-cream object-cover" />}
                <div className="absolute right-2 top-2 flex gap-1"><Badge tone="dark">{d.room}</Badge></div>
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-bold text-ink">{d.title}</h3>
                    <p className="truncate text-xs text-ink-muted">{d.prompt}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => toast("طراحی کپی شد")} aria-label="کپی طراحی" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ivory-2"><Copy size={15} /></button>
                    <button onClick={() => toast("لینک کپی شد", "info")} aria-label="اشتراک‌گذاری" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ivory-2"><Share2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-clay/40 pt-3 text-xs text-ink-muted">
                  <span>{d.createdAt}</span>
                  <span className="flex items-center gap-1"><Sparkles size={11} className="text-gold" /> {toFa(d.creditsUsed)} اعتبار</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={<Wand2 size={28} />} title="هنوز طراحی‌ای نداری" action={<Link href="/ai/design"><Button>اولین طراحی‌ات را بساز</Button></Link>} />}
    </div>
  );
}

"use client";
// «طراحی‌های من» — the user's REAL persisted AI design sessions (was: global
// fixture seeds whose /ai/result links were dead ends). Copy/Share now use
// the real clipboard/share helpers from lib/share.
import Link from "next/link";
import { Wand2, Sparkles, Copy, Share2, Trash2 } from "lucide-react";
import { Badge, Button, EmptyState } from "@/components/ui/primitives";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { useUi } from "@/stores/useApp";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { shareContent, buildShareUrl } from "@/lib/share";
import { toFa } from "@/lib/utils";

const faDate = (iso: number) => {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return "";
  }
};

export default function MyDesignsPage() {
  const { toast } = useUi();
  const hydrated = useHasHydrated();
  const sessions = useDesignSessions((s) => s.sessions);
  const removeSession = useDesignSessions((s) => s.removeSession);
  const designs = hydrated ? sessions : [];

  async function copy(design: { id: string; title: string; prompt: string }) {
    try {
      await navigator.clipboard.writeText(`${design.title}\n${design.prompt}`);
      toast("طراحی کپی شد");
    } catch {
      toast("کپی ممکن نشد", "error");
    }
  }

  async function share(design: { id: string; title: string; prompt: string }) {
    const result = await shareContent({
      title: design.title,
      text: design.prompt,
      url: buildShareUrl(`/ai/result/${design.id}`),
    });
    if (result.method === "failed") toast("اشتراک‌گذاری انجام نشد", "error");
    else toast(result.method === "native" ? "پنجره اشتراک‌گذاری باز شد" : "لینک کپی شد");
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-black text-ink">طراحی‌های من</h1>
        <Link href="/ai/design"><Button><Wand2 size={16} /> طراحی جدید</Button></Link>
      </div>

      {designs.length ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <div key={d.id} className="card-surface overflow-hidden">
              <Link href={`/ai/result/${d.id}`} className="group relative block">
                <img src={d.afterImage} alt={d.title} className="aspect-[4/3] w-full object-cover transition group-hover:scale-105" />
                {d.beforeImage && <img src={d.beforeImage} alt="" className="absolute bottom-2 left-2 h-16 w-16 rounded-lg border-2 border-cream object-cover" />}
                <div className="absolute right-2 top-2 flex gap-1">
                  {d.preview && <Badge tone="gold">پیش‌نمایش</Badge>}
                  <Badge tone="dark">{d.roomType}</Badge>
                </div>
              </Link>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-display font-bold text-ink">{d.title}</h3>
                    <p className="truncate text-xs text-ink-muted">{d.prompt}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <button onClick={() => copy(d)} aria-label="کپی طراحی" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ivory-2"><Copy size={15} /></button>
                    <button onClick={() => share(d)} aria-label="اشتراک‌گذاری" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ivory-2"><Share2 size={15} /></button>
                    <button onClick={() => { removeSession(d.id); toast("طراحی حذف شد"); }} aria-label="حذف طراحی" className="grid h-9 w-9 place-items-center rounded-lg text-ink-muted transition hover:bg-ivory-2 hover:text-danger"><Trash2 size={15} /></button>
                  </div>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-clay/40 pt-3 text-xs text-ink-muted">
                  <span>{faDate(d.createdAt)}</span>
                  <span className="flex items-center gap-1"><Sparkles size={11} className="text-gold" /> {toFa(d.creditsUsed)} اعتبار</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={<Wand2 size={28} />} title="هنوز طراحی‌ای نداری" desc="اولین طراحی AI خودت را بساز — همین‌جا ذخیره می‌شود." action={<Link href="/ai/design"><Button>اولین طراحی‌ات را بساز</Button></Link>} />}
    </div>
  );
}

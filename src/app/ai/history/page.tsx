"use client";
// ============================================================
// AI HISTORY — /ai/history
// Previous designs: thumbnail · date · prompt · style · status ·
// reopen (continue editing) · delete. Real user sessions come
// from the persisted store; demo items are clearly labeled.
// ============================================================
import { useState } from "react";
import Link from "next/link";
import { History, Sparkles, Trash2, Wand2, Clock, ChevronLeft, Layers, Coins } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { Badge, ButtonLink, ConfirmDialog, EmptyState } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { useCredits } from "@/stores/useApp";
import { useDesignSessions, SESSION_STATUS_META, type DesignSession } from "@/stores/useDesignSessions";
import { STYLES } from "@/app/ai/page-config";
import { toFa, cn } from "@/lib/utils";

function formatDate(ts: number): string {
  try {
    return new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(ts));
  } catch {
    return toFa(new Date(ts).toISOString().slice(0, 10));
  }
}

function SessionCard({ session, onDelete }: { session: DesignSession; onDelete: (id: string) => void }) {
  const meta = SESSION_STATUS_META[session.status];
  const styleLabel = STYLES.find((s) => s.id === session.style)?.label ?? session.style;
  const tone = meta.tone === "neutral" ? "dark" : meta.tone === "gold" ? "gold" : meta.tone === "success" ? "success" : "danger";

  return (
    <article className="group card-surface overflow-hidden transition hover:-translate-y-0.5">
      <div className="flex gap-3.5 p-3">
        {/* thumbnails: after (large) + before (small) */}
        <Link href={`/ai/result/${session.id}`} className="relative shrink-0" aria-label={`باز کردن ${session.title}`}>
          <SmartImage src={session.afterImage} alt={session.title} className="h-24 w-24 shrink-0 rounded-xl" />
          <SmartImage src={session.beforeImage} alt="قبل" className="absolute -bottom-2 -left-2 h-11 w-11 rounded-lg border-2 border-cream" />
        </Link>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-1.5">
            <Badge tone={tone as "success" | "gold" | "danger" | "dark"}>{meta.label}</Badge>
            <Badge tone="dark">{session.scope === "full" ? "بازطراحی کامل" : "تغییر هدفمند"}</Badge>
            <Badge tone="accent">{styleLabel}</Badge>
            {session.preview && <Badge tone="gold">پیش‌نمایش</Badge>}
          </div>
          <Link href={`/ai/result/${session.id}`}>
            <h3 className="mt-1.5 line-clamp-1 font-display font-bold text-ink transition hover:text-terracotta-deep">{session.title}</h3>
          </Link>
          {session.prompt && <p className="line-clamp-1 text-xs text-ink-muted">«{session.prompt}»</p>}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
            <span className="flex items-center gap-1"><Clock size={11} /> {formatDate(session.createdAt)}</span>
            <span className="flex items-center gap-1"><Coins size={11} className="text-gold" /> {toFa(session.creditsUsed)} اعتبار</span>
            {session.targets.length > 0 && session.scope === "targeted" && (
              <span className="flex items-center gap-1"><Layers size={11} /> {session.targets.length === 1 ? session.intentSummary : `${toFa(session.targets.length)} عنصر`}</span>
            )}
          </div>
        </div>
      </div>

      {/* actions: reopen (continue) · view · delete */}
      <div className="flex border-t border-clay/30 text-[11px] font-bold">
        <Link href={`/ai?session=${session.id}`} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-terracotta-deep transition hover:bg-ivory-2">
          <Wand2 size={13} /> ادامه ویرایش
        </Link>
        <Link href={`/ai/result/${session.id}`} className="flex flex-1 items-center justify-center gap-1.5 border-r border-clay-300/30 py-2.5 text-ink-muted transition hover:bg-ivory-2 hover:text-ink">
          <ChevronLeft size={13} /> مشاهده نتیجه
        </Link>
        <button onClick={() => onDelete(session.id)} className="flex items-center justify-center gap-1.5 border-r border-clay-300/30 px-4 py-2.5 text-ink-muted transition hover:bg-danger/10 hover:text-danger" aria-label={`حذف ${session.title}`}>
          <Trash2 size={13} />
        </button>
      </div>
    </article>
  );
}

export default function AIHistoryPage() {
  const sessions = useDesignSessions((s) => s.sessions);
  const removeSession = useDesignSessions((s) => s.removeSession);
  const balance = useCredits((s) => s.balance);
  const history = useCredits((s) => s.history);
  const [pendingDelete, setPendingDelete] = useState<DesignSession | null>(null);

  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-8">
        <Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "طراحی هوشمند", href: "/ai" }, { label: "تاریخچه طراحی‌ها" }]} />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 font-display text-2xl font-black text-ink"><History size={22} className="text-terracotta-deep" /> تاریخچه طراحی‌ها</h1>
            <p className="mt-1 text-xs text-ink-muted">هر طراحی اینجا ذخیره می‌شود — دوباره بازش کن، ادامه بده یا حذفش کن.</p>
          </div>
          <ButtonLink href="/ai" variant="accent"><Sparkles size={15} /> طراحی جدید</ButtonLink>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* sessions */}
          <div className="min-w-0 space-y-3">
            {sessions.length > 0 ? (
              sessions.map((s) => <SessionCard key={s.id} session={s} onDelete={(id) => setPendingDelete(sessions.find((x) => x.id === id) ?? null)} />)
            ) : (
              <EmptyState
                icon={<History size={28} />}
                title="هنوز طراحی‌ای نساخته‌ای"
                desc="اولین طراحی‌ات را بساز — چند ثانیه طول نمی‌کشد."
                action={<ButtonLink href="/ai"><Wand2 size={15} /> شروع طراحی</ButtonLink>}
              />
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
                  <span className={cn("font-bold", t.amount > 0 ? "text-success" : "text-danger")}>{t.amount > 0 ? "+" : ""}{toFa(t.amount)}</span>
                </div>
              ))}
              {history.length === 0 && <p className="text-xs text-ink-muted">هنوز اعتباری مصرف نشده.</p>}
            </div>
            <ButtonLink href="/account/credits" variant="ghost" className="mt-3 w-full">خرید اعتبار</ButtonLink>
          </aside>
        </div>
      </Container>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) removeSession(pendingDelete.id); setPendingDelete(null); }}
        title="حذف طراحی"
        description={`«${pendingDelete?.title ?? ""}» برای همیشه حذف می‌شود. مطمئنی؟`}
        confirmLabel="حذف کن"
        destructive
      />
    </div>
  );
}

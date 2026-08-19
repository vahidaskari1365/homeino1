"use client";
import Link from "next/link";
import { History, Sparkles, Wand2, Trash2 } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { EmptyState, ButtonLink } from "@/components/ui/primitives";
import { useCredits } from "@/stores/useApp";
import { useAiHistory } from "@/stores/useAiHistory";
import { toFa } from "@/lib/utils";

export default function AIHistoryPage() {
  const balance = useCredits((s) => s.balance);
  const { items, remove } = useAiHistory();

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="AI Designer"
        title="تاریخچه طراحی‌ها"
        desc="تصویر کوچک، تاریخ، دستور، سبک و وضعیت — بازگشایی یا حذف."
        action={<ButtonLink href="/ai"><Sparkles size={16} /> طراحی جدید</ButtonLink>}
      />

      <div className="grid gap-3 lg:grid-cols-[1fr_280px]">
        <div className="space-y-3">
          {items.length > 0 ? items.map((d) => (
            <div key={d.id} className="card-surface overflow-hidden">
              <div className="flex gap-4 p-3">
                <img src={d.thumbnail} alt="" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{d.prompt || "بدون دستور"}</p>
                  <p className="mt-1 text-xs text-ink-muted">{d.date} · {d.style} · {d.status}</p>
                </div>
              </div>
              <div className="flex border-t border-clay/30">
                <Link href="/ai" className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-[11px] font-bold text-terracotta-deep">
                  <Wand2 size={13} /> بازگشایی
                </Link>
                <button onClick={() => remove(d.id)} className="flex flex-1 items-center justify-center gap-1.5 border-r border-clay/30 py-2.5 text-[11px] font-bold text-danger">
                  <Trash2 size={13} /> حذف
                </button>
              </div>
            </div>
          )) : (
            <EmptyState icon={<History size={28} />} title="هنوز طراحی‌ای نساخته‌ای" action={<ButtonLink href="/ai">اولین طراحی</ButtonLink>} />
          )}
        </div>
        <aside className="card-surface h-fit p-5">
          <div className="text-center">
            <div className="font-display text-3xl font-black">{toFa(balance)}</div>
            <div className="text-xs text-ink-muted">اعتبار باقی‌مانده</div>
          </div>
          <ButtonLink href="/account/credits" variant="ghost" className="mt-3 w-full">خرید اعتبار</ButtonLink>
        </aside>
      </div>
    </Container>
  );
}

"use client";
import { useState } from "react";
import { Store as StoreIcon, Flame, Sparkles, CheckCircle2, BadgeCheck, ShieldCheck, RotateCcw } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Chip } from "@/components/ui/primitives";
import { StoreCard } from "@/components/cards";
import { stores } from "@/data/stores";
import { toFa } from "@/lib/utils";

export default function StoresPage() {
  const [filter, setFilter] = useState<"all" | "trending" | "new" | "verified">("all");
  const list = stores.filter((s) =>
    filter === "all" ? true : filter === "trending" ? s.trending : filter === "new" ? s.isNew : s.verified
  );
  const tabs = [
    { id: "all", label: "همه", icon: StoreIcon },
    { id: "trending", label: "محبوب", icon: Flame },
    { id: "new", label: "جدید", icon: Sparkles },
    { id: "verified", label: "تأیید شده", icon: CheckCircle2 },
  ] as const;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="فروشگاه‌ها" title="فروشگاه‌ها و برندها" desc={`${toFa(stores.length)} فروشگاه در سراسر کشور. هویت، امتیاز و سیاست هر فروشگاه روشن است تا با خیال آسوده خرید کنی.`} />

      <div className="mb-8 grid gap-3 rounded-[var(--radius-lg)] border border-clay/35 bg-cream p-4 sm:grid-cols-3 sm:p-5">
        {[
          [BadgeCheck, "فروشگاه تأیید شده", "فروشنده‌های احراز هویت‌شده با نشان تیک"],
          [ShieldCheck, "پرداخت امن", "وجه تا تحویل کالا نزد Homeino امانت می‌ماند"],
          [RotateCcw, "ضمانت بازگشت", "۷ روز مهلت بازگشت بدون قید و شرط"],
        ].map(([Icon, title, desc]) => {
          const I = Icon as typeof BadgeCheck;
          return (
            <div key={title as string} className="flex items-start gap-3 rounded-xl p-2">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sage/12 text-success"><I size={18} /></span>
              <div><div className="text-sm font-black text-ink">{title as string}</div><p className="mt-0.5 text-xs leading-6 text-ink-muted">{desc as string}</p></div>
            </div>
          );
        })}
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</Chip>)}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => <StoreCard key={s.id} store={s} />)}
      </div>
    </Container>
  );
}

"use client";
// StoresBrowser — فیلتر و گرید فروشگاه‌ها (داده از سرور، Task 60)
import { useState } from "react";
import { Store as StoreIcon, Flame, Sparkles, CheckCircle2 } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Chip } from "@/components/ui/primitives";
import { StoreCard } from "@/components/cards";
import { toFa } from "@/lib/utils";
import type { Store } from "@/types";

export function StoresBrowser({ stores }: { stores: Store[] }) {
  const [filter, setFilter] = useState<"all" | "trending" | "new" | "verified">("all");
  const list = stores.filter((s) =>
    filter === "all" ? true : filter === "trending" ? s.trending : filter === "new" ? s.isNew : s.verified
  );
  const tabs = [
    { id: "all", label: "همه", icon: StoreIcon },
    { id: "trending", label: "محبوب", icon: Flame },
    { id: "new", label: "جدید", icon: Sparkles },
    { id: "verified", label: "تأییدشده", icon: CheckCircle2 },
  ] as const;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="فروشگاه‌ها" title="فروشگاه‌ها و برندها" desc={`${toFa(stores.length)} فروشگاه منتخب در سراسر کشور. محصولات هر فروشگاه را ببین.`} />
      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</Chip>)}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => <StoreCard key={s.id} store={s} />)}
      </div>
      {list.length === 0 && (
        <p className="py-12 text-center text-sm leading-7 text-ink-muted">
          در این دسته هنوز فروشگاهی نیست — فروشگاه‌های تازه به‌محض تأیید همین‌جا نمایش داده می‌شوند.
        </p>
      )}
    </Container>
  );
}

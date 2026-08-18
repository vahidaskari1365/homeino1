"use client";
import { useState } from "react";
import { Store as StoreIcon, Flame, Sparkles, CheckCircle2 } from "lucide-react";
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
      <PageHeader eyebrow="فروشگاه‌ها" title="فروشگاه‌ها و برندها" desc={`${toFa(stores.length)} فروشگاه منتخب در سراسر کشور. محصولات هر فروشگاه را کاوش کن.`} />
      <div className="mb-8 flex flex-wrap gap-2">
        {tabs.map((t) => <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</Chip>)}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => <StoreCard key={s.id} store={s} />)}
      </div>
    </Container>
  );
}

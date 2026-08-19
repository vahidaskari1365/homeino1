"use client";
import { useState } from "react";
import { Store as StoreIcon, Flame, Sparkles, CheckCircle2, Search } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Chip } from "@/components/ui/primitives";
import { StoreCard } from "@/components/cards";
import { stores } from "@/data/stores";
import { categories } from "@/data/categories";
import { toFa } from "@/lib/utils";

export default function StoresPage() {
  const [filter, setFilter] = useState<"all" | "trending" | "new" | "verified">("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const list = stores.filter((store) => {
    if (query.trim() && !`${store.name} ${store.description} ${store.city}`.includes(query.trim())) return false;
    if (category !== "all" && !store.categorySlugs.includes(category)) return false;
    return filter === "all" ? true : filter === "trending" ? store.trending : filter === "new" ? store.isNew : store.verified;
  });
  const tabs = [
    { id: "all", label: "همه", icon: StoreIcon },
    { id: "trending", label: "محبوب", icon: Flame },
    { id: "new", label: "جدید", icon: Sparkles },
    { id: "verified", label: "تأیید شده", icon: CheckCircle2 },
  ] as const;

  return (
    <Container className="py-10">
      <PageHeader eyebrow="بازارگاه چندفروشگاهی" title="فروشگاه مناسب را پیدا کن" desc="هویت، امتیاز، محصولات، ارسال و قوانین هر فروشگاه را پیش از انتخاب ببین." />
      <div className="mb-5 flex min-h-14 items-center gap-3 rounded-2xl border border-clay/40 bg-cream px-4 shadow-[var(--shadow-soft)]"><Search size={18} className="text-ink-muted" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="جستجوی نام فروشگاه، شهر یا تخصص…" className="min-w-0 flex-1 border-0 bg-transparent px-0 text-sm focus:shadow-none" /></div>
      <div className="mb-4 flex flex-wrap gap-2">{tabs.map((t) => <Chip key={t.id} active={filter === t.id} onClick={() => setFilter(t.id)}>{t.label}</Chip>)}</div>
      <div className="hide-scrollbar mb-8 flex gap-2 overflow-x-auto pb-1"><Chip active={category === "all"} onClick={() => setCategory("all")}>همه دسته‌ها</Chip>{categories.map((item) => <Chip key={item.slug} active={category === item.slug} onClick={() => setCategory(item.slug)}>{item.name}</Chip>)}</div>
      <p className="mb-4 text-xs text-ink-muted">{toFa(list.length)} فروشگاه با این معیارها</p>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {list.map((s) => <StoreCard key={s.id} store={s} />)}
      </div>
    </Container>
  );
}

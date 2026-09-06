"use client";
import { useState } from "react";
import { Recycle, Plus, MapPin, Heart, TrendingDown, Tag } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Button, Chip } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { secondHandProducts } from "@/data/secondHand";
import type { SecondHandProduct } from "@/types";
import { categories } from "@/data/categories";
import {
  mergedSecondHandFeed, createSecondHandAd, toggleSavedAd, listSavedAdIds,
  AD_CONDITIONS, MAX_IMAGE_BYTES, type AdCondition,
} from "@/data/localSecondHandAds";
import { useHasHydrated } from "@/lib/useHasHydrated";
import { useDataVersion } from "@/lib/useDataVersion";
import { toFa, formatPrice, cn } from "@/lib/utils";
import { useUi } from "@/stores/useApp";

const CONDITIONS: Record<string, string> = { "نو": "bg-sage/15 text-sage border-sage/30", "خوب": "bg-gold/15 text-gold border-gold/30", "قابل‌قبول": "bg-warning/15 text-warning border-warning/30" };

export default function SecondHandPage() {
  const [cat, setCat] = useState("همه");
  const [showForm, setShowForm] = useState(false);
  const [version, setVersion] = useState(0);
  const hydrated = useHasHydrated();
  useDataVersion(); // live refresh when another tab mutates the local data layer
  const { toast } = useUi();

  // Real, persisted data — user ads come from localStorage after hydration.
  const feed: (SecondHandProduct & { mine?: boolean })[] = hydrated ? mergedSecondHandFeed() : secondHandProducts.map((p) => ({ ...p }));
  const savedIds = hydrated ? listSavedAdIds() : [];
  // Compute the real average saving from the fixtures — never a hardcoded claim.
  const discountPercent = (() => {
    const withOriginal = secondHandProducts.filter((p) => p.originalPrice && p.originalPrice > p.price);
    if (!withOriginal.length) return 0;
    const avg = withOriginal.reduce((sum, p) => sum + ((p.originalPrice! - p.price) / p.originalPrice!) * 100, 0) / withOriginal.length;
    return Math.round(avg);
  })();

  // Category chips are derived from the real catalog slugs used by the data.
  const usedSlugs = Array.from(new Set(feed.map((p) => p.category)));
  const catChips = [{ slug: "همه", label: "همه" }, ...usedSlugs.map((slug) => ({ slug, label: categories.find((c) => c.slug === slug)?.name ?? slug }))];
  const list = cat === "همه" ? feed : feed.filter((p) => p.category === cat);

  function submitAd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const imageFile = fd.get("image");
    const finish = (image?: string) => {
      const result = createSecondHandAd({
        title: String(fd.get("title") ?? ""),
        categorySlug: String(fd.get("category") ?? ""),
        price: Number(String(fd.get("price") ?? "").replace(/[^\d]/g, "")),
        condition: String(fd.get("condition") ?? "").replace("وضعیت: ", "") as AdCondition,
        city: String(fd.get("city") ?? ""),
        age: String(fd.get("age") ?? ""),
        description: String(fd.get("description") ?? ""),
        image,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return;
      }
      toast("آگهی تو منتشر شد — در «حساب من ← آگهی‌های من» هم ذخیره شد");
      setVersion((v) => v + 1);
      setShowForm(false);
    };
    if (imageFile instanceof File && imageFile.size > 0) {
      if (imageFile.size > MAX_IMAGE_BYTES) {
        toast("حجم تصویر باید کمتر از ۸۰۰ کیلوبایت باشد", "error");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => finish(typeof reader.result === "string" ? reader.result : undefined);
      reader.onerror = () => finish(undefined);
      reader.readAsDataURL(imageFile);
    } else {
      finish(undefined);
    }
  }

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="بازار دسته دوم"
        title="محصولات دسته دوم خانه"
        desc="وسایل خانگی کم‌استفاده و سالم را با قیمت مناسب پیدا کن، یا وسایل خودت را آگهی کن."
        action={<Button onClick={() => setShowForm(!showForm)}><Plus size={16} /> ثبت آگهی دسته دوم</Button>}
      />

      {/* CTA banner */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-sage/30 bg-sage/8 p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-sage/15 text-sage"><Recycle size={24} /></span>
          <div>
            <h3 className="font-display font-bold text-ink">اقتصاد چرخشی خانه</h3>
            <p className="text-sm text-ink-muted">با خرید دسته دوم، هم صرفه‌جویی کن و هم به محیط‌زیست کمک کن.</p>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-center"><div className="font-display text-xl font-black text-sage">{toFa(feed.filter((p) => p.status === "active").length)}</div><div className="text-xs text-ink-muted">آگهی فعال</div></div>
          <div className="text-center"><div className="font-display text-xl font-black text-gold">٪{toFa(discountPercent)}</div><div className="text-xs text-ink-muted">ارزان‌تر از نو</div></div>
        </div>
      </div>

      {/* listing form — real categories + real persistence */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-clay/50 bg-cream p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-ink"><Plus size={18} /> ثبت آگهی جدید</h3>
          <form onSubmit={submitAd} className="grid gap-4 sm:grid-cols-2">
            <input required name="title" placeholder="عنوان آگهی" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <select required name="category" defaultValue="" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage">
              <option value="" disabled>دسته‌بندی را انتخاب کن</option>
              {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <input required name="price" type="number" min={1000} placeholder="قیمت (تومان)" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <select required name="condition" defaultValue="خوب" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage">
              {AD_CONDITIONS.map((c) => <option key={c} value={c}>وضعیت: {c}</option>)}
            </select>
            <input required name="city" placeholder="شهر" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <input name="age" placeholder="مدت استفاده (مثلاً ۲ سال)" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <textarea required name="description" minLength={20} placeholder="توضیحات آگهی (حداقل ۲۰ نویسه)..." className="sm:col-span-2 min-h-[80px] resize-none rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-6 text-sm text-ink-muted hover:border-sage sm:col-span-2">
              <Plus size={18} /> افزودن تصویر محصول (اختیاری — حداکثر ۸۰۰ کیلوبایت)
              <input type="file" name="image" accept="image/*" className="hidden" />
            </label>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">ثبت آگهی</Button></div>
          </form>
        </div>
      )}

      {/* filters */}
      <div className="mb-6 flex flex-wrap gap-2">{catChips.map((c) => <Chip key={c.slug} active={cat === c.slug} onClick={() => setCat(c.slug)}>{c.label}</Chip>)}</div>

      {/* grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" data-ads-version={version}>
        {list.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-[var(--radius-lg)] bg-ink shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
            <div className="relative aspect-[3/4] overflow-hidden">
              <SmartImage src={p.image} alt={p.title} className="absolute inset-0 h-full w-full" />
              <div className="absolute right-2 top-2 flex flex-col gap-1">
                <span className={cn("rounded-full border px-2 py-0.5 text-2xs font-bold", CONDITIONS[p.condition])}>{p.condition}</span>
                <span className="flex items-center gap-0.5 rounded-full bg-gold/90 px-2 py-0.5 text-2xs font-bold text-ink"><TrendingDown size={10} /> دسته دوم</span>
                {p.mine && <span className="flex items-center gap-0.5 rounded-full bg-sage px-2 py-0.5 text-2xs font-bold text-cream"><Tag size={10} /> آگهی تو</span>}
                {p.status === "sold" && <span className="rounded-full bg-ink/80 px-2 py-0.5 text-2xs font-bold text-cream">فروخته شد</span>}
              </div>
              <button
                aria-label="افزودن به علاقه‌مندی"
                onClick={() => { const added = toggleSavedAd(p.id); toast(added ? "به نشان‌شده‌ها اضافه شد" : "از نشان‌شده‌ها حذف شد"); setVersion((v) => v + 1); }}
                className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/60 text-cream backdrop-blur transition hover:bg-ink/80"
              >
                <Heart size={15} className={cn(savedIds.includes(p.id) && "fill-terracotta text-terracotta")} />
              </button>
            </div>
            {/* overlay info */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/95 via-ink/75 to-transparent p-3">
              <div className="flex items-center gap-1 text-2xs text-cream/60"><MapPin size={10} /> {p.city} · {p.categoryLabel}</div>
              <p className="mt-0.5 line-clamp-1 text-sm font-bold text-cream">{p.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className={cn("text-sm font-black text-gold-soft", p.status === "sold" && "line-through opacity-60")}>{toFa(formatPrice(p.price))} ت</span>
                {p.originalPrice && <span className="text-2xs text-cream/40 line-through">{toFa(formatPrice(p.originalPrice))}</span>}
              </div>
              <p className="mt-0.5 text-2xs text-cream/50">مدت استفاده: {p.age}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">آگهی‌های دسته دوم توسط کاربران ثبت می‌شوند. Homeino مسئولیت محتوای آگهی را ندارد.</p>
    </Container>
  );
}

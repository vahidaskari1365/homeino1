"use client";
import { useState } from "react";
import Link from "next/link";
import { Recycle, Plus, MapPin, Heart, Tag, TrendingDown } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { Button, Badge, Chip } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { secondHandProducts } from "@/data/secondHand";
import { useWishlist } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { toFa, formatPrice, cn } from "@/lib/utils";

const CONDITIONS: Record<string, string> = { "نو": "bg-sage/15 text-sage border-sage/30", "خوب": "bg-gold/15 text-gold border-gold/30", "قابل‌قبول": "bg-warning/15 text-warning border-warning/30" };

export default function SecondHandPage() {
  const [cat, setCat] = useState("همه");
  const [showForm, setShowForm] = useState(false);
  const wl = useWishlist();
  const { toast } = useUi();

  const cats = ["همه", ...Array.from(new Set(secondHandProducts.map((p) => p.categoryLabel)))];
  const list = cat === "همه" ? secondHandProducts : secondHandProducts.filter((p) => p.categoryLabel === cat);

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
          <div className="text-center"><div className="font-display text-xl font-black text-sage">{toFa(secondHandProducts.length)}</div><div className="text-xs text-ink-muted">آگهی فعال</div></div>
          <div className="text-center"><div className="font-display text-xl font-black text-gold">٪{toFa(50)}+</div><div className="text-xs text-ink-muted">ارزان‌تر از نو</div></div>
        </div>
      </div>

      {/* listing form */}
      {showForm && (
        <div className="mb-8 rounded-2xl border border-clay/50 bg-cream p-5">
          <h3 className="mb-4 flex items-center gap-2 font-display font-bold text-ink"><Plus size={18} /> ثبت آگهی جدید</h3>
          <form onSubmit={(e) => { e.preventDefault(); toast("آگهی شما ثبت شد — پس از تأیید منتشر می‌شود"); setShowForm(false); }} className="grid gap-4 sm:grid-cols-2">
            <input required placeholder="عنوان آگهی" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <select className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage">
              <option>مبلمان</option><option>فرش</option><option>نورپردازی</option><option>دکوراسیون</option><option>فضای کار</option><option>منسوجات</option>
            </select>
            <input required type="number" placeholder="قیمت (تومان)" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <select className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage">
              <option>وضعیت: نو</option><option>وضعیت: خوب</option><option>وضعیت: قابل‌قبول</option>
            </select>
            <input required placeholder="شهر" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <input placeholder="مدت استفاده (مثلاً ۲ سال)" className="rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <textarea required placeholder="توضیحات آگهی..." className="sm:col-span-2 min-h-[80px] resize-none rounded-xl border border-clay/60 bg-ivory-2 p-2.5 text-sm outline-none focus:border-sage" />
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-6 text-sm text-ink-muted hover:border-sage sm:col-span-2">
              <Plus size={18} /> افزودن تصویر محصول
              <input type="file" accept="image/*" className="hidden" />
            </label>
            <div className="sm:col-span-2"><Button type="submit" className="w-full">ثبت آگهی</Button></div>
          </form>
        </div>
      )}

      {/* filters */}
      <div className="mb-6 flex flex-wrap gap-2">{cats.map((c) => <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c}</Chip>)}</div>

      {/* grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((p) => (
          <div key={p.id} className="group relative overflow-hidden rounded-[var(--radius-lg)] bg-ink shadow-[var(--shadow-soft)] transition hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]">
            <div className="relative aspect-[3/4] overflow-hidden">
              <SmartImage src={p.image} alt={p.title} className="absolute inset-0 h-full w-full" />
              <div className="absolute right-2 top-2 flex flex-col gap-1">
                <span className={cn("rounded-full border px-2 py-0.5 text-[10px] font-bold", CONDITIONS[p.condition])}>{p.condition}</span>
                <span className="flex items-center gap-0.5 rounded-full bg-gold/90 px-2 py-0.5 text-[10px] font-bold text-ink"><TrendingDown size={10} /> دسته دوم</span>
              </div>
              <button
                aria-label="افزودن به علاقه‌مندی"
                onClick={() => { wl.toggleProduct(p.id); toast("به علاقه‌مندی اضافه شد"); }}
                className="absolute left-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-ink/60 text-cream backdrop-blur transition hover:bg-ink/80"
              >
                <Heart size={15} />
              </button>
            </div>
            {/* overlay info */}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/95 via-ink/75 to-transparent p-3">
              <div className="flex items-center gap-1 text-[10px] text-cream/60"><MapPin size={10} /> {p.city} · {p.categoryLabel}</div>
              <p className="mt-0.5 line-clamp-1 text-sm font-bold text-cream">{p.title}</p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-sm font-black text-gold-soft">{toFa(formatPrice(p.price))} ت</span>
                {p.originalPrice && <span className="text-[11px] text-cream/40 line-through">{toFa(formatPrice(p.originalPrice))}</span>}
              </div>
              <p className="mt-0.5 text-[10px] text-cream/50">مدت استفاده: {p.age}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-6 text-center text-sm text-ink-muted">آگهی‌های دسته دوم توسط کاربران ثبت می‌شوند. Homeino مسئولیت محتوای آگهی را ندارد.</p>
    </Container>
  );
}

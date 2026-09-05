"use client";
// Second-hand ad form for the account area — same fields as the public
// /second-hand form but in the dashboard card style. Categories come from
// the real catalog; the ad persists via the same localStorage data layer.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Tag } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { categories } from "@/data/categories";
import { createSecondHandAd, AD_CONDITIONS, MAX_IMAGE_BYTES, type AdCondition } from "@/data/localSecondHandAds";
import { useUi } from "@/stores/useApp";
import { cn } from "@/lib/utils";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";
const label = "mb-1.5 block text-sm font-medium text-ink";

export default function SecondHandAdForm() {
  const router = useRouter();
  const { toast } = useUi();
  const [condition, setCondition] = useState<AdCondition>("خوب");
  const [image, setImage] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string>("");
  const [catSlug, setCatSlug] = useState("");
  const [busy, setBusy] = useState(false);

  const subcategories = catSlug ? categories.find((c) => c.slug === catSlug)?.subcategories ?? [] : [];

  function onPickImage(file: File | undefined) {
    if (!file) { setImage(null); setImageName(""); return; }
    if (file.size > MAX_IMAGE_BYTES) {
      toast("حجم تصویر باید کمتر از ۸۰۰ کیلوبایت باشد", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") { setImage(reader.result); setImageName(file.name); }
    };
    reader.readAsDataURL(file);
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    const fd = new FormData(e.currentTarget);
    const result = createSecondHandAd({
      title: String(fd.get("title") ?? ""),
      categorySlug: String(fd.get("category") ?? ""),
      price: Number(String(fd.get("price") ?? "").replace(/[^\d]/g, "")),
      condition,
      city: String(fd.get("city") ?? ""),
      age: String(fd.get("age") ?? ""),
      reason: String(fd.get("reason") ?? ""),
      description: String(fd.get("description") ?? ""),
      image: image ?? undefined,
    });
    if (!result.ok) {
      toast(result.error, "error");
      setBusy(false);
      return;
    }
    toast("آگهی تو ثبت شد و در بازار دسته دوم منتشر شد");
    router.push("/account/ads");
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={label}>عنوان آگهی</label>
        <input name="title" required minLength={3} placeholder="مثلاً: کاناپه سه نفره طوسی" className={input} />
      </div>
      <div>
        <label className={label}>دسته‌بندی (از دسته‌های واقعی سایت)</label>
        <select name="category" required defaultValue="" onChange={(e) => setCatSlug(e.target.value)} className={input}>
          <option value="" disabled>انتخاب دسته</option>
          {categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>زیردسته (اختیاری)</label>
        <select name="subCategory" className={input} disabled={!subcategories.length}>
          <option value="">—</option>
          {subcategories.map((s) => <option key={s.slug} value={s.slug}>{s.name}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>قیمت (تومان)</label>
        <input name="price" required type="number" min={1000} dir="ltr" placeholder="9500000" className={input} />
      </div>
      <div>
        <label className={label}>وضعیت کالا</label>
        <div className="flex gap-2">
          {AD_CONDITIONS.map((c) => (
            <button type="button" key={c} onClick={() => setCondition(c)} className={cn("flex-1 rounded-xl border px-3 py-2.5 text-sm transition", condition === c ? "border-ink bg-ink text-cream" : "border-clay/60 text-ink hover:border-ink")}>{c}</button>
          ))}
        </div>
      </div>
      <div>
        <label className={label}>شهر</label>
        <input name="city" required placeholder="تهران" className={input} />
      </div>
      <div>
        <label className={label}>مدت استفاده</label>
        <input name="age" placeholder="مثلاً ۲ سال" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>دلیل فروش</label>
        <input name="reason" placeholder="مثلاً اسباب‌کشی" className={input} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>توضیحات</label>
        <textarea name="description" required minLength={20} rows={3} placeholder="جزئیات کالا، سالم بودن، امکان تست و…" className={cn(input, "resize-none")} />
      </div>
      <div className="sm:col-span-2">
        <label className={label}>تصویر (اختیاری — حداکثر ۸۰۰ کیلوبایت)</label>
        <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clay/60 bg-cream py-6 text-sm text-ink-muted transition hover:border-sage">
          <Plus size={18} /> {imageName ? `انتخاب شد: ${imageName}` : "افزودن تصویر محصول"}
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0])} />
        </label>
      </div>
      <div className="sm:col-span-2 flex items-center gap-2 rounded-lg bg-ivory-2 p-3 text-[11px] leading-6 text-ink-muted">
        <Tag size={14} className="shrink-0" />
        <span>آگهی تو بلافاصله در صفحهٔ «بازار دسته دوم» با برچسب «آگهی تو» منتشر می‌شود و در همین حساب هم ذخیره می‌ماند.</span>
      </div>
      <div className="sm:col-span-2"><Button type="submit" disabled={busy}>ثبت آگهی</Button></div>
    </form>
  );
}

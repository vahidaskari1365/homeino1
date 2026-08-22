"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, ImagePlus } from "lucide-react";
import { Button, Spinner, FaNumberInput } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";

export default function NewProductPage() {
  const router = useRouter(); const { toast } = useUi(); const [loading, setLoading] = useState(false);
  const [price, setPrice] = useState(""); const [discount, setDiscount] = useState(""); const [stock, setStock] = useState("1");
  const submit = (e: React.FormEvent) => { e.preventDefault(); setLoading(true); setTimeout(() => { setLoading(false); toast("محصول با موفقیت ثبت شد"); router.push("/vendor/products"); }, 1000); };
  const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";
  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">افزودن محصول جدید</h1>
      <form onSubmit={submit} className="card-surface grid gap-5 p-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-ink">تصاویر محصول</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-10 text-center hover:border-ink">
            <ImagePlus size={28} className="text-ink-muted" /><span className="text-sm text-ink-muted">تصاویر را اینجا بکش یا کلیک کن (حداکثر ۸ تصویر)</span><input type="file" multiple className="hidden" />
          </label>
        </div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">نام محصول</label><input required placeholder="مثلاً کاناپه ۳ نفره" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">برند</label><input placeholder="برند" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">دسته‌بندی</label><select className={input}>{categories.map((c) => <option key={c.id}>{c.name}</option>)}</select></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">زیردسته</label><select className={input}>{categories[0].subcategories.map((s) => <option key={s.id}>{s.name}</option>)}</select></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">قیمت (تومان)</label><FaNumberInput value={price} onChange={setPrice} placeholder="مثلاً ۲۵٬۰۰۰٬۰۰۰" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">قیمت با تخفیف (اختیاری)</label><FaNumberInput value={discount} onChange={setDiscount} placeholder="۰" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">موجودی</label><FaNumberInput value={stock} onChange={setStock} placeholder="۱" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">ابعاد</label><input placeholder="۱۲۰ × ۸۰ × ۷۵" className={input} /></div>
        <div className="lg:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات</label><textarea rows={3} className={`${input} resize-none`} /></div>
        <div className="lg:col-span-2 flex gap-3"><Button type="submit" disabled={loading}>{loading ? <><Spinner /> در حال ثبت…</> : <><Upload size={16} /> ثبت محصول</>}</Button><Button type="button" variant="ghost" onClick={() => router.back()}>انصراف</Button></div>
      </form>
    </div>
  );
}

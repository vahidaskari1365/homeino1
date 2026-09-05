"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { addVendorProduct } from "@/data/vendorSession";

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useUi();
  const [loading, setLoading] = useState(false);

  const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9۰-۹٠-٩]/g, ""));
    const stock = Number(String(fd.get("stock") ?? "0").replace(/[^0-9۰-۹٠-٩]/g, "")) || 0;
    const product = addVendorProduct({
      name: String(fd.get("name") ?? ""),
      brand: String(fd.get("brand") ?? ""),
      categorySlug: String(fd.get("category") ?? "furniture"),
      subCategorySlug: String(fd.get("subcategory") ?? "sofa"),
      price,
      stockCount: stock,
      description: String(fd.get("description") ?? ""),
    });
    setTimeout(() => { setLoading(false); toast(`محصول «${product.name}» ثبت شد`); router.push("/vendor/products"); }, 600);
  };

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">افزودن محصول جدید</h1>
      <form onSubmit={submit} className="card-surface grid gap-5 p-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-ink">تصاویر محصول</label>
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-10 text-center hover:border-ink">
            <span className="text-sm text-ink-muted">در این دمو، تصویر پیش‌فرض مجموعه برای محصول جدید استفاده می‌شود.</span><input type="file" multiple className="hidden" disabled />
          </label>
        </div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">نام محصول</label><input name="name" required placeholder="مثلاً میز تلویزیون گردو" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">برند</label><input name="brand" placeholder="نور مبلمان" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">دسته‌بندی</label><select name="category" className={input}>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">زیردسته</label><select name="subcategory" className={input}>{categories.flatMap((c) => c.subcategories).slice(0, 12).map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</select></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">قیمت (تومان)</label><input name="price" inputMode="numeric" required placeholder="مثلاً 12500000" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">موجودی</label><input name="stock" inputMode="numeric" defaultValue="5" className={input} /></div>
        <div className="lg:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات</label><textarea name="description" rows={3} className={`${input} resize-none`} /></div>
        <div className="lg:col-span-2 flex gap-3">
          <Button type="submit" disabled={loading}>{loading ? <><Spinner /> در حال ثبت…</> : <><Upload size={16} /> ثبت محصول</>}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>انصراف</Button>
        </div>
      </form>
    </div>
  );
}

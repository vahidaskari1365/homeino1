"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, LogIn, Info } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { categories } from "@/data/categories";
import { addVendorProduct } from "@/data/vendorSession";
import { fetchVendorMeCached, createVendorProduct, isDemoFallback } from "@/lib/vendorClient";
import ProductImageUploader from "@/components/vendor/ProductImageUploader";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

type Mode =
  | { kind: "loading" }
  | { kind: "real" }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function NewProductPage() {
  const router = useRouter();
  const { toast } = useUi();
  const [mode, setMode] = useState<Mode>({ kind: "loading" });
  const [loading, setLoading] = useState(false);
  // تصویر محصول در حالت واقعی — خروجی ایجنت استانداردسازی (URL نهایی)
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  // Same honest gate as the rest of the vendor panel: real API first, demo
  // store only on 503 DEMO_MODE / network failure.
  useEffect(() => {
    let alive = true;
    void fetchVendorMeCached().then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real" });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  const submitReal = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9]/g, ""));
    const quantity = Number(String(fd.get("quantity") ?? "0").replace(/[^0-9]/g, "")) || 0;
    const title = String(fd.get("title") ?? "").trim();
    if (!title || title.length < 3) { toast("عنوان محصول حداقل ۳ کاراکتر است", "error"); return; }
    if (!price || price <= 0) { toast("قیمت معتبر وارد کن", "error"); return; }
    setLoading(true);
    void createVendorProduct({
      title,
      price,
      quantity,
      brand: String(fd.get("brand") ?? "").trim() || undefined,
      description: String(fd.get("description") ?? "").trim() || undefined,
      imageUrl: imageUrl ?? undefined,
    }).then((res) => {
      if (res.ok) {
        toast(`محصول «${title}» ثبت شد (وضعیت: پیش‌نویس)`, "success");
        router.push("/vendor/products");
      } else {
        setLoading(false);
        toast(res.message ?? "ثبت محصول ناموفق بود", "error");
      }
    });
  };

  const submitDemo = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9۰-۹٠-٩]/g, ""));
    const stock = Number(String(fd.get("stock") ?? "0").replace(/[^0-9۰-۹٠-٩]/g, "")) || 0;
    const product = addVendorProduct({
      name: String(fd.get("title") ?? ""),
      brand: String(fd.get("brand") ?? ""),
      categorySlug: String(fd.get("category") ?? "furniture"),
      subCategorySlug: String(fd.get("subcategory") ?? "sofa"),
      price,
      stockCount: stock,
      description: String(fd.get("description") ?? ""),
    });
    setTimeout(() => { setLoading(false); toast(`محصول «${product.name}» ثبت شد`); router.push("/vendor/products"); }, 600);
  };

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال بررسی اتصال…</div>;
  }
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">برای ثبت محصول واقعی، وارد حساب فروشندگی خود شوید.</p>
        <a href="/login?next=%2Fvendor%2Fproducts%2Fnew" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در اتصال به سرور</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }

  const isReal = mode.kind === "real";

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-black text-ink">افزودن محصول جدید</h1>
      {!isReal && (
        <p className="rounded-xl border border-gold/30 bg-gold/8 px-4 py-2.5 text-xs leading-6 text-ink">
          حالت دمو: محصول در پنل محلی ذخیره می‌شود و در صفحهٔ عمومی فروشگاه نمونه نمایش داده می‌شود.
        </p>
      )}
      <form onSubmit={isReal ? submitReal : submitDemo} className="card-surface grid gap-5 p-6 lg:grid-cols-2">
        <div className="lg:col-span-2">
          {isReal ? (
            <ProductImageUploader value={imageUrl} onChange={setImageUrl} />
          ) : (
            <>
              <label className="mb-2 block text-sm font-medium text-ink">تصاویر محصول</label>
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-10 text-center hover:border-ink">
                <span className="text-sm text-ink-muted">در این دمو، تصویر پیش‌فرض مجموعه برای محصول جدید استفاده می‌شود.</span><input type="file" multiple className="hidden" disabled />
              </label>
            </>
          )}
        </div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">نام محصول</label><input name="title" required minLength={3} placeholder="مثلاً میز تلویزیون گردو" className={input} /></div>
        <div><label className="mb-1.5 block text-sm font-medium text-ink">برند</label><input name="brand" placeholder={isReal ? "نام برند فروشگاه" : "نور مبلمان"} className={input} /></div>
        {isReal ? (
          <>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">قیمت (تومان)</label><input name="price" inputMode="numeric" required placeholder="مثلاً 12500000" className={input} /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">موجودی</label><input name="quantity" inputMode="numeric" defaultValue="5" className={input} /></div>
          </>
        ) : (
          <>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">دسته‌بندی</label><select name="category" className={input}>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select></div>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">زیردسته</label><select name="subcategory" className={input}>{categories.flatMap((c) => c.subcategories).slice(0, 12).map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</select></div>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">قیمت (تومان)</label><input name="price" inputMode="numeric" required placeholder="مثلاً 12500000" className={input} /></div>
            <div><label className="mb-1.5 block text-sm font-medium text-ink">موجودی</label><input name="stock" inputMode="numeric" defaultValue="5" className={input} /></div>
          </>
        )}
        <div className="lg:col-span-2"><label className="mb-1.5 block text-sm font-medium text-ink">توضیحات</label><textarea name="description" rows={3} className={`${input} resize-none`} /></div>
        <div className="lg:col-span-2 flex gap-3">
          <Button type="submit" disabled={loading}>{loading ? <><Spinner /> در حال ثبت…</> : <><Upload size={16} /> ثبت محصول</>}</Button>
          <Button type="button" variant="ghost" onClick={() => router.back()}>انصراف</Button>
        </div>
      </form>
    </div>
  );
}

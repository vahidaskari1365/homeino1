"use client";
import { Plus, Search, Pencil, Trash2, PackagePlus, Save } from "lucide-react";
import { Button, Badge, Rating, Modal } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { listVendorProducts, removeVendorProduct, addVendorProduct, updateVendorProduct, type VendorDraftProduct } from "@/data/vendorSession";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { categories } from "@/data/categories";
import { toFa, formatPrice } from "@/lib/utils";
import { useMemo, useState } from "react";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

export default function VendorProductsPage() {
  const { toast } = useUi();
  const [q, setQ] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // Derived straight from the session store: every mutation bumps its version
  // (and the post-hydration restore lands as a version change too), so the
  // table is always a pure projection of vendorSession — no local copy.
  const vsVersion = useVendorSessionVersion();
  const products = useMemo(() => {
    void vsVersion;
    return listVendorProducts();
  }, [vsVersion]);

  const editing = products.find((p) => p.id === editId) ?? null;
  const list = products.filter((p) => (q.trim() ? p.name.includes(q.trim()) || (p.sku ?? "").includes(q.trim()) : true));

  function remove(id: string, name: string) {
    removeVendorProduct(id);
    toast(`«${name}» حذف شد`, "info");
  }

  function changeStock(id: string, delta: number) {
    const product = products.find((p) => p.id === id);
    if (!product) return;
    updateVendorProduct(id, { stockCount: Math.max(0, product.stockCount + delta) });
  }

  function saveNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9۰-۹٠-٩]/g, ""));
    const stock = Number(String(fd.get("stock") ?? "0").replace(/[^0-9۰-۹٠-٩]/g, "")) || 0;
    if (!price || price <= 0) { toast("قیمت معتبر وارد کن", "error"); return; }
    const draft: VendorDraftProduct = {
      name: String(fd.get("name") ?? ""),
      brand: String(fd.get("brand") ?? ""),
      categorySlug: String(fd.get("category") ?? "furniture"),
      subCategorySlug: String(fd.get("subcategory") ?? "sofa"),
      price,
      stockCount: stock,
      description: String(fd.get("description") ?? ""),
    };
    const created = addVendorProduct(draft);
    setShowAdd(false);
    toast(`محصول «${created.name}» ثبت شد`);
  }

  function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9۰-۹٠-٩]/g, ""));
    const stock = Number(String(fd.get("stock") ?? "0").replace(/[^0-9۰-۹٠-٩]/g, "")) || 0;
    updateVendorProduct(editing.id, {
      name: String(fd.get("name") ?? ""),
      price: price || undefined,
      stockCount: stock,
    });
    setEditId(null);
    toast("محصول بروزرسانی شد");
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-ink">محصولات ({toFa(products.length)})</h1>
        <Button onClick={() => setShowAdd(true)}><Plus size={16} /> افزودن محصول</Button>
      </div>
      <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
        <Search size={17} className="text-ink-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول…" className="flex-1 bg-transparent px-2 py-2.5 text-sm outline-none" />
      </div>
      <div className="overflow-hidden card-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
              <th className="p-3 font-medium">محصول</th><th className="p-3 font-medium">قیمت</th><th className="p-3 font-medium">موجودی</th><th className="p-3 font-medium">امتیاز</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium"></th>
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3"><div className="flex items-center gap-2"><img src={p.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="line-clamp-1 font-medium text-ink">{p.name}<span dir="ltr" className="mr-2 text-2xs text-ink-muted">{p.sku}</span></span></div></td>
                  <td className="p-3 whitespace-nowrap text-ink">{toFa(formatPrice(p.price))} ت</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="ml-1 text-ink">{toFa(p.stockCount)}</span>
                    <button onClick={() => changeStock(p.id, -1)} className="rounded border border-clay/60 px-1.5 text-xs text-ink-muted hover:border-danger hover:text-danger" aria-label="کاهش موجودی">−</button>
                    <button onClick={() => changeStock(p.id, 1)} className="mr-1 rounded border border-clay/60 px-1.5 text-xs text-ink-muted hover:border-sage hover:text-success" aria-label="افزایش موجودی">+</button>
                  </td>
                  <td className="p-3"><Rating value={p.rating} /></td>
                  <td className="p-3">{p.inStock ? <Badge tone="success">موجود</Badge> : <Badge tone="dark">ناموجود</Badge>}</td>
                  <td className="p-3"><div className="flex justify-end gap-1">
                    <button onClick={() => setEditId(p.id)} aria-label="ویرایش محصول" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Pencil size={15} /></button>
                    <button onClick={() => remove(p.id, p.name)} aria-label="حذف محصول" className="grid h-9 w-9 place-items-center rounded-lg text-danger transition hover:bg-danger/10"><Trash2 size={15} /></button>
                  </div></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={6} className="p-8 text-center text-sm text-ink-muted">محصولی مطابق جستجو نیست.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* add product — writes into the demo session */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="افزودن محصول جدید" description="محصول در پنل فروشنده ذخیره می‌شود، در صفحهٔ عمومی فروشگاه هم نمایش داده می‌شود و با رفرش هم نمی‌پرد.">
        <form onSubmit={saveNew} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-ink-muted">نام محصول</label><input name="name" required placeholder="مثلاً میز تلویزیون گردو" className={input} /></div>
          <div><label className="mb-1 block text-sm text-ink-muted">برند</label><input name="brand" placeholder="نور مبلمان" className={input} /></div>
          <div><label className="mb-1 block text-sm text-ink-muted">دسته</label>
            <select name="category" className={input}>{categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
          </div>
          <div><label className="mb-1 block text-sm text-ink-muted">زیردسته</label>
            <select name="subcategory" className={input}>{categories.flatMap((c) => c.subcategories).slice(0, 12).map((s) => <option key={s.id} value={s.slug}>{s.name}</option>)}</select>
          </div>
          <div><label className="mb-1 block text-sm text-ink-muted">موجودی</label><input name="stock" inputMode="numeric" defaultValue="5" className={input} /></div>
          <div><label className="mb-1 block text-sm text-ink-muted">قیمت (تومان)</label><input name="price" inputMode="numeric" required placeholder="مثلاً 12500000" className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-ink-muted">توضیحات</label><textarea name="description" rows={2} className={`${input} resize-none`} /></div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit"><PackagePlus size={15} /> ثبت محصول</Button>
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>انصراف</Button>
          </div>
        </form>
      </Modal>

      {/* edit product */}
      <Modal open={Boolean(editing)} onClose={() => setEditId(null)} title={`ویرایش ${editing?.name ?? ""}`} description="تغییر نام، قیمت یا موجودی در حافظهٔ دمو ذخیره می‌شود.">
        {editing && (
          <form onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="mb-1 block text-sm text-ink-muted">نام محصول</label><input name="name" defaultValue={editing.name} className={input} /></div>
            <div><label className="mb-1 block text-sm text-ink-muted">قیمت (تومان)</label><input name="price" inputMode="numeric" defaultValue={editing.price} className={input} /></div>
            <div><label className="mb-1 block text-sm text-ink-muted">موجودی</label><input name="stock" inputMode="numeric" defaultValue={editing.stockCount} className={input} /></div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit"><Save size={15} /> ذخیره</Button>
              <Button type="button" variant="ghost" onClick={() => setEditId(null)}>انصراف</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

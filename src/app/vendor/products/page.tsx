"use client";
import { useEffect, useMemo, useState } from "react";
import { Plus, Search, Pencil, Trash2, PackagePlus, Save, LogIn, Info } from "lucide-react";
import { Button, Badge, Modal, Spinner } from "@/components/ui/primitives";
import { useUi } from "@/stores/useApp";
import { listVendorProducts, removeVendorProduct, addVendorProduct, updateVendorProduct, type VendorDraftProduct } from "@/data/vendorSession";
import { useVendorSessionVersion } from "@/lib/useVendorSessionVersion";
import { categories } from "@/data/categories";
import { toFa, formatPrice } from "@/lib/utils";
import {
  fetchVendorProducts,
  createVendorProduct,
  updateVendorProduct as patchVendorProduct,
  deleteVendorProduct as destroyVendorProduct,
  isDemoFallback,
  toman,
  PRODUCT_STATUS_LABEL,
  PRODUCT_STATUS_TONE,
  type VendorProductRow,
} from "@/lib/vendorClient";
import ProductImageUploader from "@/components/vendor/ProductImageUploader";

const input = "w-full rounded-xl border border-clay/60 bg-cream p-2.5 text-sm outline-none focus:border-ink";

type Mode =
  | { kind: "loading" }
  | { kind: "real" }
  | { kind: "demo" }
  | { kind: "auth" }
  | { kind: "error"; message: string };

export default function VendorProductsPage() {
  const [mode, setMode] = useState<Mode>({ kind: "loading" });

  // Real backend first — the demo session store below is ONLY a fallback for
  // DB-less deployments (503 DEMO_MODE) or a dead network (status 0).
  useEffect(() => {
    let alive = true;
    void fetchVendorProducts(1, 50).then((res) => {
      if (!alive) return;
      if (res.ok) setMode({ kind: "real" });
      else if (isDemoFallback(res)) setMode({ kind: "demo" });
      else if (res.status === 401) setMode({ kind: "auth" });
      else setMode({ kind: "error", message: res.message ?? "خطای ناشناختهٔ سرور" });
    });
    return () => { alive = false; };
  }, []);

  if (mode.kind === "loading") {
    return <div className="card-surface flex items-center justify-center gap-3 p-10 text-sm text-ink-muted"><Spinner /> در حال دریافت محصولات…</div>;
  }
  if (mode.kind === "demo") return <DemoProductsPage />;
  if (mode.kind === "auth") {
    return (
      <div className="card-surface p-8 text-center">
        <LogIn size={22} className="mx-auto text-terracotta-deep" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">ابتدا وارد شوید</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">برای مدیریت محصولات واقعی فروشگاه، وارد حساب کاربری خود شوید.</p>
        <a href="/login?next=%2Fvendor%2Fproducts" className="mt-4 inline-block"><Button>ورود به حساب</Button></a>
      </div>
    );
  }
  if (mode.kind === "error") {
    return (
      <div className="card-surface p-8 text-center">
        <Info size={22} className="mx-auto text-danger" />
        <h1 className="mt-3 font-display text-lg font-black text-ink">خطا در دریافت محصولات</h1>
        <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-ink-muted">{mode.message}</p>
      </div>
    );
  }
  return <RealProductsPage />;
}

/* ============================================================
   REAL PRODUCTS — POST/PATCH/DELETE /api/vendor/products
   ============================================================ */

function RealProductsPage() {
  const { toast } = useUi();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<VendorProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<VendorProductRow | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  // تصویر مودال‌ها — خروجی ایجنت استانداردسازی (URL نهایی)
  const [addImageUrl, setAddImageUrl] = useState<string | null>(null);
  const [editImageUrl, setEditImageUrl] = useState<string | null>(null);
  // Manual refresh trigger — mutations bump it and the effect refetches
  // (setState stays out of the effect body — repo lint rule).
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void fetchVendorProducts(1, 50).then((res) => {
      if (!alive) return;
      setLoading(false);
      if (res.ok) {
        setItems(res.data.items);
        setLoadError("");
      } else {
        // Honest error — real failures are never masked with demo data.
        setLoadError(res.message ?? "دریافت محصولات ناموفق بود");
      }
    });
    return () => { alive = false; };
  }, [tick]);

  function refresh() {
    setLoading(true);
    setTick((t) => t + 1);
  }

  const list = useMemo(() => {
    const needle = q.trim();
    if (!needle) return items;
    return items.filter((p) => p.title.includes(needle) || p.slug.includes(needle));
  }, [items, q]);

  async function changeStock(product: VendorProductRow, delta: number) {
    const next = Math.max(0, (product.quantity ?? 0) + delta);
    setBusyId(product.id);
    const res = await patchVendorProduct(product.id, { quantity: next });
    setBusyId(null);
    if (res.ok) {
      setItems((prev) => prev.map((p) => (p.id === product.id ? { ...p, quantity: next } : p)));
    } else {
      toast(res.message ?? "تغییر موجودی ناموفق بود", "error");
    }
  }

  function saveNew(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9۰-۹٠-٩]/g, ""));
    const quantity = Number(String(fd.get("quantity") ?? "0").replace(/[^0-9۰-۹٠-٩]/g, "")) || 0;
    const title = String(fd.get("title") ?? "").trim();
    if (!title || title.length < 3) { toast("عنوان محصول حداقل ۳ کاراکتر است", "error"); return; }
    if (!price || price <= 0) { toast("قیمت معتبر وارد کن", "error"); return; }
    setSaving(true);
    void createVendorProduct({
      title,
      price,
      quantity,
      brand: String(fd.get("brand") ?? "").trim() || undefined,
      description: String(fd.get("description") ?? "").trim() || undefined,
      imageUrl: addImageUrl ?? undefined,
    }).then((res) => {
      setSaving(false);
      if (res.ok) {
        setShowAdd(false);
        setAddImageUrl(null);
        toast(`محصول «${title}» ثبت شد (وضعیت: پیش‌نویس)`, "success");
        refresh();
      } else {
        toast(res.message ?? "ثبت محصول ناموفق بود", "error");
      }
    });
  }

  function saveEdit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    const price = Number(String(fd.get("price") ?? "").replace(/[^0-9۰-۹٠-٩]/g, ""));
    const quantity = Number(String(fd.get("quantity") ?? "0").replace(/[^0-9۰-۹٠-٩]/g, "")) || 0;
    const status = String(fd.get("status") ?? "draft") as "draft" | "active" | "out_of_stock" | "archived";
    // عکس فقط وقتی فرستاده می‌شود که فروشنده واقعاً عوضش کرده — پاک‌سازی بی‌صدا ممنوع
    const imageChanged = editImageUrl !== null && editImageUrl !== editing.image;
    setSaving(true);
    void patchVendorProduct(editing.id, {
      title: String(fd.get("title") ?? "").trim() || undefined,
      price: price > 0 ? price : undefined,
      quantity,
      status,
      ...(imageChanged ? { imageUrl: editImageUrl } : {}),
    }).then((res) => {
      setSaving(false);
      if (res.ok) {
        setEditing(null);
        toast("محصول بروزرسانی شد", "success");
        refresh();
      } else {
        toast(res.message ?? "بروزرسانی محصول ناموفق بود", "error");
      }
    });
  }

  function remove(product: VendorProductRow) {
    setBusyId(product.id);
    void destroyVendorProduct(product.id).then((res) => {
      setBusyId(null);
      setConfirmDeleteId(null);
      if (res.ok) {
        toast(`«${product.title}» حذف شد`, "info");
        refresh();
      } else {
        toast(res.message ?? "حذف محصول ناموفق بود", "error");
      }
    });
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-xl font-black text-ink">محصولات ({toFa(items.length)})</h1>
        <Button onClick={() => setShowAdd(true)}><Plus size={16} /> افزودن محصول</Button>
      </div>
      <div className="flex items-center rounded-xl border border-clay/60 bg-cream px-3 focus-within:border-ink">
        <Search size={17} className="text-ink-muted" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجوی محصول…" className="flex-1 bg-transparent px-2 py-2.5 text-sm outline-none" />
      </div>

      {loadError && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-danger/30 bg-danger/8 px-4 py-2.5 text-sm text-ink">
          <Info size={15} className="mt-0.5 shrink-0 text-danger" /> {loadError}
        </p>
      )}

      <div className="overflow-hidden card-surface">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead><tr className="border-b border-clay/40 bg-ivory-2 text-right text-xs text-ink-muted">
              <th className="p-3 font-medium">محصول</th><th className="p-3 font-medium">قیمت</th><th className="p-3 font-medium">موجودی</th><th className="p-3 font-medium">وضعیت</th><th className="p-3 font-medium"></th>
            </tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} className="border-b border-clay/30 hover:bg-ivory-2/50">
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {p.image ? <img width="40" height="40" src={p.image} alt="" className="h-10 w-10 rounded-lg object-cover" /> : <span className="grid h-10 w-10 place-items-center rounded-lg bg-ivory-2 text-2xs text-ink-muted">بی‌عکس</span>}
                      <span className="line-clamp-1 font-medium text-ink">{p.title}<span dir="ltr" className="mr-2 text-2xs text-ink-muted">{p.slug}</span></span>
                    </div>
                  </td>
                  <td className="p-3 whitespace-nowrap text-ink">{toman(p.price)}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="ml-1 text-ink">{toFa(p.quantity ?? 0)}</span>
                    <button onClick={() => void changeStock(p, -1)} disabled={busyId === p.id} className="rounded border border-clay/60 px-1.5 text-xs text-ink-muted hover:border-danger hover:text-danger disabled:opacity-40" aria-label="کاهش موجودی">−</button>
                    <button onClick={() => void changeStock(p, 1)} disabled={busyId === p.id} className="mr-1 rounded border border-clay/60 px-1.5 text-xs text-ink-muted hover:border-sage hover:text-success disabled:opacity-40" aria-label="افزایش موجودی">+</button>
                    {p.reservedQuantity ? <span className="mr-2 text-2xs text-ink-muted">({toFa(p.reservedQuantity)} رزرو)</span> : null}
                  </td>
                  <td className="p-3"><Badge tone={PRODUCT_STATUS_TONE[p.status] ?? "neutral"}>{PRODUCT_STATUS_LABEL[p.status] ?? p.status}</Badge></td>
                  <td className="p-3"><div className="flex justify-end gap-1">
                    <button onClick={() => { setEditing(p); setEditImageUrl(null); }} aria-label="ویرایش محصول" className="grid h-9 w-9 place-items-center rounded-lg transition hover:bg-ivory-2"><Pencil size={15} /></button>
                    {confirmDeleteId === p.id ? (
                      <button onClick={() => void remove(p)} disabled={busyId === p.id} aria-label="تأیید حذف محصول" className="rounded-lg bg-danger px-2 text-2xs font-bold text-white transition hover:opacity-90">تأیید حذف</button>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(p.id)} aria-label="حذف محصول" className="grid h-9 w-9 place-items-center rounded-lg text-danger transition hover:bg-danger/10"><Trash2 size={15} /></button>
                    )}
                  </div></td>
                </tr>
              ))}
              {!list.length && !loading && <tr><td colSpan={5} className="p-8 text-center text-sm text-ink-muted">{q ? "محصولی مطابق جستجو نیست." : "هنوز محصولی ثبت نکرده‌ای — با «افزودن محصول» شروع کن."}</td></tr>}
              {loading && <tr><td colSpan={5} className="p-8 text-center text-sm text-ink-muted"><Spinner /> در حال بروزرسانی…</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-2xs leading-6 text-ink-muted">محصول جدید با وضعیت «پیش‌نویس» ثبت می‌شود و پس از فعال‌سازی (ویرایش ← وضعیت) در فروشگاه عمومی دیده می‌شود. حذف، نرم است و سفارش‌های قبلی دست‌نخورده می‌مانند.</p>

      {/* add product — real POST /api/vendor/products */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="افزودن محصول جدید" description="محصول واقعی روی سرور هومینو ثبت می‌شود؛ اول به‌صورت پیش‌نویس، تا وقتی خودت فعالش کنی.">
        <form onSubmit={saveNew} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <ProductImageUploader value={addImageUrl} onChange={setAddImageUrl} compact />
          </div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-ink-muted">نام محصول</label><input name="title" required minLength={3} placeholder="مثلاً میز تلویزیون گردو" className={input} /></div>
          <div><label className="mb-1 block text-sm text-ink-muted">برند</label><input name="brand" placeholder="نام برند فروشگاه" className={input} /></div>
          <div><label className="mb-1 block text-sm text-ink-muted">موجودی</label><input name="quantity" inputMode="numeric" defaultValue="5" className={input} /></div>
          <div><label className="mb-1 block text-sm text-ink-muted">قیمت (تومان)</label><input name="price" inputMode="numeric" required placeholder="مثلاً 12500000" className={input} /></div>
          <div className="sm:col-span-2"><label className="mb-1 block text-sm text-ink-muted">توضیحات</label><textarea name="description" rows={2} className={`${input} resize-none`} /></div>
          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={saving}>{saving ? <><Spinner /> در حال ثبت…</> : <><PackagePlus size={15} /> ثبت محصول</>}</Button>
            <Button type="button" variant="ghost" onClick={() => setShowAdd(false)}>انصراف</Button>
          </div>
        </form>
      </Modal>

      {/* edit product — real PATCH */}
      <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={`ویرایش ${editing?.title ?? ""}`} description="تغییرات مستقیم روی سرور هومینو ذخیره می‌شود.">
        {editing && (
          <form onSubmit={saveEdit} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <ProductImageUploader value={editImageUrl ?? editing.image} onChange={setEditImageUrl} compact />
            </div>
            <div className="sm:col-span-2"><label className="mb-1 block text-sm text-ink-muted">نام محصول</label><input name="title" defaultValue={editing.title} className={input} /></div>
            <div><label className="mb-1 block text-sm text-ink-muted">قیمت (تومان)</label><input name="price" inputMode="numeric" defaultValue={editing.price} className={input} /></div>
            <div><label className="mb-1 block text-sm text-ink-muted">موجودی</label><input name="quantity" inputMode="numeric" defaultValue={editing.quantity ?? 0} className={input} /></div>
            <div>
              <label className="mb-1 block text-sm text-ink-muted">وضعیت</label>
              <select name="status" defaultValue={editing.status} className={input}>
                {Object.entries(PRODUCT_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex items-end"><Badge tone={PRODUCT_STATUS_TONE[editing.status] ?? "neutral"}>{PRODUCT_STATUS_LABEL[editing.status] ?? editing.status}</Badge></div>
            <div className="flex gap-2 sm:col-span-2">
              <Button type="submit" disabled={saving}><Save size={15} /> ذخیره</Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>انصراف</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}

/* ============================================================
   DEMO PRODUCTS — fallback صادقانه (۵۰۳ DEMO_MODE / قطعی شبکه).
   رفتار قبلی با vendorSession دست‌نخورده حفظ شده است.
   ============================================================ */

function DemoProductsPage() {
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
                  <td className="p-3"><div className="flex items-center gap-2"><img width="40" height="40" src={p.images[0]} alt="" className="h-10 w-10 rounded-lg object-cover" /><span className="line-clamp-1 font-medium text-ink">{p.name}<span dir="ltr" className="mr-2 text-2xs text-ink-muted">{p.sku}</span></span></div></td>
                  <td className="p-3 whitespace-nowrap text-ink">{toFa(formatPrice(p.price))} ت</td>
                  <td className="p-3 whitespace-nowrap">
                    <span className="ml-1 text-ink">{toFa(p.stockCount)}</span>
                    <button onClick={() => changeStock(p.id, -1)} className="rounded border border-clay/60 px-1.5 text-xs text-ink-muted hover:border-danger hover:text-danger" aria-label="کاهش موجودی">−</button>
                    <button onClick={() => changeStock(p.id, 1)} className="mr-1 rounded border border-clay/60 px-1.5 text-xs text-ink-muted hover:border-sage hover:text-success" aria-label="افزایش موجودی">+</button>
                  </td>
                  <td className="p-3 text-2xs text-ink-muted">دمو</td>
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
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="افزودن محصول جدید" description="حالت دمو: محصول در پنل فروشندهٔ محلی ذخیره می‌شود، در صفحهٔ عمومی فروشگاه هم نمایش داده می‌شود و با رفرش هم نمی‌پرد.">
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

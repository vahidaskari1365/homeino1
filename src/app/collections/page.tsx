"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { FolderHeart, Plus, Trash2, X } from "lucide-react";
import { Container, PageHeader } from "@/components/shared";
import { FilterableProductGrid } from "@/components/products/FilterableProductGrid";
import { Button, ButtonLink, ConfirmDialog, EmptyState, Modal } from "@/components/ui/primitives";
import { SmartImage } from "@/components/ui/SmartImage";
import { products as allProducts, getProductById } from "@/data/products";
import { useCollections, useWishlist } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { toFa } from "@/lib/utils";

export default function CollectionsPage() {
  const { collections, createCollection, removeCollection, addProduct, removeProduct } = useCollections();
  const wishlistIds = useWishlist((state) => state.products);
  const toast = useUi((state) => state.toast);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  const active = collections.find((collection) => collection.id === activeId) ?? collections[0];
  const activeProducts = useMemo(() => active?.productIds.map(getProductById).filter(Boolean) ?? [], [active]);
  const candidates = allProducts.filter((product) => !active?.productIds.includes(product.id));
  const wishlistCandidates = candidates.filter((product) => wishlistIds.includes(product.id));
  const addCandidates = wishlistCandidates.length ? wishlistCandidates : candidates.slice(0, 8);

  const create = () => {
    if (!title.trim()) return;
    const id = createCollection(title, description);
    setActiveId(id);
    setTitle("");
    setDescription("");
    setCreateOpen(false);
    toast("کالکشن جدید ساخته شد");
  };

  return (
    <Container className="py-10">
      <PageHeader
        eyebrow="فضای شخصی من"
        title="کالکشن‌های من"
        desc="محصولات را برای هر اتاق، پروژه یا بودجه در مجموعه‌های جدا ذخیره و کنار هم بررسی کن."
        action={<Button onClick={() => setCreateOpen(true)}><Plus size={17} /> ساخت کالکشن</Button>}
      />

      {collections.length === 0 ? (
        <EmptyState
          icon={<FolderHeart size={30} />}
          title="اولین کالکشنت را بساز"
          desc="مثلاً «پذیرایی جدید» یا «اتاق کار»؛ بعد محصولات دلخواهت را به آن اضافه کن."
          action={<Button onClick={() => setCreateOpen(true)}><Plus size={17} /> ساخت اولین کالکشن</Button>}
        />
      ) : (
        <div className="grid gap-7 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="space-y-2 lg:sticky lg:top-24 lg:h-fit">
            {collections.map((collection) => {
              const covers = collection.productIds.map(getProductById).filter(Boolean).slice(0, 3);
              const selected = collection.id === active?.id;
              return (
                <button key={collection.id} onClick={() => setActiveId(collection.id)} className={`flex min-h-20 w-full items-center gap-3 rounded-2xl border p-2.5 text-right transition ${selected ? "border-ink bg-ink text-cream shadow-[var(--shadow-card)]" : "border-clay/40 bg-cream hover:border-terracotta/45"}`}>
                  <span className={`grid h-14 w-14 shrink-0 grid-cols-2 overflow-hidden rounded-xl ${selected ? "bg-white/10" : "bg-ivory-2"}`}>
                    {covers.length ? covers.map((product) => product && <SmartImage key={product.id} src={product.images[0]} alt="" className="h-full min-h-0 w-full" />) : <FolderHeart size={21} className="col-span-2 m-auto opacity-55" />}
                  </span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-black">{collection.title}</span><span className={`text-[11px] ${selected ? "text-cream/60" : "text-ink-muted"}`}>{toFa(collection.productIds.length)} محصول</span></span>
                </button>
              );
            })}
          </aside>

          {active && (
            <section className="min-w-0">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-clay/35 bg-cream p-4 sm:p-5">
                <div><h2 className="text-xl font-black text-ink">{active.title}</h2>{active.description && <p className="mt-1 text-sm text-ink-muted">{active.description}</p>}<p className="mt-1 text-xs text-ink-muted">{toFa(active.productIds.length)} انتخاب در این کالکشن</p></div>
                <Button variant="danger" size="sm" onClick={() => setPendingDelete(active.id)}><Trash2 size={15} /> حذف کالکشن</Button>
              </div>

              {activeProducts.length ? (
                <>
                  <div className="relative">
                    <FilterableProductGrid
                      products={activeProducts as typeof allProducts}
                      cols={3}
                      layout="compact"
                      emptyDescription="فیلتر سبک یا سایر فیلترهای این کالکشن را تغییر بده."
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      {activeProducts.map((product) => product && <button key={product.id} onClick={() => removeProduct(active.id, product.id)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-clay/45 bg-cream px-3 text-xs text-ink-muted hover:border-danger/35 hover:text-danger"><X size={13} /> حذف {product.name}</button>)}
                    </div>
                  </div>
                </>
              ) : <EmptyState icon={<FolderHeart size={28} />} title="این کالکشن هنوز خالی است" desc="از پیشنهادهای پایین شروع کن یا محصولات را از همین صفحه به کالکشن اضافه کن." />}

              {addCandidates.length > 0 && (
                <div className="mt-10 border-t border-clay/35 pt-7">
                  <div className="mb-4 flex items-end justify-between gap-3"><div><h3 className="text-lg font-black text-ink">افزودن محصول</h3><p className="text-xs text-ink-muted">{wishlistCandidates.length ? "از علاقه‌مندی‌های تو" : "پیشنهادهای محبوب Homeino"}</p></div><ButtonLink href="/products" variant="ghost" size="sm">کاوش بیشتر</ButtonLink></div>
                  <div className="hide-scrollbar flex gap-3 overflow-x-auto pb-2">
                    {addCandidates.slice(0, 8).map((product) => <article key={product.id} className="w-36 shrink-0 rounded-xl border border-clay/40 bg-cream p-2"><Link href={`/products/${product.slug}`}><SmartImage src={product.images[0]} alt={product.name} className="aspect-square w-full rounded-lg" /></Link><p className="mt-2 line-clamp-2 min-h-9 text-[11px] font-bold leading-5 text-ink">{product.name}</p><button onClick={() => { addProduct(active.id, product.id); toast("به کالکشن اضافه شد"); }} className="btn-primary mt-2 flex min-h-9 w-full items-center justify-center gap-1 rounded-lg px-2 text-[10px] font-bold"><Plus size={12} /> افزودن</button></article>)}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="کالکشن جدید" description="یک نام روشن انتخاب کن تا بعداً سریع پیدایش کنی." footer={<><Button variant="ghost" onClick={() => setCreateOpen(false)}>انصراف</Button><Button onClick={create} disabled={!title.trim()}>ساخت کالکشن</Button></>}>
        <div className="space-y-4"><div><label htmlFor="collection-title" className="field-label">نام کالکشن</label><input id="collection-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="مثلاً اتاق نشیمن مینیمال" className="field-control" autoFocus /></div><div><label htmlFor="collection-description" className="field-label">توضیح کوتاه <span className="font-normal text-ink-muted">(اختیاری)</span></label><textarea id="collection-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="بودجه، سبک یا هر چیزی که برای این پروژه مهم است…" className="field-control resize-none" /></div></div>
      </Modal>

      <ConfirmDialog open={pendingDelete != null} onClose={() => setPendingDelete(null)} onConfirm={() => { if (pendingDelete) { removeCollection(pendingDelete); setActiveId(null); toast("کالکشن حذف شد", "info"); } }} title="حذف این کالکشن؟" description="خود محصولات حذف نمی‌شوند؛ فقط این مجموعه از فضای شخصی تو پاک می‌شود." confirmLabel="حذف کالکشن" destructive />
    </Container>
  );
}

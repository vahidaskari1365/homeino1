"use client";

import { useState } from "react";
import { BookmarkPlus, Check, FolderPlus, Plus } from "lucide-react";
import { Button, Modal } from "@/components/ui/primitives";
import { useCollections } from "@/stores/useShop";
import { useUi } from "@/stores/useApp";
import { cn, toFa } from "@/lib/utils";

export function CollectionPicker({ productId, compact = false }: { productId: string; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const { collections, createCollection, addProduct, removeProduct, hasProduct } = useCollections();
  const toast = useUi((state) => state.toast);

  const create = () => {
    if (!title.trim()) return;
    const collectionId = createCollection(title);
    addProduct(collectionId, productId);
    setTitle("");
    toast("کالکشن ساخته شد و محصول به آن اضافه شد");
  };

  return (
    <>
      <Button type="button" variant="outline" size={compact ? "sm" : "md"} onClick={() => setOpen(true)} aria-label="ذخیره محصول در کالکشن">
        <BookmarkPlus size={17} /> {!compact && "ذخیره در کالکشن"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="ذخیره در کالکشن" description="محصول را به یکی از مجموعه‌های شخصی‌ات اضافه کن.">
        <div className="space-y-2">
          {collections.map((collection) => {
            const selected = hasProduct(collection.id, productId);
            return (
              <button
                key={collection.id}
                type="button"
                onClick={() => {
                  if (selected) removeProduct(collection.id, productId);
                  else addProduct(collection.id, productId);
                }}
                className={cn("flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 text-right transition", selected ? "border-success/40 bg-success/7" : "border-clay/45 bg-cream hover:border-terracotta/45")}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", selected ? "bg-success text-white" : "bg-ivory-2 text-ink-muted")}>
                  {selected ? <Check size={17} /> : <FolderPlus size={17} />}
                </span>
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-ink">{collection.title}</span><span className="text-2xs text-ink-muted">{toFa(collection.productIds.length)} محصول</span></span>
              </button>
            );
          })}
          {collections.length === 0 && <p className="rounded-xl bg-ivory-2/70 p-3 text-xs leading-6 text-ink-muted">هنوز کالکشنی نداری. همین‌جا اولین مجموعه‌ات را بساز.</p>}
        </div>
        <div className="mt-5 border-t border-clay/35 pt-4">
          <label htmlFor="new-collection" className="field-label">کالکشن جدید</label>
          <div className="flex gap-2">
            <input id="new-collection" value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => event.key === "Enter" && create()} placeholder="مثلاً پذیرایی جدید" className="field-control min-w-0 flex-1" />
            <Button type="button" onClick={create} disabled={!title.trim()}><Plus size={16} /> ساخت</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

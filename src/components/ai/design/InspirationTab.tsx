"use client";
// تب «اسکن بصری» — پیدا کردن مشابه از روی عکس (verbatim JSX از /ai/design).
import { useRef } from "react";
import { Upload, Wand2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { products } from "@/data/products";
import type { DesignStudio } from "./useDesignStudio";

export function InspirationTab({ studio }: { studio: DesignStudio }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    presetProduct, imageBase64, handleFile, placePresetInRoom, loading,
    setPresetProduct, inspirationMatches, setInspirationMatches, selected, toggleProduct, setTab,
  } = studio;
  const { toast } = useUi();
  return (
    <div className="rounded-2xl border border-clay/50 bg-cream p-5">
      <h3 className="mb-3 text-sm font-bold text-ink">اسکن بصری</h3>
      <p className="mb-4 text-xs leading-6 text-ink-muted">{presetProduct ? "محصول انتخاب‌شده را در عکس خانه‌ات قرار بده." : "عکس مدلی که دوست داری را آپلود کن تا محصولات مشابه پیدا کنیم."}</p>
      {presetProduct ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-clay/40 bg-ivory-2 p-3">
            <div className="mb-1.5 text-[10px] font-bold text-terracotta-deep">محصول انتخاب‌شده</div>
            <div className="flex items-center gap-2.5"><img src={presetProduct.images[0]} alt="" className="h-16 w-16 rounded-lg object-cover" /><div><p className="text-xs font-bold text-ink">{presetProduct.name}</p><p className="text-[10px] text-ink-muted">{presetProduct.brand}</p></div></div>
            <button onClick={() => setPresetProduct(null)} className="mt-2 text-[10px] text-ink-muted hover:text-danger">حذف</button>
          </div>
          <div>
            {!imageBase64 ? (
              <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 text-center transition hover:border-terracotta">
                <Upload size={24} className="mb-1.5 text-ink-muted" /><p className="text-xs font-medium text-ink">آپلود عکس خانه</p>
              </div>
            ) : (<><div className="overflow-hidden rounded-xl border border-clay/40"><img src={imageBase64} alt="" className="aspect-video w-full object-cover" /></div><button onClick={placePresetInRoom} disabled={loading} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2.5 text-xs font-bold text-cream transition hover:bg-terracotta-deep disabled:opacity-40"><Wand2 size={14} /> جای‌گذاری در خانه</button></>)}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
        </div>
      ) : !imageBase64 ? (
        <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className="mx-auto flex max-w-md cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 p-8 text-center transition hover:border-terracotta">
          <Upload size={26} className="mb-2 text-ink-muted" /><p className="text-xs font-medium text-ink">عکس مدل را آپلود کن</p><p className="mt-0.5 text-[10px] text-ink-muted">JPG, PNG</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="overflow-hidden rounded-xl border border-clay/40"><img src={imageBase64} alt="" className="aspect-video w-full object-cover" /></div>
          <div>
            <button onClick={() => { setInspirationMatches([...products].sort(() => Math.random() - 0.5).slice(0, 6)); toast("محصولات مشابه پیدا شد"); }} className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2.5 text-xs font-bold text-cream"><Sparkles size={14} /> پیدا کردن مشابه</button>
            {inspirationMatches.length > 0 && (<><div className="grid grid-cols-3 gap-2">{inspirationMatches.map((p) => { const isSel = !!selected[p.id]; return (
              <button key={p.id} onClick={() => toggleProduct(p)} className={cn("overflow-hidden rounded-lg border text-right transition", isSel ? "border-terracotta ring-1 ring-terracotta/40" : "border-clay/50 hover:border-terracotta/50")}>
                <div className="relative aspect-square"><img src={p.images[0]} alt="" className="h-full w-full object-cover" />{isSel && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-terracotta text-[8px] text-white">✓</span>}</div>
                <p className="line-clamp-1 p-1 text-[9px] font-bold text-ink">{p.name}</p>
              </button>
            ); })}</div><button onClick={() => { setTab("design"); toast("محصولات اضافه شدند"); }} className="btn-accent mt-3 w-full py-2 text-xs font-bold">طراحی با این محصولات</button></>)}
          </div>
        </div>
      )}
    </div>
  );
}

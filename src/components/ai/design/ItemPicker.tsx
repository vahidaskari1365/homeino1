"use client";
// Step ۳ — «انتخاب وسایل» category/sub-type picker card (verbatim JSX).
import { Lightbulb } from "lucide-react";
import { toFa, cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { CATEGORIES, panelCls, stepBadge } from "./constants";

export function ItemPicker({ studio }: { studio: DesignStudio }) {
  const { openCats, toggleCat, selectedSubTypes, setSelectedSubTypes, toggleSubType } = studio;
  return (
    <div className={panelCls}>
      <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><span className={stepBadge}>۳</span> انتخاب وسایل</h2>
      <div className="grid grid-cols-3 gap-1.5">
        {CATEGORIES.map((c) => { const open = openCats.has(c.slug); const selCount = (selectedSubTypes[c.slug] || []).length; return (
          <button key={c.slug} onClick={() => toggleCat(c.slug)} className={cn("flex items-center gap-1 rounded-lg border p-1.5 text-[10px] font-bold transition", open ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/40 bg-ivory-2 text-ink-muted hover:border-terracotta/50")}>
            <c.Icon size={12} /> <span className="line-clamp-1">{c.label}</span>{selCount > 0 && <span className="rounded-full bg-terracotta px-1 text-[8px] text-white">{toFa(selCount)}</span>}
          </button>
        ); })}
      </div>
      {[...openCats].map((slug) => { const cat = CATEGORIES.find((c) => c.slug === slug); if (!cat) return null; const sel = selectedSubTypes[slug] || []; return (
        <div key={slug} className="mt-2.5 rounded-xl border border-clay/40 bg-ivory-2 p-2.5">
          <div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="flex items-center gap-1 font-bold text-terracotta-deep"><cat.Icon size={11} /> {cat.label}</span>{sel.length > 0 && <button onClick={() => setSelectedSubTypes((s) => ({ ...s, [slug]: [] }))} className="text-ink-muted hover:text-danger">پاک</button>}</div>
          <div className="flex flex-wrap gap-1">{cat.subTypes.map((st) => { const on = sel.includes(st.label); return (<button key={st.label} onClick={() => toggleSubType(slug, st.label)} className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-bold transition", on ? "border-terracotta bg-terracotta text-white" : "border-clay/50 bg-cream text-ink-muted hover:border-terracotta/50")}>{st.label}</button>); })}</div>
          {sel.length > 0 && <div className="mt-1.5 space-y-0.5 rounded-lg bg-cream p-2">{sel.map((label) => { const st = cat.subTypes.find((x) => x.label === label); return <div key={label} className="flex gap-1 text-[9px] leading-4 text-ink-muted"><Lightbulb size={9} className="mt-0.5 shrink-0 text-gold" /> <b className="text-ink">{label}:</b> {st?.desc}</div>; })}</div>}
        </div>
      ); })}
    </div>
  );
}

"use client";
// تب «پیشنهاد دکور» — راهنمای مرحله‌ای سبک/بودجه/رنگ (readable sizes).
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { IMG } from "@/data/media";

const STYLES = [
  { id: "modern", label: "مدرن", image: IMG.living2 }, { id: "classic", label: "کلاسیک", image: IMG.living9 },
  { id: "minimalist", label: "مینیمال", image: IMG.living7 }, { id: "luxury", label: "لوکس", image: IMG.living5 },
  { id: "scandinavian", label: "اسکاندیناوی", image: IMG.bed9 }, { id: "industrial", label: "صنعتی", image: IMG.decor8 },
  { id: "bohemian", label: "بوهمی", image: IMG.living3 }, { id: "japanese", label: "ژاپنی", image: IMG.decor6 },
  { id: "office", label: "اداری", image: IMG.decor7 },
];

const ROOM_TYPES = [["living", "نشیمن"], ["bedroom", "خواب"], ["kitchen", "آشپزخانه"], ["bathroom", "حمام"], ["office", "کار"], ["dining", "ناهارخوری"], ["outdoor", "باز"]] as const;
const BUDGETS = [["low", "اقتصادی (تا ۱۰م)"], ["mid", "متوسط (۱۰-۵۰م)"], ["high", "بالا (۵۰-۱۰۰م)"], ["premium", "لوکس (۱۰۰م+)"]] as const;

export function SuggestAssistant({ onApply, onBack }: { onApply: (p: { style: string; budget: string; roomType: string; colors: string[] }) => void; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [roomType, setRoomType] = useState(""); const [style, setStyle] = useState(""); const [budget, setBudget] = useState("");
  const [colorInput, setColorInput] = useState(""); const [colors, setColors] = useState<string[]>([]);
  const addColor = () => { const c = colorInput.trim(); if (c && !colors.includes(c)) { setColors([...colors, c]); setColorInput(""); } };
  const panelCls = "rounded-2xl border border-clay/50 bg-cream p-6 shadow-[var(--shadow-soft)]";
  return (
    <div className={cn("mx-auto max-w-md space-y-4 text-sm", panelCls)}>
      <div className="flex items-center justify-center gap-2">{[0, 1, 2].map((s) => <div key={s} className={cn("h-2.5 w-2.5 rounded-full transition-all", s === step ? "scale-125 bg-terracotta" : s < step ? "bg-terracotta" : "bg-clay")} />)}</div>
      {step === 0 && (<div className="space-y-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-terracotta/10"><Sparkles size={18} className="text-terracotta-deep" /></span><div><h3 className="text-base font-bold text-ink">نوع فضا</h3></div></div><div className="grid grid-cols-3 gap-2">{ROOM_TYPES.map(([v, l]) => <button key={v} onClick={() => setRoomType(v)} className={cn("rounded-lg border p-3 text-sm font-medium transition", roomType === v ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/50 text-ink-muted hover:border-terracotta/40")}>{l}</button>)}</div><div className="flex gap-2 pt-1"><button onClick={onBack} className="px-3 py-2 text-sm text-ink-muted">بازگشت</button><button onClick={() => setStep(1)} disabled={!roomType} className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-bold text-cream disabled:opacity-40">بعدی</button></div></div>)}
      {step === 1 && (<div className="space-y-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-terracotta/10"><Sparkles size={18} className="text-terracotta-deep" /></span><h3 className="text-base font-bold text-ink">سبک و بودجه</h3></div><div><p className="mb-2 text-sm font-medium text-ink-muted">سبک</p><div className="flex flex-wrap gap-2">{STYLES.map((s) => <button key={s.id} onClick={() => setStyle(s.id)} className={cn("rounded-lg border px-3.5 py-2 text-sm font-medium transition", style === s.id ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/50 text-ink-muted hover:border-terracotta/40")}>{s.label}</button>)}</div></div><div><p className="mb-2 text-sm font-medium text-ink-muted">بودجه</p><div className="space-y-2">{BUDGETS.map(([v, l]) => <button key={v} onClick={() => setBudget(v)} className={cn("w-full rounded-lg border p-3 text-left text-sm transition", budget === v ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/50 text-ink-muted hover:border-terracotta/40")}>{l}</button>)}</div></div><div className="flex gap-2 pt-1"><button onClick={() => setStep(0)} className="px-3 py-2 text-sm text-ink-muted">قبلی</button><button onClick={() => setStep(2)} disabled={!style || !budget} className="flex-1 rounded-lg bg-ink py-2.5 text-sm font-bold text-cream disabled:opacity-40">بعدی</button></div></div>)}
      {step === 2 && (<div className="space-y-4"><div className="flex items-center gap-2"><span className="grid h-9 w-9 place-items-center rounded-lg bg-terracotta/10"><Sparkles size={18} className="text-terracotta-deep" /></span><h3 className="text-base font-bold text-ink">رنگ‌ها (اختیاری)</h3></div><div className="flex gap-2"><input value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }} placeholder="مثلاً طلایی..." className="flex-1 rounded-lg border border-clay/50 bg-ivory-2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-terracotta" /><button onClick={addColor} className="rounded-lg bg-terracotta/10 px-4 py-2.5 text-sm font-bold text-terracotta-deep">+</button></div>{colors.length > 0 && <div className="flex flex-wrap gap-1.5">{colors.map((c) => <span key={c} className="flex items-center gap-1 rounded-full bg-ivory-2 px-2.5 py-1 text-xs text-ink">{c}<button onClick={() => setColors(colors.filter((x) => x !== c))} className="hover:text-danger" aria-label={`حذف ${c}`}><X size={12} /></button></span>)}</div>}<div className="rounded-lg bg-ivory-2 p-3.5"><p className="text-xs font-bold text-terracotta-deep">خلاصه</p><div className="mt-1 space-y-1 text-xs leading-5 text-ink-muted"><p>فضا: {ROOM_TYPES.find((r) => r[0] === roomType)?.[1]}</p><p>سبک: {STYLES.find((s) => s.id === style)?.label}</p><p>بودجه: {BUDGETS.find((b) => b[0] === budget)?.[1]}</p>{colors.length > 0 && <p>رنگ‌ها: {colors.join("، ")}</p>}</div></div><div className="flex gap-2 pt-1"><button onClick={() => setStep(1)} className="px-3 py-2 text-sm text-ink-muted">قبلی</button><button onClick={() => onApply({ style, budget, roomType, colors })} className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-sm font-bold text-cream transition hover:opacity-90"><Sparkles size={16} /> دریافت پیشنهاد</button></div></div>)}
    </div>
  );
}

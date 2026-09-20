"use client";
// ============================================================
// تب «پیشنهاد دکور» — بخش مستقل (مالک ۲۰۲۶-۰۹-۲۰):
//   ① عکس فضا را آپلود کن → تحلیل واقعی + پیشنهادهای اجرایی با
//      محصولات واقعی هومینو
//   ② پیشنهادها را انتخاب کن → «روی عکس من اعمال کن» → نتیجه در
//      همین بخش دیده می‌شود.
// ============================================================
import Link from "next/link";
import { useRef } from "react";
import {
  Sparkles, Upload, Wand2, ShoppingCart, RotateCcw, TriangleAlert, CheckCircle2, Leaf,
} from "lucide-react";
import { cn, toFa } from "@/lib/utils";
import { useUi } from "@/stores/useApp";
import { useCart } from "@/stores/useShop";
import type { DesignStudio } from "./useDesignStudio";
import type { DecorPlan } from "./useDecorPlan";

const IMPACT_LABEL: Record<string, string> = { low: "اثر ملایم", medium: "اثر متوسط", high: "اثر چشمگیر" };

export function DecorSuggestTab({ studio, decor }: { studio: DesignStudio; decor: DecorPlan }) {
  void studio; // style only — hook reads it live
  const { toast } = useUi();
  const addToCart = useCart((s) => s.add);
  const inputRef = useRef<HTMLInputElement>(null);
  const { plan, phase, selected, result, error } = decor;
  const busy = phase !== "idle";

  return (
    <div className="rounded-2xl border border-clay/50 bg-cream p-6">
      <h3 className="mb-1 flex items-center gap-2 text-base font-bold text-ink"><Sparkles size={18} className="text-terracotta-deep" /> پیشنهاد دکور</h3>
      <p className="mb-5 text-sm leading-7 text-ink-muted">
        عکس فضایت را آپلود کن — هوش مصنوعی هومینو فضا را تحلیل می‌کند، پیشنهادهای اجرایی می‌دهد و همان‌جا روی عکس تو اعمال‌شان می‌کند.
      </p>

      {!decor.decorImage ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="آپلود عکس فضا"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && !busy) inputRef.current?.click(); }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) decor.handleDecorFile(f); }}
          className={cn(
            "mx-auto flex max-w-md cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 p-9 text-center transition hover:border-terracotta",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <Upload size={30} className="mb-2 text-ink-muted" />
          <p className="text-sm font-medium text-ink">عکس فضا را آپلود کن</p>
          <p className="mt-1 text-xs text-ink-muted">نشیمن، خواب، آشپزخانه یا هر فضایی — JPG، PNG</p>
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && decor.handleDecorFile(e.target.files[0])} />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* ستون راست: عکس و نتیجه */}
          <div>
            <div className={cn("overflow-hidden rounded-xl border border-clay/40", phase === "planning" && "animate-pulse border-terracotta/60")}>
              <img width={1280} height={720} src={result?.image ?? decor.decorImage} alt={result ? "نتیجهٔ پیشنهاد دکور" : "عکس فضا"} className="aspect-video w-full object-cover" />
            </div>
            {result && (
              <>
                {!result.real && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-2xs font-bold text-ink">
                    پیش‌نمایش ترکیب — رندر واقعی پس از وصل‌شدن موتور ویرایش
                  </p>
                )}
                <button onClick={decor.clearResult} className="mt-2 w-full rounded-lg border border-clay/50 py-2 text-xs font-bold text-ink transition hover:border-terracotta">
                  بازگشت به عکس اصلی و ترکیب دوباره
                </button>
              </>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={decor.runPlan}
                disabled={busy}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-ink py-2.5 text-sm font-bold text-cream transition hover:bg-terracotta-deep disabled:opacity-40"
              >
                <Sparkles size={15} /> {phase === "planning" ? "در حال تحلیل فضا…" : (plan ? "پیشنهاد تازه" : "تحلیل و پیشنهاد دکور")}
              </button>
              <button onClick={decor.resetDecor} aria-label="شروع دوباره" className="grid w-11 place-items-center rounded-lg border border-clay/50 text-ink-muted transition hover:border-terracotta hover:text-terracotta">
                <RotateCcw size={15} />
              </button>
            </div>
            <button onClick={() => decor.setDecorImage(null)} className="mt-2 w-full py-1.5 text-xs font-bold text-ink-muted transition hover:text-terracotta">
              تغییر عکس فضا
            </button>
          </div>

          {/* ستون چپ: پیشنهادها و محصولات */}
          <div>
            {plan && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 rounded-lg border border-clay/40 bg-ivory-2 px-3 py-2 text-xs text-ink">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span><b>{plan.roomType}</b> · سبک {plan.style}</span>
                {plan.palette.slice(0, 4).map((c) => (
                  <span key={c} className="inline-flex items-center gap-1 rounded-full bg-cream px-2 py-0.5 text-2xs text-ink-muted">
                    <span className="h-2.5 w-2.5 rounded-full border border-clay" style={{ background: /^#/.test(c) ? c : "#cdbfa6" }} /> {c}
                  </span>
                ))}
              </div>
            )}

            {!plan && !error && (
              <div className="grid h-full place-items-center rounded-xl border border-dashed border-clay/50 bg-ivory-2 p-6 text-center">
                <div>
                  <Leaf size={22} className="mx-auto mb-2 text-terracotta" />
                  <p className="text-sm font-medium text-ink">{phase === "planning" ? "هوش مصنوعی فضای تو را می‌بیند…" : "آمادهٔ تحلیلم — دکمهٔ «تحلیل و پیشنهاد دکور» را بزن"}</p>
                </div>
              </div>
            )}

            {plan?.suggestions.map((sg) => {
              const isSel = selected.has(sg.id);
              return (
                <div key={sg.id} className={cn("mb-3 rounded-xl border p-3.5 transition", isSel ? "border-terracotta/60 bg-ivory-2" : "border-clay/40 bg-ivory-2 opacity-70")}>
                  <label className="flex cursor-pointer items-start gap-2">
                    <input type="checkbox" checked={isSel} onChange={() => decor.toggleSuggestion(sg.id)} className="mt-1 accent-[var(--terracotta, #c2703f)]" />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <b className="text-sm text-ink">{sg.title}</b>
                        <span className={cn("rounded-full px-2 py-0.5 text-2xs font-bold", sg.impact === "high" ? "bg-terracotta/15 text-terracotta-deep" : "bg-clay/40 text-ink-muted")}>
                          {IMPACT_LABEL[sg.impact] ?? sg.impact}
                        </span>
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-ink-muted">{sg.desc}</span>
                    </span>
                  </label>
                  {sg.products.length > 0 && (
                    <div className="mt-2.5 grid grid-cols-3 gap-2">
                      {sg.products.map((p) => (
                        <div key={p.id} className="overflow-hidden rounded-lg border border-clay/40 bg-cream">
                          <div className="relative aspect-square">
                            <img src={p.image} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                          </div>
                          <div className="p-1.5">
                            <p className="line-clamp-1 text-2xs font-bold text-ink">{p.name}</p>
                            <p className="text-2xs text-ink-muted">{toFa(p.price)} {p.currency}</p>
                            <div className="mt-1 flex gap-1">
                              <button onClick={() => { addToCart(p.id); toast("به سبد اضافه شد"); }} aria-label={`افزودن ${p.name} به سبد`} className="grid flex-1 place-items-center rounded bg-ink py-1.5 text-cream transition hover:bg-terracotta-deep">
                                <ShoppingCart size={11} />
                              </button>
                              <Link href={`/products/${p.slug}`} aria-label={`مشاهدهٔ ${p.name}`} className="grid flex-1 place-items-center rounded border border-clay/60 py-1.5 text-ink transition hover:border-terracotta">
                                <Wand2 size={11} />
                              </Link>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {plan && plan.topProducts.length > 0 && (
              <div className="rounded-xl border border-clay/40 bg-ivory-2 p-3.5">
                <p className="mb-2 text-xs font-bold text-terracotta-deep">انتخاب هومینو برای این فضا</p>
                <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                  {plan.topProducts.map((p) => (
                    <Link key={p.id} href={`/products/${p.slug}`} className="w-20 shrink-0 overflow-hidden rounded-lg border border-clay/40 bg-cream transition hover:border-terracotta/60">
                      <img src={p.image} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" />
                      <p className="line-clamp-1 p-1 text-2xs font-bold text-ink">{p.name}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {plan && plan.suggestions.length > 0 && !result && (
              <button
                onClick={decor.applyPlan}
                disabled={busy || selected.size === 0}
                className="btn-accent mt-3 flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold disabled:opacity-40"
              >
                <Wand2 size={16} /> {phase === "applying" ? "در حال اعمال روی عکس تو…" : `اعمال ${toFa(selected.size)} پیشنهاد روی عکس من`}
              </button>
            )}

            {error && (
              <p role="alert" className="mt-3 flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-xs font-bold leading-5 text-ink">
                <TriangleAlert size={14} className="mt-0.5 shrink-0 text-amber-600" /> {error}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

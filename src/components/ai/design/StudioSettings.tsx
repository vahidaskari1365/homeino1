"use client";
// ============================================================
// ستون «تنظیمات» — جایگزین ویزارد (نتیجهٔ تحقیق رقبا):
// RoomGPT، InteriorAI و REimagineHome هیچ‌کدام مرحلهٔ مخفی ندارند؛
// همهٔ تنظیمات همیشه باز است و کاربر هیچ‌وقت چیزی را «گم» نمی‌کند.
// • ردیف چیپ‌های وضعیت (الگوی Decision Canvas) — خلاصهٔ انتخاب‌ها
// • ۳ بخش همیشه‌باز با شمارهٔ ملایم: سبک / وسایل / بودجه و دستور
// • دکمهٔ «طراحی کن» چسبان پایین کارت — همیشه در دسترس
// تحلیل عکس و نتیجه در ستون «کانواس» است (ResultCanvas).
// ============================================================
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, ImagePlus, Palette, Sofa, Wallet, Tag, MessageSquareText, Check, Minus } from "lucide-react";
import { toFa, cn } from "@/lib/utils";
import type { DesignStudio } from "./useDesignStudio";
import { StylePicker } from "./StylePicker";
import { ItemPicker } from "./ItemPicker";
import { BudgetStep } from "./BudgetStep";

function StatusChip({ ok, icon: Icon, label }: { ok: boolean; icon: typeof Sofa; label: string }) {
  return (
    <span className={cn(
      "inline-flex max-w-full items-center gap-1 rounded-full border px-2.5 py-1 text-2xs font-bold transition",
      ok ? "border-success/30 bg-success/8 text-success" : "border-clay/40 bg-ivory-2 text-ink-muted",
    )}>
      <Icon size={12} className="shrink-0" />
      <span className="truncate">{label}</span>
      {ok ? <Check size={11} className="shrink-0" /> : <Minus size={11} className="shrink-0 opacity-60" />}
    </span>
  );
}

function Section({ n, title, hint, children }: { n: string; title: string; hint: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-clay/25 pt-3.5 first:border-t-0 first:pt-0">
      <div className="mb-2.5 flex items-baseline gap-2">
        <span className="grid h-5 w-5 shrink-0 translate-y-0.5 place-items-center rounded-md bg-ivory-2 text-2xs font-black text-terracotta-deep ring-1 ring-clay/30">{n}</span>
        <h4 className="text-sm font-bold text-ink">{title}</h4>
        <span className="hidden truncate text-2xs text-ink-muted sm:block">{hint}</span>
      </div>
      {children}
    </section>
  );
}

export function StudioSettings({ studio }: { studio: DesignStudio }) {
  const { imageBase64, styleLabel, designElements, budget, prompt, skuInput, loading, generate, cost } = studio;

  return (
    <div className="flex flex-col rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)] sm:p-5">
      {/* چیپ‌های وضعیت — خلاصهٔ زندهٔ انتخاب‌ها (الگوی رقیب) */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        <StatusChip ok={Boolean(imageBase64)} icon={ImagePlus} label={imageBase64 ? "عکس آماده" : "عکس آپلود نشده"} />
        <StatusChip ok icon={Palette} label={`سبک: ${styleLabel}`} />
        <StatusChip ok={designElements.length > 0} icon={Sofa} label={designElements.length > 0 ? `${toFa(designElements.length)} گروه وسایل` : "چیدمان پیش‌فرض"} />
        {budget ? <StatusChip ok icon={Wallet} label={`بودجه ${toFa(budget)} ت`} /> : null}
        {prompt ? <StatusChip ok icon={MessageSquareText} label={`دستور: ${prompt}`} /> : null}
        {skuInput ? <StatusChip ok icon={Tag} label={`کد ${skuInput}`} /> : null}
      </div>

      <div className="space-y-4">
        <Section n="۱" title="سبک دکوراسیون" hint="حال‌وهوای طراحی">
          <StylePicker studio={studio} />
        </Section>
        <Section n="۲" title="وسایل" hint="اختیاری — پیش‌فرض هومینو کامل است">
          <ItemPicker studio={studio} />
        </Section>
        <Section n="۳" title="بودجه، دستور و کد کالا" hint="همه اختیاری — برای دقت بیشتر">
          <BudgetStep studio={studio} />
        </Section>
      </div>

      {/* CTA چسبان — همیشه در دسترس، حتی وسط فرم طولانی */}
      <div className="sticky bottom-3 z-10 mt-4">
        <AnimatePresence initial={false}>
          <motion.div
            key="cta"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-2xl border border-clay/50 bg-cream/92 p-2.5 shadow-[0_10px_36px_-12px_rgba(62,38,20,0.4)] backdrop-blur"
          >
            <button onClick={generate} disabled={loading || !imageBase64} className="btn-accent flex w-full items-center justify-center gap-2 py-3.5 text-sm font-bold disabled:opacity-40">
              <Wand2 size={17} /> {designElements.length > 0 ? "ببین چطور تو خونه‌ات می‌شه" : "طراحی اتاق من"}
            </button>
            <p className="mt-1.5 flex items-center justify-center gap-1.5 text-2xs text-ink-muted">
              <span>هزینه: <b className="text-gold">{toFa(cost)} اعتبار</b></span>
              <span aria-hidden>·</span>
              <span>حدود ۳۰ ثانیه</span>
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

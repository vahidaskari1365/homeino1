"use client";
// ============================================================
// هومینو استودیو — composition layer (طرح نهایی کانواس‌محور،
// حاصل تحقیق زنده در RoomGPT / InteriorAI / REimagineHome /
// Spacely / Decoratly):
// • تب‌های بالای ۳گانه (چیدمان با عکس / اسکن بصری / پیشنهاد دکور)
// • تب «چیدمان با عکس» دو ستون دارد:
//   راست (اول در RTL، پهن‌تر): «کانواس» — عکس + تحلیل زنده + نتیجه
//   چپ: «تنظیمات» — سبک، وسایل، بودجه/دستور/SKU + CTA چسبان
//   هیچ مرحلهٔ مخفی یا جمع‌شونده‌ای وجود ندارد؛ تحلیل عکس همیشه
//   زیر خود عکس و روی کانواس دیده می‌شود (اشکال نسخه‌های قبل).
// ============================================================
import { Wand2, Search, Sparkles, PlugZap } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { SuggestAssistant } from "@/components/ai/SuggestAssistant";
import { cn } from "@/lib/utils";
import type { DesignStudio as Studio } from "./useDesignStudio";
import { StudioSettings } from "./StudioSettings";
import { ResultCanvas } from "./ResultCanvas";
import { InspirationTab } from "./InspirationTab";
import { RealInspirationStrip } from "./RealInspirationStrip";

export function DesignStudio({ studio }: { studio: Studio }) {
  const { tab, setTab, selectStyle, setBudget, toast, styleLabel } = studio;
  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-6 sm:py-8">
        <div className="mb-4 [&_a]:text-ink-muted"><Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "هومینو استودیو" }]} /></div>

        {/* Header */}
        <header className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-cream"><Wand2 size={22} /></span>
          <div>
            <h1 className="font-display text-xl font-black leading-tight text-ink sm:text-2xl">هومینو استودیو</h1>
            <p className="text-sm text-ink-muted">عکس خانه‌ات را آپلود کن، وسایل انتخاب کن و نتیجه را ببین</p>
          </div>
        </header>

        {/* Tabs — جمع: نوار باریک با آیکون */}
        <div className="mb-5 flex gap-1 rounded-xl border border-clay/50 bg-cream p-1">
          {([["design", "چیدمان با عکس", Wand2], ["inspiration", "اسکن بصری", Search], ["suggest", "پیشنهاد دکور", Sparkles]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-bold transition sm:gap-2 sm:text-sm", tab === id ? "bg-ink text-cream" : "text-ink-muted hover:text-ink")}>
              <Icon size={15} className="shrink-0" /> <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {tab === "suggest" && <SuggestAssistant onApply={(p) => { selectStyle(p.style); setBudget(p.budget); setTab("design"); toast("پیشنهاد اعمال شد"); }} onBack={() => setTab("design")} />}

        {tab === "inspiration" && <InspirationTab studio={studio} />}

        {/* grid-cols-[minmax(0,1fr)] : در موبایل ستون‌ها زیر هم می‌آیند و بدون این،
            min-content عکس‌های ذاتی‌بلند (۱۲۰۰px) کل صفحه را overflow می‌دهد. */}
        {tab === "design" && (
          <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-12 lg:gap-5">
            {/* Task 40 — بنر صداقت موتور: وقتی موتور ویرایش واقعی وصل نیست،
                کاربر باید بداند نتیجه‌ها پیش‌نمایش دمو هستند و مسیر رفع چیست */}
            {studio.editCapable === false && (
              <div className="lg:col-span-12 flex items-start gap-3 rounded-xl border border-amber-300/70 bg-amber-50 px-4 py-3 text-sm text-ink">
                <PlugZap size={18} className="mt-0.5 shrink-0 text-amber-600" />
                <p className="leading-6">
                  <b>موتور ویرایش عکس هنوز وصل نیست.</b> تا وقتی کلید رایگان Gemini در تنظیمات سرور
                  (Vercel → Settings → Environment Variables → <code dir="ltr" className="rounded bg-amber-100 px-1">GEMINI_API_KEY</code>)
                  اضافه و دوباره Deploy شود، نتیجه‌های ویرایش فقط پیش‌نمایش دمو هستند — نه رندر واقعی.
                </p>
              </div>
            )}

            {/* DOM: کانواس اول — در موبایل آپلود/عکس اول دیده می‌شود.
                دسکتاپ: با order تنظیمات می‌رود راست (order-1 در RTL اول است)
                و کانواس می‌رود چپ (خواستهٔ مالک ۲۰۲۶-۰۹-۱۶). */}
            <ResultCanvas studio={studio} />

            <div className="lg:order-1 lg:col-span-5">
              <StudioSettings studio={studio} />
            </div>

            {/* Task 42 — نوار الهام واقعی از وب (serper): فقط با کلیک کاربر
                fetch می‌شود؛ تزئینی است و هیچ‌وقت جلوی طراحی را نمی‌گیرد. */}
            <div className="lg:col-span-12">
              <RealInspirationStrip styleLabel={styleLabel} />
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}

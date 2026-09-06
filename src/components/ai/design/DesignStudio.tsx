"use client";
// ============================================================
// هومینو استودیو — composition layer (طرح D ترکیبی).
// سربرگ + تب‌های بالای جمع‌تر + بدنه هر تب. تب «چیدمان با عکس»
// حالا دو پنل دارد: WizardPanel (ویزارد ۳ مرحله‌ای) و ResultCanvas
// (پیش‌نمایش زنده قبل از رندر + قهرمان و ۳ تب بعد از رندر).
// تحلیل اتاق داخل RoomUploader، زیر عکس آپلودشده می‌ماند.
// ============================================================
import { Wand2, Search, Sparkles } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { SuggestAssistant } from "@/components/ai/SuggestAssistant";
import { cn } from "@/lib/utils";
import type { DesignStudio as Studio } from "./useDesignStudio";
import { WizardPanel } from "./WizardPanel";
import { ResultCanvas } from "./ResultCanvas";
import { InspirationTab } from "./InspirationTab";

export function DesignStudio({ studio }: { studio: Studio }) {
  const { tab, setTab, selectStyle, setBudget, toast } = studio;
  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-6 sm:py-8">
        <div className="mb-4 [&_a]:text-ink-muted"><Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "هومینو استودیو" }]} /></div>

        {/* Header — جمع‌تر شده */}
        <header className="mb-4 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-ink text-cream"><Wand2 size={22} /></span>
          <div>
            <h1 className="font-display text-xl font-black leading-tight text-ink sm:text-2xl">هومینو استودیو</h1>
            <p className="text-sm text-ink-muted">عکس خانه‌ات را آپلود کن، وسایل انتخاب کن و نتیجه را ببین</p>
          </div>
        </header>

        {/* Tabs — جمع‌تر: نوار باریک با آیکون، لیبل کامل فقط در دسکتاپ */}
        <div className="mb-5 flex gap-1 rounded-xl border border-clay/50 bg-cream p-1">
          {([["design", "چیدمان با عکس", Wand2], ["inspiration", "اسکن بصری", Search], ["suggest", "پیشنهاد دکور", Sparkles]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[13px] font-bold transition sm:gap-2 sm:text-sm", tab === id ? "bg-ink text-cream" : "text-ink-muted hover:text-ink")}>
              <Icon size={15} className="shrink-0" /> <span className="truncate">{label}</span>
            </button>
          ))}
        </div>

        {tab === "suggest" && <SuggestAssistant onApply={(p) => { selectStyle(p.style); setBudget(p.budget); setTab("design"); toast("پیشنهاد اعمال شد"); }} onBack={() => setTab("design")} />}

        {tab === "inspiration" && <InspirationTab studio={studio} />}

        {tab === "design" && (
          <div className="grid gap-4 lg:grid-cols-12 lg:gap-5">
            {/* راست (RTL اول): ویزارد ۳ مرحله‌ای — عکس ← سبک ← وسایل و اجرا */}
            <div className="lg:col-span-5">
              <WizardPanel studio={studio} />
            </div>

            {/* چپ: خروجی — قبل از رندر پیش‌نمایش زنده، بعد از رندر ۳ تب جمع */}
            <ResultCanvas studio={studio} />
          </div>
        )}
      </Container>
    </div>
  );
}

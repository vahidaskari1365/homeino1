"use client";
// ============================================================
// AI DESIGN STUDIO — composition layer.
// Header/tabs and the tab bodies; the "design" tab composes the
// independent steps (RoomUploader, StylePicker, ItemPicker,
// BudgetStep, GenerationProgress, ResultCanvas). All markup was
// moved verbatim from src/app/ai/design/page.tsx.
// ============================================================
import Link from "next/link";
import { Wand2, Search, Sparkles } from "lucide-react";
import { Container, Breadcrumb } from "@/components/shared";
import { SuggestAssistant } from "@/components/ai/SuggestAssistant";
import { cn } from "@/lib/utils";
import type { DesignStudio as Studio } from "./useDesignStudio";
import { AnalysisBanner } from "./AnalysisBanner";
import { RoomUploader } from "./RoomUploader";
import { StylePicker } from "./StylePicker";
import { ItemPicker } from "./ItemPicker";
import { BudgetStep } from "./BudgetStep";
import { GenerationProgress } from "./GenerationProgress";
import { ResultCanvas } from "./ResultCanvas";
import { InspirationTab } from "./InspirationTab";

export function DesignStudio({ studio }: { studio: Studio }) {
  const { tab, setTab, selectStyle, setBudget, toast } = studio;
  return (
    <div className="min-h-screen bg-ivory">
      <Container className="py-6">
        <div className="mb-4 [&_a]:text-ink-muted"><Breadcrumb items={[{ label: "خانه", href: "/" }, { label: "استودیو طراحی" }]} /></div>

        {/* Compact header */}
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-cream"><Wand2 size={18} /></span>
            <div>
              <h1 className="font-display text-lg font-black leading-tight text-ink">استودیو طراحی هوشمند</h1>
              <p className="text-[11px] text-ink-muted">عکس خانه‌ات را آپلود کن، وسایل انتخاب کن و نتیجه را ببین</p>
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-5 flex gap-2 rounded-xl border border-clay/50 bg-cream p-1">
          {([["design", "چیدمان با عکس", Wand2], ["inspiration", "اسکن بصری", Search], ["suggest", "پیشنهاد دکور", Sparkles]] as const).map(([id, label, Icon]) => (
            <button key={id} onClick={() => setTab(id)} className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-bold transition", tab === id ? "bg-ink text-cream" : "text-ink-muted hover:text-ink")}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {tab === "suggest" && <SuggestAssistant onApply={(p) => { selectStyle(p.style); setBudget(p.budget); setTab("design"); toast("پیشنهاد اعمال شد"); }} onBack={() => setTab("design")} />}

        {tab === "inspiration" && <InspirationTab studio={studio} />}

        {tab === "design" && (
          <>
            {studio.roomAnalysis && !studio.loading && <AnalysisBanner studio={studio} />}

            <div className="grid gap-4 lg:grid-cols-12">
              {/* LEFT: Controls */}
              <div className="space-y-3 lg:col-span-5">
                <RoomUploader studio={studio} />
                <StylePicker studio={studio} />
                <ItemPicker studio={studio} />
                <BudgetStep studio={studio} />
                <GenerationProgress studio={studio} />
              </div>

              {/* RIGHT: Output */}
              <ResultCanvas studio={studio} />
            </div>
          </>
        )}
        <div className="mt-6 text-center"><Link href="/ai/design" className="text-xs text-ink-muted hover:text-ink">← بازگشت به استودیو</Link></div>
      </Container>
    </div>
  );
}

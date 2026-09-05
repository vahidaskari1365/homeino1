"use client";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useDesignStudio } from "@/components/ai/design/useDesignStudio";
import { DesignStudio } from "@/components/ai/design/DesignStudio";

/** Orchestrator only — state lives in useDesignStudio, every visual block lives
 *  in src/components/ai/design/* (RoomUploader, StylePicker, ItemPicker,
 *  BudgetStep, GenerationProgress, ResultCanvas, InspirationTab, …). */
function DesignInner() {
  const studio = useDesignStudio();
  return <DesignStudio studio={studio} />;
}

export default function AIDesignPage() {
  return (
    <Suspense fallback={<div className="grid min-h-[70vh] place-items-center bg-ivory"><Loader2 className="animate-spin text-ink-muted" /></div>}>
      <DesignInner />
    </Suspense>
  );
}

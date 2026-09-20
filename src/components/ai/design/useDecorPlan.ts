"use client";
// ============================================================
// پیشنهاد دکور — هوک بخشِ کاملاً مستقل (مالک ۲۰۲۶-۰۹-۲۰).
//
// عکس خانه → تحلیل واقعی بینایی → پیشنهادهای اجرایی که هر کدام به
// محصولات واقعی سایت گره خورده‌اند → «روی عکس من اعمال کن» → رندر
// در همین بخش (موتور واقعی AI؛ بدون موتور، ترکیب صادقانهٔ مرورگر).
// هیچ پرشی به تب چیدمان وجود ندارد.
// ============================================================
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";
import { aiService } from "@/services/ai";
import { costOf } from "@/services/ai/credits";
import type { DecorPlanResult, PipelineInput, PipelineResult, ScanMatch } from "@/services/ai";
import { parseProductDimensions } from "@/services/ai/placement";
import { planReplacementPlacements } from "@/services/ai/studioPlacement";
import { compositeRoomImage } from "@/lib/studioComposite";
import { parseToman } from "@/lib/utils";
import { useCredits, useUi } from "@/stores/useApp";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { trackEvent } from "@/lib/tracking";
import { getProductById } from "@/data/products";
import { deriveTargetsFromProducts } from "./helpers";
import type { DesignStudio } from "./useDesignStudio";

/** ScanMatch → client Product (static catalog record wins for dimensions). */
function matchToProduct(m: ScanMatch): Product {
  return getProductById(m.id) ?? {
    id: m.id,
    slug: m.slug,
    name: m.name,
    brand: m.brand,
    storeId: "",
    categorySlug: m.categorySlug,
    styleSlugs: [],
    price: m.price,
    currency: "تومان",
    rating: 0,
    reviewsCount: 0,
    purchaseCount: 0,
    images: [m.image],
    colors: [],
    materials: [],
    description: "",
    specs: [],
    inStock: m.inStock,
    stockCount: 0,
    tags: [],
  };
}

export interface DecorApplyResult {
  image: string;
  real: boolean;
  engine: string;
}

export function useDecorPlan(studio: DesignStudio) {
  const router = useRouter();
  const { toast } = useUi();
  const saveSession = useDesignSessions((s) => s.saveSession);

  const [decorImage, setDecorImage] = useState<string | null>(null);
  const [plan, setPlan] = useState<DecorPlanResult | null>(null);
  const [phase, setPhase] = useState<"idle" | "planning" | "applying">("idle");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<DecorApplyResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDecorFile = useCallback((file: File) => studio.handleFile(file, setDecorImage), [studio]);

  const runPlan = useCallback(async () => {
    if (!decorImage) return toast("اول عکس فضا را آپلود کن", "error");
    setPhase("planning");
    setError(null);
    setResult(null);
    setPlan(null);
    try {
      trackEvent("ai_started", { metadata: { flow: "decor-plan" } });
      const res = await aiService.decorPlan({ referenceImage: decorImage, style: studio.style });
      setPlan(res);
      setSelected(new Set(res.suggestions.map((s) => s.id)));
      if (!res.suggestions.length) setError(res.notice ?? "پیشنهاد اجرایی برای این عکس ساخته نشد — عکس روشن‌تری امتحان کن");
      trackEvent("ai_finished", { metadata: { flow: "decor-plan", suggestions: res.suggestions.length, vision: res.visionAvailable } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "ساخت پیشنهاد ممکن نشد — دوباره تلاش کن";
      setError(msg);
      toast(msg, "error");
      trackEvent("ai_failed", {});
    } finally {
      setPhase("idle");
    }
  }, [decorImage, studio.style, toast]);

  const toggleSuggestion = useCallback((id: string) => {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }, []);

  /** «روی عکس من اعمال کن» — محصولات پیشنهادهای انتخابی در عکس می‌نشینند. */
  const applyPlan = useCallback(async () => {
    if (!decorImage || !plan) return;
    const chosenSuggestions = plan.suggestions.filter((s) => selected.has(s.id));
    const chosenMatches: ScanMatch[] = chosenSuggestions.flatMap((s) => s.products);
    const chosen: Product[] = [];
    for (const m of chosenMatches) {
      const p = matchToProduct(m);
      if (!chosen.some((x) => x.id === p.id)) chosen.push(p);
    }
    if (!chosen.length) return toast("حداقل یک پیشنهاد را انتخاب کن", "error");

    const isFullRoom = selected.size === plan.suggestions.length && plan.suggestions.length > 0;
    const opCost = costOf(isFullRoom ? "generate" : "edit");
    setPhase("applying");
    setError(null);
    setResult(null);

    const prompt = chosenSuggestions.map((s) => s.title).join(" + ") || "به‌روزرسانی دکور فضا";
    const pipelineInput: PipelineInput = {
      prompt: `دکور فضا را با این تغییرات بهتر کن: ${prompt}`,
      style: studio.style,
      room: studio.style === "office" ? "فضای اداری" : (studio.rs.roomType || "نشیمن"),
      scope: isFullRoom ? "full" : "targeted",
      targets: deriveTargetsFromProducts(chosen),
      referenceImage: decorImage,
      products: chosen.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.categorySlug,
        material: p.materials?.[0],
        color: p.colors?.[0]?.name,
        style: p.styleSlugs?.[0],
        image: p.images?.[0],
        dimensions: parseProductDimensions(p.dimensions),
      })),
      budget: undefined,
    };

    const res = await useCredits.getState().runAiOperation("اعمال پیشنهاد دکور", opCost, () => aiService.pipeline(pipelineInput));

    if (!res.ok) {
      setPhase("idle");
      if (res.reason === "insufficient") {
        setError("اعتبار کافی نیست");
        return toast("اعتبار کافی نیست", "error");
      }
      const err = res.error as (Error & { status?: number }) | undefined;
      if (err?.status === 401) {
        toast("برای اعمال پیشنهاد، اول وارد حساب شو", "error");
        router.push("/login?next=/ai/design?tab=suggest");
        return;
      }
      const msg = err?.message || "اعمال پیشنهاد ممکن نشد — دوباره تلاش کن";
      setError(msg);
      return toast(msg, "error");
    }

    try {
      const pipelineRes = res.result as PipelineResult;
      const edited = pipelineRes.result.afterImage;
      const realImage = !pipelineRes.result.preview && edited && edited !== decorImage ? edited : null;
      let outputImage = decorImage;
      if (realImage) {
        outputImage = realImage;
        setResult({ image: realImage, real: true, engine: pipelineRes.imageEngine });
        toast("پیشنهادها روی عکس تو اعمال شد");
      } else {
        // ترکیب صادقانهٔ مرورگر: مکان‌یابی بینایی + چسباندن واقع‌گرا.
        try {
          const cats = [...new Set(chosen.map((p) => (p.categorySlug || "furniture").toLowerCase()))].slice(0, 12);
          const detected = await aiService
            .detectObjects({ referenceImage: decorImage, categories: cats })
            .then((r) => r.objects ?? [])
            .catch(() => []);
          const plans = planReplacementPlacements(
            chosen.map((p) => ({ id: p.id, name: p.name, category: (p.categorySlug || "furniture").toLowerCase(), dimensions: parseProductDimensions(p.dimensions), description: p.description })),
            { roomType: studio.rs.roomType || "نشیمن", detected },
          );
          const composite = await compositeRoomImage({
            roomImage: decorImage,
            placements: plans.map((pl) => {
              const p = chosen.find((x) => x.id === pl.productId);
              return {
                src: p?.images[0] ?? "",
                xNorm: pl.targetRegion.x + pl.targetRegion.width / 2,
                yNorm: pl.targetRegion.y + pl.targetRegion.height / 2,
                widthPct: pl.widthPct,
                heightSquash: pl.squash ?? 1,
                glow: pl.glow,
              };
            }),
          });
          if (composite) {
            outputImage = composite;
            setResult({ image: composite, real: false, engine: "homeino-preview-composite" });
            toast("پیش‌نمایش ترکیب آماده شد — با وصل‌شدن موتور ویرایش، رندر واقعی می‌گیرید");
          } else {
            setError("رندر نتیجه ممکن نشد — دوباره تلاش کن");
          }
        } catch {
          setError("رندر نتیجه ممکن نشد — دوباره تلاش کن");
        }
      }
      trackEvent("ai_finished", { metadata: { flow: "decor-plan-apply", count: chosen.length } });
      saveSession({
        title: `پیشنهاد دکور: ${prompt.slice(0, 40)}`,
        prompt: pipelineInput.prompt,
        roomType: pipelineInput.room ?? "نشیمن",
        style: studio.style,
        colors: plan.palette,
        scope: isFullRoom ? "full" : "targeted",
        targets: pipelineInput.targets ?? [],
        status: realImage ? "success" : "partial-success",
        beforeImage: decorImage,
        afterImage: outputImage,
        regions: [],
        products: chosen.map((p) => ({ label: p.name, productId: p.id })),
        creditsUsed: opCost,
        preview: !realImage,
        imageEngine: realImage ? pipelineRes.imageEngine : "homeino-preview-composite",
      });
    } catch {
      setError("خطا در نمایش نتیجه");
    } finally {
      setPhase("idle");
    }
  }, [decorImage, plan, selected, studio.style, studio.rs, toast, router, saveSession]);

  const resetDecor = useCallback(() => {
    setDecorImage(null);
    setPlan(null);
    setSelected(new Set());
    setResult(null);
    setError(null);
  }, []);

  /** بازگشت از نتیجه به عکس اصلی — برای ترکیب دوباره با انتخاب‌های دیگر. */
  const clearResult = useCallback(() => setResult(null), []);

  return {
    decorImage, setDecorImage, handleDecorFile,
    plan, phase, selected, result, error,
    runPlan, toggleSuggestion, applyPlan, resetDecor, clearResult,
    budgetNum: parseToman(studio.budget) || undefined,
  };
}

export type DecorPlan = ReturnType<typeof useDecorPlan>;

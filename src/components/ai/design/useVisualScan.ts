"use client";
// ============================================================
// اسکن بصری — هوک مستقل جریان «عکس کالا → محصولات سایت → بذارش
// توی خونم» (مالک ۲۰۲۶-۰۹-۲۰).
//
// قاعدهٔ مالک: جریان باید در همین بخش کامل شود — «نه اینکه بیاد
// توی صفحهٔ چیدمان با عکس». پس هیچ setTab("design") ای وجود ندارد.
//
// زنجیره:
//   1. آپلود عکس کالا → action=visual-scan → لیست محصولات واقعی سایت
//   2. انتخاب محصول + آپلود عکس خانه → pipeline جای‌گذاری (موتور واقعی
//      AI) و اگر موتور ویرایش نبود → ترکیب مرورگری صادقانه با مکان‌یابی
//      بینایی — همان قرارداد صداقت استودیوی اصلی.
// ============================================================
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Product } from "@/types";
import { aiService } from "@/services/ai";
import { costOf } from "@/services/ai/credits";
import type { PipelineInput, PipelineResult, ScanMatch, VisualScanResult } from "@/services/ai";
import { parseProductDimensions } from "@/services/ai/placement";
import { planReplacementPlacements } from "@/services/ai/studioPlacement";
import { compositeRoomImage } from "@/lib/studioComposite";
import { useCredits, useUi } from "@/stores/useApp";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { trackEvent } from "@/lib/tracking";
import { getProductById } from "@/data/products";
import { deriveTargetsFromProducts } from "./helpers";
import type { DesignStudio } from "./useDesignStudio";

/** ScanMatch (server catalog lite) → client Product (static or synthesized). */
function matchToProduct(m: ScanMatch, staticProduct?: Product): Product {
  if (staticProduct) return staticProduct;
  return {
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

export interface ScanPlacementResult {
  image: string;
  /** true → real AI engine render; false → honest browser composite preview. */
  real: boolean;
  engine: string;
}

export type ScanPhase = "idle" | "scanning" | "placing";

export function useVisualScan(studio: DesignStudio) {
  const router = useRouter();
  const { toast } = useUi();
  const saveSession = useDesignSessions((s) => s.saveSession);

  const [step, setStep] = useState<"pick" | "place">("pick");
  const [scanImage, setScanImage] = useState<string | null>(null);
  const [scanRoomImage, setScanRoomImage] = useState<string | null>(null);
  const [phase, setPhase] = useState<ScanPhase>("idle");
  const [identified, setIdentified] = useState<VisualScanResult["identified"]>(null);
  const [visionAvailable, setVisionAvailable] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const [matches, setMatches] = useState<ScanMatch[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [result, setResult] = useState<ScanPlacementResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const detectedCache = useRef<Map<string, { type: string; region: { x: number; y: number; w: number; h: number } }[]>>(new Map());

  // ?product=slug — ورودی عمیق از صفحهٔ محصول: مستقیم به مرحلهٔ «بذارش توی خونم».
  // (همان الگوی single-line disable که در useDesignStudio برای restoreها رسم است.)
  useEffect(() => {
    if (studio.presetProduct && step === "pick" && !product) {
      const p = studio.presetProduct;
      setProduct(p); setMatches([{ id: p.id, slug: p.slug, name: p.name, brand: p.brand, price: p.price, currency: p.currency, image: p.images[0] ?? "", categorySlug: p.categorySlug, score: 100, reason: "محصول انتخابی تو", inStock: p.inStock }]); setStep("place"); // eslint-disable-line react-hooks/set-state-in-effect
    }
  }, [studio.presetProduct, step, product]);

  /** عکس کالا — مثل آپلود عادی ولی بدون تحلیل اتاق (state مستقل). */
  const handleScanFile = useCallback((file: File) => studio.handleFile(file, setScanImage), [studio]);

  const runScan = useCallback(async () => {
    if (!scanImage) return toast("اول عکس مدل را آپلود کن", "error");
    setPhase("scanning");
    setError(null);
    setNotice(null);
    try {
      trackEvent("ai_started", { metadata: { flow: "visual-scan" } });
      const res = await aiService.visualScan({ referenceImage: scanImage });
      setIdentified(res.identified);
      setVisionAvailable(res.visionAvailable);
      setMatches(res.matches);
      setNotice(res.notice ?? null);
      if (!res.matches.length) setError("محصول مشابهی در کاتالوگ هومینو پیدا نشد — عکس دیگری امتحان کن");
      trackEvent("ai_finished", { metadata: { flow: "visual-scan", matches: res.matches.length, vision: res.visionAvailable } });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "اسکن ممکن نشد — دوباره تلاش کن";
      setError(msg);
      toast(msg, "error");
      trackEvent("ai_failed", {});
    } finally {
      setPhase("idle");
    }
  }, [scanImage, toast]);

  const chooseProduct = useCallback((m: ScanMatch) => {
    // Static catalog record (with real dimensions) wins when available.
    const p = matchToProduct(m, getProductById(m.id));
    setProduct(p);
    setResult(null);
    setStep("place");
    toast(`«${m.name}» انتخاب شد — حالا عکس خانه‌ات را بگذار`);
  }, [toast]);

  const handleRoomFile = useCallback((file: File) => studio.handleFile(file, setScanRoomImage), [studio]);

  /** ترکیب مرورگری صادقانه: مکان‌یابی بینایی معادل کالا در عکس خانه + چسباندن واقع‌گرا. */
  const buildComposite = useCallback(async (p: Product, roomImg: string): Promise<string | null> => {
    try {
      const cat = (p.categorySlug || "furniture").toLowerCase();
      let detected = detectedCache.current.get(roomImg) ?? [];
      if (roomImg && !detectedCache.current.has(roomImg)) {
        detectedCache.current.set(roomImg, []);
        detected = await aiService
          .detectObjects({ referenceImage: roomImg, categories: [cat] })
          .then((r) => r.objects ?? [])
          .catch(() => []);
        detectedCache.current.set(roomImg, detected);
      }
      const plans = planReplacementPlacements(
        [{ id: p.id, name: p.name, category: cat, dimensions: parseProductDimensions(p.dimensions), description: p.description }],
        { roomType: studio.rs.roomType || "نشیمن", detected },
      );
      const plan = plans[0];
      if (!plan) return null;
      return await compositeRoomImage({
        roomImage: roomImg,
        placements: [{
          src: p.images[0] ?? "",
          xNorm: plan.targetRegion.x + plan.targetRegion.width / 2,
          yNorm: plan.targetRegion.y + plan.targetRegion.height / 2,
          widthPct: plan.widthPct,
          heightSquash: plan.squash ?? 1,
          glow: plan.glow,
        }],
      });
    } catch {
      return null;
    }
  }, [studio.rs]);

  /** «بذارش توی خونم» — جای‌گذاری محصول انتخابی در عکس خانه، در همین بخش. */
  const placeInRoom = useCallback(async () => {
    if (!product) return toast("اول محصول را انتخاب کن", "error");
    if (!scanRoomImage) return toast("عکس خانه را آپلود کن", "error");

    const opCost = costOf("placement");
    setPhase("placing");
    setError(null);
    setResult(null);

    const pipelineInput: PipelineInput = {
      prompt: `محصول «${product.name}» را در اتاق قرار بده`,
      style: studio.style,
      room: studio.style === "office" ? "فضای اداری" : (studio.rs.roomType || "نشیمن"),
      scope: "targeted",
      targets: deriveTargetsFromProducts([product]),
      referenceImage: scanRoomImage,
      productId: product.id,
      products: [{
        id: product.id,
        name: product.name,
        category: product.categorySlug,
        material: product.materials?.[0],
        color: product.colors?.[0]?.name,
        style: product.styleSlugs?.[0],
        image: product.images?.[0],
        dimensions: parseProductDimensions(product.dimensions),
      }],
    };

    const res = await useCredits.getState().runAiOperation("جای‌گذاری محصول در خانه", opCost, () => aiService.pipeline(pipelineInput));

    if (!res.ok) {
      setPhase("idle");
      if (res.reason === "insufficient") {
        setError("اعتبار کافی نیست");
        return toast("اعتبار کافی نیست", "error");
      }
      const err = res.error as (Error & { status?: number }) | undefined;
      if (err?.status === 401) {
        toast("برای جای‌گذاری، اول وارد حساب شو", "error");
        router.push("/login?next=/ai/design?tab=inspiration");
        return;
      }
      const msg = err?.message || "جای‌گذاری ممکن نشد — دوباره تلاش کن";
      setError(msg);
      return toast(msg, "error");
    }

    try {
      const pipelineRes = res.result as PipelineResult;
      const edited = pipelineRes.result.afterImage;
      const realImage = !pipelineRes.result.preview && edited && edited !== scanRoomImage ? edited : null;
      let outputImage = scanRoomImage;
      if (realImage) {
        outputImage = realImage;
        setResult({ image: realImage, real: true, engine: pipelineRes.imageEngine });
        toast("محصول در عکس خانه‌ات قرار گرفت");
      } else {
        const composite = await buildComposite(product, scanRoomImage);
        if (composite) {
          outputImage = composite;
          setResult({ image: composite, real: false, engine: "homeino-preview-composite" });
          toast("پیش‌نمایش ترکیب آماده شد — با وصل‌شدن موتور ویرایش، رندر واقعی می‌گیرید");
        } else {
          setError("رندر نتیجه ممکن نشد — دوباره تلاش کن");
        }
      }
      trackEvent("ai_finished", { metadata: { flow: "visual-scan-place", productId: product.id } });
      saveSession({
        title: `اسکن بصری: ${product.name}`,
        prompt: pipelineInput.prompt,
        roomType: pipelineInput.room ?? "نشیمن",
        style: studio.style,
        colors: [],
        scope: "targeted",
        targets: pipelineInput.targets ?? [],
        status: realImage ? "success" : "partial-success",
        beforeImage: scanRoomImage,
        afterImage: outputImage,
        regions: [],
        products: [{ label: product.name, productId: product.id }],
        creditsUsed: opCost,
        preview: !realImage,
        imageEngine: realImage ? pipelineRes.imageEngine : "homeino-preview-composite",
      });
    } catch {
      setError("خطا در نمایش نتیجه");
    } finally {
      setPhase("idle");
    }
  }, [product, scanRoomImage, studio.style, studio.rs, toast, router, buildComposite, saveSession]);

  const resetScan = useCallback(() => {
    setStep("pick");
    setScanImage(null);
    setScanRoomImage(null);
    setIdentified(null);
    setMatches([]);
    setProduct(null);
    setResult(null);
    setNotice(null);
    setError(null);
  }, []);

  /** جای‌گذاری دوباره روی همین عکس خانه. */
  const clearResult = useCallback(() => setResult(null), []);

  const backToPick = useCallback(() => { setStep("pick"); setResult(null); setScanRoomImage(null); }, []);

  return {
    step, setStep,
    scanImage, setScanImage, handleScanFile,
    scanRoomImage, setScanRoomImage, handleRoomFile,
    phase, identified, visionAvailable, notice, matches,
    product, result, error,
    runScan, chooseProduct, placeInRoom, resetScan, backToPick, clearResult,
  };
}

export type VisualScan = ReturnType<typeof useVisualScan>;

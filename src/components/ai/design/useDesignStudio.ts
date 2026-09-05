"use client";
// ============================================================
// AI DESIGN STUDIO — orchestrator hook.
// Formerly the body of src/app/ai/design/page.tsx; the UI JSX now
// lives in the leaf components under components/ai/design/ and this
// hook only owns the state + side effects of the studio. JSX and
// classes were moved verbatim — no visual change.
// ============================================================
import { useMemo, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import type { Product } from "@/types";
import { costForMode, aiService } from "@/services/ai";
import type { PipelineInput, PipelineResult } from "@/services/ai/pipeline";
import type { PlacementProduct, ProductPlacementPlan } from "@/services/ai/placement";
import { parseProductDimensions } from "@/services/ai/placement";
import type { RoomElement } from "@/services/ai/roomState";
import {
  detectIntent,
  computeChangeScope,
  categoryToRoomElement,
  type AiIntent,
  type ScopedChange,
  detectCategorySkuConflict,
  matchStoreProducts,
  type MatchedStoreProduct,
} from "@/services/ai/roomState";
import { costOf } from "@/services/ai/credits";
import type { RoomAnalysis, GuidedSuggestion } from "@/services/ai/types";
import { products, getProductById, getProductBySkuOrCode } from "@/data/products";
import { useCredits, useUi } from "@/stores/useApp";
import { useDesignSessions } from "@/stores/useDesignSessions";
import { useCart, useWishlist } from "@/stores/useShop";
import { useRoomState } from "@/stores/useRoomState";
import { trackEvent } from "@/lib/tracking";
import type { Placement } from "@/components/ProductOverlay";
import { STYLES, CATEGORIES, CAT_PRODUCTS, SECOND_HAND_AS_PRODUCTS, DEFAULT_ROOM_IDS, STAGE_ORDER, type Stage } from "./constants";
import {
  deriveTargetsFromProducts,
  buildPlacementsFromPlan,
  buildScopeSummary,
  makePlacements,
} from "./helpers";

export type { Stage };

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function useDesignStudio() {
  const sp = useSearchParams();
  const presetSlug = sp.get("product");
  const router = useRouter();
  const [tab, setTab] = useState<"design" | "inspiration" | "suggest">(sp.get("tab") === "inspiration" ? "inspiration" : "design");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [presetProduct, setPresetProduct] = useState<Product | null>(null);
  const [style, setStyle] = useState("modern");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("");
  const [skuInput, setSkuInput] = useState("");
  const [skuWarning, setSkuWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("UPLOADING");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [matchedStoreProducts, setMatchedStoreProducts] = useState<MatchedStoreProduct[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(["furniture"]));
  const [selectedSubTypes, setSelectedSubTypes] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const [inspirationMatches, setInspirationMatches] = useState<Product[]>([]);

  const addToCart = useCart((s) => s.add);
  const wl = useWishlist();
  const { toast } = useUi();
  const saveSession = useDesignSessions((s) => s.saveSession);
  const cost = costForMode("room-redesign");
  const styleLabel = STYLES.find((s) => s.id === style)?.label ?? style;

  const rs = useRoomState();
  const [, setLastIntent] = useState<AiIntent | null>(null);
  const [lastScope, setLastScope] = useState<ScopedChange | null>(null);
  const [roomAnalysis, setRoomAnalysis] = useState<RoomAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);

  const analyzeRoom = useCallback(async (image: string) => {
    setAnalyzing(true); setRoomAnalysis(null);
    try {
      const analysis = await aiService.analyze({ mode: "room-redesign", prompt: "تحلیل", referenceImage: image, room: style === "office" ? "فضای اداری" : "پذیرایی", style });
      setRoomAnalysis(analysis);
      rs.setRoomMeta({ detectedStyle: analysis.style, detectedColors: analysis.palette, roomType: analysis.roomType });
    } catch {}
    finally { setAnalyzing(false); }
  }, [style, rs]);

  const toggleCat = useCallback((slug: string) => setOpenCats((s) => { const n = new Set(s); n.has(slug) ? n.delete(slug) : n.add(slug); return n; }), []);
  const toggleSubType = useCallback((slug: string, label: string) => setSelectedSubTypes((s) => { const cur = s[slug] || []; return { ...s, [slug]: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] }; }), []);
  const toggleProduct = useCallback((p: Product) => setSelected((s) => { const n = { ...s }; if (n[p.id]) delete n[p.id]; else n[p.id] = p; return n; }), []);
  const selectStyle = useCallback((id: string) => { setStyle(id); if (id === "office") setOpenCats((s) => new Set(s).add("office")); }, []);

  // ---- GUIDED DESIGN: apply or customize AI suggestions ----
  const applySuggestion = useCallback((sg: GuidedSuggestion) => {
    const catMap: Record<string, string> = { rug: "carpet", lighting: "lighting", plant: "plants", sofa: "furniture" };
    const catSlug = catMap[sg.category] || "furniture";
    setOpenCats((s) => new Set(s).add(catSlug));
    const cat = CATEGORIES.find((c) => c.slug === catSlug);
    if (cat && cat.subTypes[0]) {
      setSelectedSubTypes((s) => ({ ...s, [catSlug]: [cat.subTypes[0].label] }));
    }
    setPrompt((p) => p ? `${p}\n${sg.title}` : sg.title);
    toast(`پیشنهاد «${sg.title}» اعمال شد — برای ادامه طراحی بزن`);
  }, [toast]);

  const customizeSuggestion = useCallback((sg: GuidedSuggestion) => {
    setPrompt(sg.desc);
    toast("توضیحات پیشنهاد در فیلد دستور قرار گرفت — می‌تونی ویرایش کنی");
  }, [toast]);

  useEffect(() => {
    if (presetSlug) { const p = products.find((x) => x.slug === presetSlug); if (p) { setPresetProduct(p); setSelected((s) => ({ ...s, [p.id]: p })); setTab("inspiration"); } } // eslint-disable-line react-hooks/set-state-in-effect
  }, [presetSlug]);

  // CONTINUE DESIGN: ?session=<id> restores a saved design session (uploaded
  // room photo + prompt + style) instead of silently opening an empty studio.
  // Continuation restore — same single-line disable pattern as presetSlug above.
  useEffect(() => {
    const sid = sp.get("session");
    if (!sid || imageBase64) return;
    const session = useDesignSessions.getState().sessions.find((s) => s.id === sid);
    if (!session) return;
    if (session.beforeImage) { setImageBase64(session.beforeImage); rs.loadRoom(session.beforeImage, style === "office" ? "فضای اداری" : "پذیرایی"); } // eslint-disable-line react-hooks/set-state-in-effect
    if (session.prompt) setPrompt(session.prompt);
    if (session.style) setStyle(session.style);
    toast("طراحی ذخیره‌شده بازیابی شد — از همین‌جا ادامه بده");
  }, [sp]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFile = useCallback((file: File, set: (v: string) => void = setImageBase64) => {
    if (!ALLOWED_TYPES.includes(file.type)) return toast("فقط JPG، PNG یا WEBP", "error");
    if (file.size > MAX_FILE_SIZE) return toast("حداکثر حجم تصویر ۱۰ مگابایت", "error");
    const r = new FileReader();
    r.onerror = () => toast("خطا در خواندن فایل", "error");
    r.onload = () => { const d = r.result as string; if (typeof d !== "string" || d.length < 100) return toast("فایل نامعتبر", "error"); set(d); if (set === setImageBase64) { rs.loadRoom(d, style === "office" ? "فضای اداری" : "پذیرایی"); analyzeRoom(d); } };
    r.readAsDataURL(file); trackEvent("room_uploaded", { metadata: { name: file.name, size: file.size } });
  }, [toast, rs, style, analyzeRoom]);

  const designElements = useMemo(() => CATEGORIES.flatMap((c) => (selectedSubTypes[c.slug] || []).map((label) => { const st = c.subTypes.find((x) => x.label === label); return { catSlug: c.slug, cat: c.label, label, desc: st?.desc || "" }; })), [selectedSubTypes]);
  const placedProducts = useMemo(() => {
    const cursor: Record<string, number> = {}; const out: Product[] = [];
    designElements.forEach((e) => {
      if (e.catSlug === "second-hand") { const sh = SECOND_HAND_AS_PRODUCTS[e.label] || []; if (!sh.length) return; const idx = cursor[e.label] = (cursor[e.label] ?? 0); cursor[e.label]++; const prod = sh[idx % sh.length]; if (prod && !out.find((x) => x.id === prod.id)) out.push(prod); return; }
      const pool = CAT_PRODUCTS[e.catSlug] || []; if (!pool.length) return; const i = cursor[e.catSlug] = (cursor[e.catSlug] ?? 0); cursor[e.catSlug]++; const prod = getProductById(pool[i % pool.length]); if (prod && !out.find((x) => x.id === prod.id)) out.push(prod);
    });
    return out;
  }, [designElements]);
  const total = placedProducts.reduce((s, p) => s + p.price, 0);

  const handleSkuChange = useCallback((val: string) => {
    setSkuInput(val);
    const trimmed = val.trim();
    if (!trimmed) {
      setSkuWarning(null);
      return;
    }
    const found = getProductBySkuOrCode(trimmed);
    if (!found) {
      setSkuWarning("کد محصول نامعتبر است — محصولی با این کد در کاتالوگ فروشگاه‌ها یافت نشد.");
      return;
    }
    const catSlugs = designElements.map((e) => e.catSlug);
    const conflict = detectCategorySkuConflict(catSlugs, found);
    if (conflict.hasConflict) {
      setSkuWarning(conflict.message || "توجه: دسته‌بندی انتخاب‌شده با کد محصول همخوانی ندارد.");
    } else {
      setSkuWarning(null);
    }
  }, [designElements]);

  const generate = useCallback(async () => {
    if (!imageBase64) return toast("عکس خانه را آپلود کن", "error");

    const chosen: Product[] = placedProducts.length
      ? placedProducts
      : DEFAULT_ROOM_IDS.map(getProductById).filter(Boolean) as Product[];

    const isFullSet = designElements.length === 0;
    const uiIntent = detectIntent(prompt, style);
    const uiScope = computeChangeScope(uiIntent);
    const isFullRoom = isFullSet || uiIntent.type === "full_redesign";
    const opCost = costOf(isFullRoom ? "generate" : (presetProduct ? "placement" : "edit"));

    const lastTargets: RoomElement[] = (rs.placements ?? [])
      .slice(-1)
      .flatMap((p): RoomElement[] => {
        const cat = (getProductById(p.productId)?.categorySlug ?? "").toLowerCase();
        if (/furniture|sofa/.test(cat)) return ["sofa"];
        if (/rug|carpet/.test(cat)) return ["rug"];
        if (/curtain|textile/.test(cat)) return ["curtain"];
        if (/light|lamp/.test(cat)) return ["lighting"];
        if (/bed/.test(cat)) return ["bed"];
        if (/tv/.test(cat)) return ["tv"];
        if (/plant/.test(cat)) return ["plant"];
        if (/art|decor/.test(cat)) return ["art"];
        if (/shelf|bookcase/.test(cat)) return ["shelf"];
        if (/table|chair|dining|office/.test(cat)) return ["table"];
        return [];
      });

    const previousTargets: RoomElement[] = lastTargets.length ? lastTargets : uiScope.targets;
    const previousChanges: string[] = rs.appliedChanges.slice(-3);

    const pipelineProducts: PlacementProduct[] = chosen.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.categorySlug,
      material: p.materials?.[0],
      color: p.colors?.[0]?.name,
      style: p.styleSlugs?.[0],
      dimensions: parseProductDimensions(p.dimensions),
    }));

    const budgetNum = Number(budget.replace(/[^\d]/g, "")) || undefined;

    const resolvedSkuProduct = skuInput.trim() ? getProductBySkuOrCode(skuInput.trim()) : undefined;
    const categoryTargets = designElements.map((e) => categoryToRoomElement(e.catSlug, e.label));
    const derivedTargets: RoomElement[] = deriveTargetsFromProducts(chosen);
    const finalTargets: RoomElement[] = [...new Set([...uiScope.targets, ...derivedTargets, ...categoryTargets])];

    const pipelineInput: PipelineInput = {
      prompt: prompt || (isFullRoom ? "بازطراحی کامل فضا" : chosen.map((p) => p.name).join("، ")),
      style,
      room: style === "office" ? "فضای اداری" : (rs.roomType || "نشیمن"),
      colors: roomAnalysis?.palette ?? rs.detectedColors ?? undefined,
      scope: isFullRoom ? "full" : "targeted",
      targets: finalTargets.length ? finalTargets : undefined,
      preservedExtra: undefined,
      referenceImage: imageBase64,
      mask: undefined,
      previousTargets: previousTargets.length ? previousTargets : undefined,
      previousChanges: previousChanges.length ? previousChanges : undefined,
      previousProductId: rs.placements?.[rs.placements.length - 1]?.productId,
      previousSKU: getProductById(rs.placements?.[rs.placements.length - 1]?.productId ?? "")?.sku,
      sku: skuInput.trim() || undefined,
      productCode: skuInput.trim() || undefined,
      productId: resolvedSkuProduct?.id ?? presetProduct?.id ?? (chosen.length === 1 ? chosen[0].id : undefined),
      selection: designElements.length > 0
        ? {
            category: designElements[0].catSlug,
            subTypes: designElements.map((e) => e.label),
            targets: finalTargets,
          }
        : undefined,
      products: pipelineProducts.length ? pipelineProducts : undefined,
      budget: budgetNum ? { min: budgetNum, currency: "تومان" } : undefined,
      roomUnderstanding: roomAnalysis
        ? {
            roomType: roomAnalysis.roomType,
            layout: "unknown",
            lighting: "unknown",
            objects: [],
            confidence: 0.6,
          }
        : undefined,
    };

    trackEvent("ai_started", {
      metadata: { style: styleLabel, items: chosen.length, fullSet: isFullRoom, scope: uiScope.targets.join("، ") },
    });

    setLoading(true);
    setError(null);
    setPlacements([]);
    setStage("ANALYZING_SPACE");

    const stageTimer = setInterval(() => {
      setStage((cur) => {
        const i = STAGE_ORDER.indexOf(cur);
        if (i < STAGE_ORDER.length - 1) return STAGE_ORDER[i + 1];
        return cur;
      });
    }, 900);

    const opLabel = isFullRoom ? "طراحی کامل" : (presetProduct ? "جای‌گذاری محصول" : "چیدمان وسایل");

    const result = await useCredits.getState().runAiOperation(opLabel, opCost, async () => {
      return aiService.pipeline(pipelineInput);
    });

    clearInterval(stageTimer);

    if (!result.ok) {
      setLoading(false);
      if (result.reason === "insufficient") {
        setError("اعتبار کافی نیست");
        return toast("اعتبار کافی نیست", "error");
      }
      if (result.reason === "duplicate") {
        setError("درخواست تکراری — نتیجه قبلی در حال پردازش است");
        return;
      }
      setError("خطا در پردازش — لطفاً دوباره تلاش کن");
      trackEvent("ai_failed", {});
      return toast("خطا در پردازش AI — اعتبار برگردانده شد", "error");
    }

    try {
      const pipelineRes: PipelineResult = result.result;
      const inst = pipelineRes.instruction;
      const plan: ProductPlacementPlan | undefined = pipelineRes.placement ?? inst.placement;

      setLastIntent(uiIntent);
      setLastScope({
        targets: inst.targets.length ? inst.targets : uiScope.targets,
        lockedElements: inst.preserved.length ? inst.preserved : uiScope.lockedElements,
        summary: buildScopeSummary(pipelineRes, uiScope),
      });

      const renderedPlacements = plan && chosen.length >= 1
        ? buildPlacementsFromPlan(chosen, plan)
        : makePlacements(chosen);
      setPlacements(renderedPlacements);

      const editedImage = pipelineRes.result.afterImage;
      const isPreview = !!pipelineRes.result.preview || editedImage === imageBase64;
      const outputImage = isPreview ? imageBase64 : editedImage;

      const realMatched = pipelineRes.matchedProducts && pipelineRes.matchedProducts.length > 0
        ? pipelineRes.matchedProducts
        : matchStoreProducts({
            sku: skuInput.trim() || undefined,
            productId: resolvedSkuProduct?.id,
            targets: inst.targets.length ? inst.targets : finalTargets,
            style,
            roomType: rs.roomType,
            budget: budgetNum,
          });
      setMatchedStoreProducts(realMatched);

      rs.commitChange({
        label: isFullRoom ? "چیدمان کامل" : (inst.targets.map((t) => t).join("، ") || uiScope.targets.join("، ")),
        image: outputImage,
        placements: renderedPlacements.map((pl) => ({
          productId: pl.product.id,
          category: pl.product.categorySlug,
          reason: plan?.rationale ?? uiScope.summary,
          placement: {
            x: pl.xNorm,
            y: pl.yNorm,
            scale: pl.scale,
            rotation: pl.rotation ?? 0,
          },
        })),
        change: pipelineRes.intent.changes?.[0] ?? (prompt || uiScope.summary),
        scope: pipelineRes.scope,
      });

      setStage("RENDERING");
      trackEvent("ai_finished", {
        metadata: {
          count: chosen.length,
          preview: isPreview,
          engine: pipelineRes.imageEngine,
          requestId: pipelineRes.requestId,
        },
      });

      saveSession({
        title: isFullRoom ? `طراحی ${styleLabel}` : (prompt || "چیدمان هوشمند"),
        prompt: pipelineInput.prompt,
        roomType: pipelineInput.room ?? "نشیمن",
        style,
        colors: pipelineInput.colors ?? [],
        scope: isFullRoom ? "full" : "targeted",
        targets: finalTargets,
        status: isPreview ? "partial-success" : "success",
        beforeImage: imageBase64,
        afterImage: outputImage,
        regions: [],
        products: chosen.map((p) => ({ label: p.name, productId: p.id })),
        creditsUsed: opCost,
        preview: isPreview,
        imageEngine: pipelineRes.imageEngine,
      });

      if (isPreview) {
        toast("نتیجه به‌صورت پیش‌نمایش آماده شد (موتور تصویر در دسترس نیست)");
      } else {
        toast("چیدمان آماده شد");
      }
    } catch {
      setError("خطا در نمایش نتیجه");
    } finally {
      setLoading(false);
    }
  }, [imageBase64, placedProducts, designElements, presetProduct, prompt, style, budget, skuInput, rs, roomAnalysis, styleLabel, toast, saveSession]);

  const updatePlacement = useCallback((id: string, patch: Partial<Placement>) => setPlacements((ps) => ps.map((pl) => (pl.product.id === id ? { ...pl, ...patch } : pl))), []);
  const removePlacement = useCallback((id: string) => setPlacements((ps) => ps.filter((pl) => pl.product.id !== id)), []);
  const overlayCart = useCallback((p: Product) => { addToCart(p.id); toast("به سبد اضافه شد"); }, [addToCart, toast]);
  const overlayWishlist = useCallback((p: Product) => { wl.toggleProduct(p.id); toast("به علاقه‌مندی اضافه شد"); }, [wl, toast]);
  const overlayView = useCallback((p: Product) => router.push(`/products/${p.slug}`), [router]);

  const placePresetInRoom = useCallback(async () => {
    if (!imageBase64) return toast("عکس خانه را آپلود کن", "error");
    if (!presetProduct) return;

    const opCost = costOf("placement");
    const pipelineProduct: PlacementProduct = {
      id: presetProduct.id,
      name: presetProduct.name,
      category: presetProduct.categorySlug,
      material: presetProduct.materials?.[0],
      color: presetProduct.colors?.[0]?.name,
      style: presetProduct.styleSlugs?.[0],
      dimensions: parseProductDimensions(presetProduct.dimensions),
    };

    const targets: RoomElement[] = deriveTargetsFromProducts([presetProduct]);

    const pipelineInput: PipelineInput = {
      prompt: prompt || `محصول «${presetProduct.name}» را در اتاق قرار بده`,
      style,
      room: style === "office" ? "فضای اداری" : (rs.roomType || "نشیمن"),
      scope: "targeted",
      targets,
      referenceImage: imageBase64,
      productId: presetProduct.id,
      products: [pipelineProduct],
      previousTargets: deriveTargetsFromProducts(placedProducts),
      previousChanges: rs.appliedChanges.slice(-3),
    };

    setLoading(true);
    setError(null);
    setPlacements([]);
    setStage("ANALYZING_SPACE");

    const timer = setInterval(() => {
      setStage((cur) => {
        const i = STAGE_ORDER.indexOf(cur);
        if (i < STAGE_ORDER.length - 1) return STAGE_ORDER[i + 1];
        return cur;
      });
    }, 900);

    const result = await useCredits.getState().runAiOperation("جای‌گذاری محصول", opCost, async () => {
      return aiService.pipeline(pipelineInput);
    });

    clearInterval(timer);

    if (!result.ok) {
      setLoading(false);
      if (result.reason === "insufficient") {
        setError("اعتبار کافی نیست");
        return toast("اعتبار کافی نیست", "error");
      }
      if (result.reason === "duplicate") {
        setError("درخواست تکراری — نتیجه قبلی در حال پردازش است");
        return;
      }
      setError("خطا در پردازش");
      return toast("خطا در جای‌گذاری — اعتبار برگردانده شد", "error");
    }

    try {
      const pipelineRes: PipelineResult = result.result;
      const plan = pipelineRes.placement ?? pipelineRes.instruction.placement;
      const fallbackPlacement: Placement = { product: presetProduct, xNorm: 0.5, yNorm: 0.6, scale: 1 };
      const newPlacements = plan
        ? buildPlacementsFromPlan([presetProduct], plan)
        : [fallbackPlacement];

      const editedImage = pipelineRes.result.afterImage;
      const isPreview = !!pipelineRes.result.preview || editedImage === imageBase64;
      const outputImage = isPreview ? imageBase64 : editedImage;

      setPlacements(newPlacements);
      setStage("RENDERING");
      setTab("design");

      const matchedStore = pipelineRes.matchedProducts && pipelineRes.matchedProducts.length > 0
        ? pipelineRes.matchedProducts
        : matchStoreProducts({
            productId: presetProduct.id,
            targets,
            style,
            roomType: rs.roomType,
          });
      setMatchedStoreProducts(matchedStore);

      rs.commitChange({
        label: `جای‌گذاری ${presetProduct.name}`,
        image: outputImage,
        placements: newPlacements.map((pl) => ({
          productId: pl.product.id,
          category: pl.product.categorySlug,
          reason: plan?.rationale ?? "جای‌گذاری محصول",
          placement: { x: pl.xNorm, y: pl.yNorm, scale: pl.scale, rotation: pl.rotation ?? 0 },
        })),
        change: prompt || `قرار دادن ${presetProduct.name} در اتاق`,
        scope: pipelineRes.scope,
      });

      saveSession({
        title: `جای‌گذاری ${presetProduct.name}`,
        prompt: pipelineInput.prompt,
        roomType: pipelineInput.room ?? "نشیمن",
        style,
        colors: [],
        scope: "targeted",
        targets,
        status: isPreview ? "partial-success" : "success",
        beforeImage: imageBase64,
        afterImage: outputImage,
        regions: [],
        products: [{ label: presetProduct.name, productId: presetProduct.id }],
        creditsUsed: opCost,
        preview: isPreview,
        imageEngine: pipelineRes.imageEngine,
      });

      toast(isPreview ? "محصول به‌صورت پیش‌نمایش قرار گرفت (موتور تصویر در دسترس نیست)" : "محصول در عکس قرار گرفت");
    } catch {
      setError("خطا در نمایش نتیجه");
    } finally {
      setLoading(false);
    }
  }, [imageBase64, presetProduct, prompt, style, rs, placedProducts, toast, saveSession]);

  const buyTheLook = useCallback(() => { if (!placedProducts.length) return; placedProducts.forEach((p) => addToCart(p.id)); toast("چیدمان به سبد اضافه شد"); }, [placedProducts, addToCart, toast]);
  const handleSaveToWishlist = useCallback(() => {
    if (!placedProducts.length) return toast("اول محصولاتی در طرح قرار بده", "info");
    // Idempotent add — the old toggle could silently REMOVE everything on a
    // second click while the toast kept claiming it was saved.
    let added = 0;
    placedProducts.forEach((p) => { if (!wl.products.includes(p.id)) { wl.toggleProduct(p.id); added += 1; } });
    toast(added > 0 ? `${added} محصول طرح به علاقه‌مندی‌ها اضافه شد` : "همه محصولات این طرح قبلاً ذخیره شده‌اند");
  }, [placedProducts, wl, toast]);

  /** Clear the uploaded photo + every derived result (verbatim remove handler). */
  const removeImage = useCallback(() => {
    setImageBase64(null);
    setPlacements([]);
    rs.reset();
    setRoomAnalysis(null);
    setMatchedStoreProducts([]);
  }, [rs]);

  return {
    // routing / tabs
    router,
    tab,
    setTab,
    // upload
    imageBase64,
    setImageBase64,
    analyzing,
    presetProduct,
    setPresetProduct,
    inspirationMatches,
    setInspirationMatches,
    handleFile,
    // style / prompt / budget
    style,
    styleLabel,
    selectStyle,
    prompt,
    setPrompt,
    budget,
    setBudget,
    // items / sku
    openCats,
    toggleCat,
    selectedSubTypes,
    setSelectedSubTypes,
    toggleSubType,
    selected,
    toggleProduct,
    skuInput,
    skuWarning,
    handleSkuChange,
    // analysis
    roomAnalysis,
    analyzeRoom,
    applySuggestion,
    customizeSuggestion,
    // derived cart of chosen items
    designElements,
    placedProducts,
    total,
    // generation
    cost,
    loading,
    stage,
    error,
    generate,
    // result canvas
    placements,
    setPlacements,
    removeImage,
    updatePlacement,
    removePlacement,
    overlayCart,
    overlayWishlist,
    overlayView,
    lastScope,
    matchedStoreProducts,
    addToCart,
    // actions
    buyTheLook,
    handleSaveToWishlist,
    placePresetInRoom,
    // room-state (undo/redo + overlay mode)
    rs,
    wl,
    toast,
    saveSession,
  };
}

export type DesignStudio = ReturnType<typeof useDesignStudio>;


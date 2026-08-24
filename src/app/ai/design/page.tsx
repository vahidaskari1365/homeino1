"use client";
import { useState, useRef, useMemo, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Upload, Wand2, Search, Sparkles, RefreshCw, X, ShoppingBag, Lightbulb,
  Download, Share2, Sofa, Blinds, Grid3x3, Lamp, BedDouble, Flower2,
  Image as ImageIcon, Gem, ChevronDown, Tv, BookOpen, Heart, CreditCard, Store, Loader2, Check,
  Briefcase, Lock as LockIcon, Undo2, Redo2, AlertCircle, Recycle, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { Container, Breadcrumb } from "@/components/shared";
import { ProductOverlay, type Placement } from "@/components/ProductOverlay";
import { costForMode, aiService } from "@/services/ai";
import type { PipelineInput, PipelineResult } from "@/services/ai/pipeline";
import type { PlacementProduct, ProductPlacementPlan } from "@/services/ai/placement";
import type { RoomElement } from "@/services/ai/roomState";
import {
  CATEGORY_SKU_CONFLICT_MESSAGE,
  INVALID_SKU_MESSAGE,
  categoryToTarget,
  mapUiSelectionToTargets,
  resolveProductCode,
  toMatchableProduct,
  type StoreProductMatch,
} from "@/services/ai/productMatching";
import { costOf } from "@/services/ai/credits";
import type { RoomAnalysis, GuidedSuggestion } from "@/services/ai/types";
import { products, getProductById, PRODUCT_SKUS } from "@/data/products";
import { offers } from "@/data/offers";
import { secondHandProducts } from "@/data/secondHand";
import { IMG } from "@/data/media";
import { useCredits, useUi } from "@/stores/useApp";
import { useCart, useWishlist } from "@/stores/useShop";
import { useRoomState } from "@/stores/useRoomState";
import { detectIntent, computeChangeScope, type AiIntent, type ScopedChange } from "@/services/ai/roomState";
import { trackEvent } from "@/lib/tracking";
import { toFa, formatPrice, cn } from "@/lib/utils";
import { shareContent, buildShareUrl } from "@/lib/share";
import type { Product } from "@/types";

type Stage = "UPLOADING" | "ANALYZING_SPACE" | "SELECTING_PRODUCTS" | "LAYING_OUT" | "RENDERING";
const STAGE_LABEL: Record<Stage, string> = {
  UPLOADING: "آپلود تصویر", ANALYZING_SPACE: "تحلیل فضا",
  SELECTING_PRODUCTS: "انتخاب محصولات", LAYING_OUT: "چیدمان هوشمند", RENDERING: "رندر نهایی",
};
const STAGE_ORDER: Stage[] = ["UPLOADING", "ANALYZING_SPACE", "SELECTING_PRODUCTS", "LAYING_OUT", "RENDERING"];

const STYLES = [
  { id: "modern", label: "مدرن", image: IMG.living2 }, { id: "classic", label: "کلاسیک", image: IMG.living9 },
  { id: "minimalist", label: "مینیمال", image: IMG.living7 }, { id: "luxury", label: "لوکس", image: IMG.living5 },
  { id: "scandinavian", label: "اسکاندیناوی", image: IMG.bed9 }, { id: "industrial", label: "صنعتی", image: IMG.decor8 },
  { id: "bohemian", label: "بوهمی", image: IMG.living3 }, { id: "japanese", label: "ژاپنی", image: IMG.decor6 },
  { id: "office", label: "اداری", image: IMG.decor7 },
];

interface SubType { label: string; desc: string }
interface CategoryDef { slug: string; label: string; Icon: LucideIcon; subTypes: SubType[] }
const CATEGORIES: CategoryDef[] = [
  { slug: "furniture", label: "مبلمان", Icon: Sofa, subTypes: [
    { label: "مبل ال", desc: "کاناپه گوشه با نشیمن گسترده" }, { label: "مبل تدی", desc: "مبل راحتی پارچه‌ای" },
    { label: "مبل چسترفیلد", desc: "مبل کلاسیک باشکوه" }, { label: "مبل کلاسیک", desc: "چوبی منبت" },
    { label: "صندلی راحتی", desc: "تکی برای گوشه دنج" }, { label: "پاف", desc: "کاربردی برای نشستن" },
  ]},
  { slug: "dining", label: "میز ناهارخوری", Icon: ShoppingBag, subTypes: [
    { label: "۴ نفره", desc: "خانواده کوچک" }, { label: "۶ نفره", desc: "جمع خانوادگی" },
    { label: "۸ نفره", desc: "مهمانی" }, { label: "گرد", desc: "صمیمانه" },
  ]},
  { slug: "curtain", label: "پرده", Icon: Blinds, subTypes: [
    { label: "پانچی مدرن", desc: "چین‌های منظم" }, { label: "شید و زبرا", desc: "قابل تنظیم نور" },
    { label: "مخمل کلاسیک", desc: "سنگین و لوکس" }, { label: "تور و حریر", desc: "نور ملایم" },
  ]},
  { slug: "carpet", label: "فرش", Icon: Grid3x3, subTypes: [
    { label: "ماشینی مدرن", desc: "هندسی خنثی" }, { label: "دستبافت ایرانی", desc: "اصیل سنتی" },
    { label: "وینتیج", desc: "کنگنه‌نما" }, { label: "گلیم", desc: "بافت تخت طبیعی" },
  ]},
  { slug: "lighting", label: "نورپردازی", Icon: Lamp, subTypes: [
    { label: "آباژور ایستاده", desc: "گوشه فضا" }, { label: "آباژور رومیزی", desc: "کنار مبل" },
    { label: "لوستر سقفی", desc: "نقطه کانونی" }, { label: "دیوارکوب", desc: "نور ملایم" },
  ]},
  { slug: "tv-console", label: "میز TV", Icon: Tv, subTypes: [
    { label: "تلویزیون مدرن", desc: "کم‌جا" }, { label: "کنسول چوبی", desc: "راهرو" }, { label: "جلومبلی", desc: "جلوی کاناپه" },
  ]},
  { slug: "bookcase-shoe", label: "قفسه", Icon: BookOpen, subTypes: [
    { label: "جاکفشی", desc: "ورودی" }, { label: "کتابخانه", desc: "باز" }, { label: "شلف دیواری", desc: "فضای کم" },
  ]},
  { slug: "bedding", label: "تخت", Icon: BedDouble, subTypes: [
    { label: "لمسه‌دوزی", desc: "هدبورد منبت" }, { label: "مدرن", desc: "خطوط تمیز" }, { label: "چوبی", desc: "گرم" },
  ]},
  { slug: "plants", label: "گیاه", Icon: Flower2, subTypes: [
    { label: "آپارتمانی بزرگ", desc: "گوشه فضا" }, { label: "گلدان ایستاده", desc: "کف" }, { label: "تزئینی", desc: "روی میز" },
  ]},
  { slug: "art", label: "تابلو", Icon: ImageIcon, subTypes: [
    { label: "بوم انتزاعی", desc: "مدرن" }, { label: "ست چندتایی", desc: "هم‌خانواده" }, { label: "آینه", desc: "وسعت بصری" },
  ]},
  { slug: "accessories", label: "اکسسوری", Icon: Gem, subTypes: [
    { label: "شمع و شمعدان", desc: "دنجی" }, { label: "مجسمه", desc: "هنری" }, { label: "گلدان کریستال", desc: "لوکس" },
  ]},
  { slug: "office", label: "اداری", Icon: Briefcase, subTypes: [
    { label: "میز اداری", desc: "فضای کافی لپ‌تاپ" }, { label: "صندلی ارگونومیک", desc: "تکیه‌گاه کمری" },
    { label: "مبلمان اداری", desc: "حرفه‌ای" }, { label: "نظم‌دهنده", desc: "آرشیو" }, { label: "چراغ رومیزی", desc: "متمرکز" },
  ]},
  { slug: "second-hand", label: "دسته دوم", Icon: Recycle, subTypes: [
    { label: "مبلمان دسته دوم", desc: "کم‌استفاده با قیمت مناسب" }, { label: "فرش دسته دوم", desc: "قالیچه سالم" },
    { label: "نورپردازی دسته دوم", desc: "آباژور و لوستر" }, { label: "میز و صندلی دسته دوم", desc: "ناهارخوری" },
    { label: "دکور دسته دوم", desc: "گلدان و اکسسوری" },
  ]},
];

const CAT_PRODUCTS: Record<string, string[]> = {
  furniture: ["p1", "p2", "p33", "p38", "p3", "p5"], dining: ["p4", "p35"], curtain: ["p14"],
  carpet: ["p12", "p13"], lighting: ["p9", "p10", "p34", "p31", "p37", "p11"], "tv-console": ["p3", "p39", "p30"],
  "bookcase-shoe": ["p30", "p39"], bedding: ["p19", "p21", "p20"], plants: ["p6", "p28"],
  art: ["p8", "p7", "p25"], accessories: ["p26", "p25", "p9"], office: ["p23", "p24", "p9"],
};
const SECOND_HAND_AS_PRODUCTS: Record<string, Product[]> = (() => {
  const map: Record<string, Product[]> = {};
  secondHandProducts.forEach((sh) => {
    const pseudo: Product = { id: sh.id, slug: sh.slug, name: sh.title + " (دسته دوم)", brand: sh.sellerName, storeId: "sh", categorySlug: sh.category, styleSlugs: [], price: sh.price, oldPrice: sh.originalPrice, currency: "تومان", rating: 4, reviewsCount: 0, images: [sh.image], colors: [], materials: [], description: sh.description, specs: [], inStock: true, stockCount: 1, purchaseCount: 0, tags: ["دسته دوم"] };
    (map[sh.category] ??= []).push(pseudo);
  });
  const subMap: Record<string, Product[]> = {};
  map.furniture?.forEach((p) => { (subMap["مبلمان دسته دوم"] ??= []).push(p); (subMap["میز و صندلی دسته دوم"] ??= []).push(p); });
  map.rugs?.forEach((p) => { (subMap["فرش دسته دوم"] ??= []).push(p); });
  map.lighting?.forEach((p) => { (subMap["نورپردازی دسته دوم"] ??= []).push(p); });
  map.decor?.forEach((p) => { (subMap["دکور دسته دوم"] ??= []).push(p); });
  return subMap;
})();
const DEFAULT_ROOM_IDS = ["p1", "p3", "p9", "p12", "p15", "p6"];

/** Parse dimension strings like "220x80x90" or "W:220 D:90 H:80" to numeric cm. */
function parseProductDimensions(raw?: string): { width?: number; height?: number; depth?: number } | undefined {
  if (!raw) return undefined;
  const nums = (raw.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter((n) => n > 0 && n < 1000);
  if (nums.length < 2) return undefined;
  // Heuristic: for furniture the order is usually W x H x D or W x D x H.
  const [w, d, h] = nums;
  return { width: w, height: nums.length >= 3 ? h : d, depth: nums.length >= 3 ? d : undefined };
}

/** Map real selected products back to RoomElement vocabulary for pipeline targeting. */
function deriveTargetsFromProducts(productsArr: Product[]): RoomElement[] {
  const out = new Set<RoomElement>();
  for (const p of productsArr) {
    const cat = (p.categorySlug ?? "").toLowerCase();
    const name = p.name.toLowerCase();
    if (/furniture|sofa|مبل|کاناپه/.test(cat + name)) out.add("sofa");
    if (/rug|carpet|فرش|قالی/.test(cat + name)) out.add("rug");
    if (/curtain|textile|پرده/.test(cat + name)) out.add("curtain");
    if (/light|lamp|lighting|چراغ|لوستر|آباژور/.test(cat + name)) out.add("lighting");
    if (/bed|تخت/.test(cat + name)) out.add("bed");
    if (/tv|تلویزیون/.test(cat + name)) out.add("tv");
    if (/plant|گل/.test(cat + name)) out.add("plant");
    if (/art|decor|تابلو|آینه/.test(cat + name)) out.add("art");
    if (/shelf|bookcase|قفسه|شلف/.test(cat + name)) out.add("shelf");
    if (/table|chair|dining|office|میز|صندلی/.test(cat + name)) out.add("table");
  }
  return [...out];
}

/** Translate the pipeline placement plan into ProductOverlay Placement[] coords (0..1). */
function buildPlacementsFromPlan(productsArr: Product[], plan: ProductPlacementPlan): Placement[] {
  // If there's a single product match by productId, use it; otherwise apply to first.
  const target = productsArr.find((p) => p.id === plan.productId) ?? productsArr[0];
  const rest = productsArr.filter((p) => p.id !== target.id);
  const placements: Placement[] = [];
  // Anchor point: center of the target region.
  const cx = plan.targetRegion.x + plan.targetRegion.width / 2;
  const cy = plan.targetRegion.y + plan.targetRegion.height / 2;
  placements.push({
    product: target,
    xNorm: Math.min(0.95, Math.max(0.05, cx)),
    yNorm: Math.min(0.95, Math.max(0.05, cy)),
    scale: Math.min(2, Math.max(0.3, plan.scale)),
    rotation: plan.rotation,
  });
  // Lay out any extra products deterministically around the main placement.
  rest.forEach((p, idx) => {
    const angle = ((idx + 1) * Math.PI * 2) / Math.max(1, rest.length);
    const r = 0.22;
    placements.push({
      product: p,
      xNorm: Math.min(0.95, Math.max(0.05, cx + Math.cos(angle) * r)),
      yNorm: Math.min(0.95, Math.max(0.05, cy + Math.sin(angle) * r)),
      scale: 0.85,
      rotation: 0,
    });
  });
  return placements;
}

/** Persian summary string surfaced in the existing scope card — UI shape unchanged. */
function buildScopeSummary(
  res: PipelineResult,
  fallback: { targets: RoomElement[]; summary: string; lockedElements: RoomElement[] },
): string {
  const targets = res.instruction.targets.length ? res.instruction.targets : fallback.targets;
  if (res.scope === "whole_home") return "بازطراحی کل خانه — همه چیز قابل تغییر است";
  if (res.scope === "room") return "بازطراحی کل اتاق";
  if (res.scope === "area") return `ناحیه ${targets.join("، ")} تغییر می‌کند`;
  return fallback.summary;
}

function DesignInner() {
  const sp = useSearchParams();
  const presetSlug = sp.get("product");
  const [tab, setTab] = useState<"design" | "inspiration" | "suggest">(sp.get("tab") === "inspiration" ? "inspiration" : "design");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [presetProduct, setPresetProduct] = useState<Product | null>(null);
  const [style, setStyle] = useState("modern");
  const [prompt, setPrompt] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState<Stage>("UPLOADING");
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [openCats, setOpenCats] = useState<Set<string>>(new Set(["furniture"]));
  const [selectedSubTypes, setSelectedSubTypes] = useState<Record<string, string[]>>({});
  const [selected, setSelected] = useState<Record<string, Product>>({});
  const [inspirationMatches, setInspirationMatches] = useState<Product[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const addToCart = useCart((s) => s.add);
  const wl = useWishlist();
  const { toast } = useUi();
  const cost = costForMode("room-redesign");
  const styleLabel = STYLES.find((s) => s.id === style)?.label ?? style;

  const rs = useRoomState();
  const [lastIntent, setLastIntent] = useState<AiIntent | null>(null);
  const [lastScope, setLastScope] = useState<ScopedChange | null>(null);
  const [roomAnalysis, setRoomAnalysis] = useState<RoomAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [productCode, setProductCode] = useState("");
  const [sessionProduct, setSessionProduct] = useState<{ id: string; sku?: string; target?: RoomElement } | null>(null);
  const [matchedStoreProducts, setMatchedStoreProducts] = useState<StoreProductMatch[]>([]);
  const [generatedPreview, setGeneratedPreview] = useState<string | null>(null);

  const analyzeRoom = async (image: string) => {
    setAnalyzing(true); setRoomAnalysis(null);
    try {
      const analysis = await aiService.analyze({ mode: "room-redesign", prompt: "تحلیل", referenceImage: image, room: style === "office" ? "فضای اداری" : "پذیرایی", style });
      setRoomAnalysis(analysis);
      rs.setRoomMeta({ detectedStyle: analysis.style, detectedColors: analysis.palette, roomType: analysis.roomType });
    } catch {}
    finally { setAnalyzing(false); }
  };

  const toggleCat = (slug: string) => setOpenCats((s) => { const n = new Set(s); n.has(slug) ? n.delete(slug) : n.add(slug); return n; });
  const toggleSubType = (slug: string, label: string) => setSelectedSubTypes((s) => { const cur = s[slug] || []; return { ...s, [slug]: cur.includes(label) ? cur.filter((x) => x !== label) : [...cur, label] }; });
  const toggleProduct = (p: Product) => setSelected((s) => { const n = { ...s }; if (n[p.id]) delete n[p.id]; else n[p.id] = p; return n; });
  const selectStyle = (id: string) => { setStyle(id); if (id === "office") setOpenCats((s) => new Set(s).add("office")); };

  // ---- GUIDED DESIGN: apply or customize AI suggestions ----
  const applySuggestion = (sg: GuidedSuggestion) => {
    // Map suggestion category to a product category and auto-select it
    const catMap: Record<string, string> = { rug: "carpet", lighting: "lighting", plant: "plants", sofa: "furniture" };
    const catSlug = catMap[sg.category] || "furniture";
    setOpenCats((s) => new Set(s).add(catSlug));
    // Auto-select first subtype in that category
    const cat = CATEGORIES.find((c) => c.slug === catSlug);
    if (cat && cat.subTypes[0]) {
      setSelectedSubTypes((s) => ({ ...s, [catSlug]: [cat.subTypes[0].label] }));
    }
    setPrompt((p) => p ? `${p}\n${sg.title}` : sg.title);
    toast(`پیشنهاد «${sg.title}» اعمال شد — برای ادامه طراحی بزن`);
  };

  const customizeSuggestion = (sg: GuidedSuggestion) => {
    setPrompt(sg.desc);
    toast("توضیحات پیشنهاد در فیلد دستور قرار گرفت — می‌تونی ویرایش کنی");
  };

  useEffect(() => {
    if (presetSlug) { const p = products.find((x) => x.slug === presetSlug); if (p) { setPresetProduct(p); setSelected((s) => ({ ...s, [p.id]: p })); setTab("inspiration"); } } // eslint-disable-line react-hooks/set-state-in-effect
  }, [presetSlug]);

  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
  const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

  const handleFile = (file: File, set: (v: string) => void = setImageBase64) => {
    if (!ALLOWED_TYPES.includes(file.type)) return toast("فقط JPG، PNG یا WEBP", "error");
    if (file.size > MAX_FILE_SIZE) return toast("حداکثر حجم تصویر ۱۰ مگابایت", "error");
    const r = new FileReader();
    r.onerror = () => toast("خطا در خواندن فایل", "error");
    r.onload = () => { const d = r.result as string; if (typeof d !== "string" || d.length < 100) return toast("فایل نامعتبر", "error"); set(d); if (set === setImageBase64) { rs.loadRoom(d, style === "office" ? "فضای اداری" : "پذیرایی"); analyzeRoom(d); } };
    r.readAsDataURL(file); trackEvent("room_uploaded", { metadata: { name: file.name, size: file.size } });
  };

  const progressSteps = STAGE_ORDER.map((s) => { const idx = STAGE_ORDER.indexOf(stage); const sIdx = STAGE_ORDER.indexOf(s); return { key: s, label: STAGE_LABEL[s], done: sIdx < idx, active: sIdx === idx }; });
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

  function makePlacements(prods: Product[]): Placement[] {
    const n = prods.length; if (!n) return [];
    return prods.map((p, i) => { const cols = Math.min(n, 3); const col = i % cols; const row = Math.floor(i / cols); const rows = Math.ceil(n / cols); const x = cols === 1 ? 0.5 : 0.22 + (0.56 * col) / (cols - 1); const y = rows === 1 ? 0.62 : 0.42 + (0.4 * row) / Math.max(1, rows - 1); return { product: p, xNorm: x, yNorm: y, scale: 1 }; });
  }

  const generate = async () => {
    const uiTargets = mapUiSelectionToTargets({
      slugs: designElements.map((e) => e.catSlug),
      labels: designElements.map((e) => e.label),
    });
    const selectedExact = Object.values(selected);
    const code = productCode.trim();
    const catalog = products.map((p) => toMatchableProduct(p, PRODUCT_SKUS[p.id]));
    const extraCodes = offers.map((o) => ({ sku: o.sellerSku, productId: o.productId }));

    let resolvedProduct: Product | undefined;
    if (code) {
      const resolution = resolveProductCode(code, catalog, { selectedTargets: uiTargets, extraCodes });
      if (resolution.status === "not_found") {
        setError(INVALID_SKU_MESSAGE);
        return toast(INVALID_SKU_MESSAGE, "error");
      }
      if (resolution.status === "conflict") {
        setError(CATEGORY_SKU_CONFLICT_MESSAGE);
        return toast(CATEGORY_SKU_CONFLICT_MESSAGE, "error");
      }
      if (resolution.product) {
        const found = getProductById(resolution.product.id);
        if (found) resolvedProduct = { ...found, sku: resolution.product.sku ?? PRODUCT_SKUS[found.id] };
      }
    }

    const hasIntent = Boolean(
      imageBase64 || uiTargets.length || resolvedProduct || presetProduct || selectedExact.length || prompt.trim(),
    );
    if (!hasIntent) {
      return toast("یک دسته، محصول یا کد کالا انتخاب کنید", "error");
    }

    const chosen: Product[] = [
      ...(resolvedProduct ? [resolvedProduct] : []),
      ...placedProducts.filter((p) => p.id !== resolvedProduct?.id),
      ...(presetProduct && !placedProducts.some((p) => p.id === presetProduct.id) && presetProduct.id !== resolvedProduct?.id ? [presetProduct] : []),
    ];

    const hasItemIntent = uiTargets.length > 0 || !!resolvedProduct || !!presetProduct || selectedExact.length > 0;
    const uiIntent = detectIntent(prompt, style);
    const uiScope = computeChangeScope(uiIntent);
    const isFullRoom = uiIntent.type === "full_redesign" || (!hasItemIntent && !prompt.trim() && !!imageBase64);
    const opCost = costOf(isFullRoom ? "generate" : (presetProduct || resolvedProduct ? "placement" : "edit"));

    const lastTargets: RoomElement[] = (rs.placements ?? [])
      .slice(-1)
      .flatMap((p): RoomElement[] => {
        // Map previously placed product categories back to room elements.
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

    const previousTargets: RoomElement[] = sessionProduct?.target
      ? [sessionProduct.target]
      : (lastTargets.length ? lastTargets : uiScope.targets);
    const previousChanges: string[] = rs.appliedChanges.slice(-3);

    // Convert real selected products to PlacementProduct for the pipeline.
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

    const derivedTargets: RoomElement[] = deriveTargetsFromProducts(chosen);
    const resolvedTarget = resolvedProduct ? categoryToTarget(resolvedProduct) : undefined;
    const targets: RoomElement[] = [...new Set([
      ...uiTargets,
      ...uiScope.targets,
      ...derivedTargets,
      ...(resolvedTarget ? [resolvedTarget] : []),
    ])];

    const pipelineInput: PipelineInput = {
      prompt: prompt.trim(),
      style,
      room: style === "office" ? "فضای اداری" : (rs.roomType || "نشیمن"),
      colors: roomAnalysis?.palette ?? rs.detectedColors ?? undefined,
      scope: isFullRoom ? "full" : "targeted",
      targets: targets.length ? targets : undefined,
      preservedExtra: undefined,
      referenceImage: imageBase64 ?? undefined,
      mask: undefined,
      previousTargets: previousTargets.length ? previousTargets : undefined,
      previousChanges: previousChanges.length ? previousChanges : undefined,
      productId: resolvedProduct?.id ?? presetProduct?.id ?? (chosen.length === 1 ? chosen[0].id : undefined),
      products: pipelineProducts.length ? pipelineProducts.map((p) => ({ ...p, sku: p.sku ?? PRODUCT_SKUS[p.id] })) : undefined,
      sku: resolvedProduct?.sku ?? (code || undefined),
      productCode: code || undefined,
      selectedProduct: resolvedProduct
        ? { id: resolvedProduct.id, sku: resolvedProduct.sku ?? PRODUCT_SKUS[resolvedProduct.id], name: resolvedProduct.name, category: resolvedProduct.categorySlug, storeId: resolvedProduct.storeId, image: resolvedProduct.images[0] }
        : presetProduct
          ? { id: presetProduct.id, sku: PRODUCT_SKUS[presetProduct.id], name: presetProduct.name, category: presetProduct.categorySlug, storeId: presetProduct.storeId, image: presetProduct.images[0] }
          : undefined,
      previousProductId: sessionProduct?.id,
      previousSku: sessionProduct?.sku,
      budget: budgetNum ? { min: budgetNum, currency: "تومان" } : undefined,
      roomUnderstanding: roomAnalysis
        ? {
            roomType: roomAnalysis.roomType,
            layout: "unknown",
            lighting: "unknown",
            objects: [],
            furnitureTypes: roomAnalysis.furnitureTypes,
            emptySpaces: roomAnalysis.emptySpaces,
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

    // Animated progress only — each stage label is the same one the UI already uses.
    const stageTimer = setInterval(() => {
      setStage((cur) => {
        const i = STAGE_ORDER.indexOf(cur);
        if (i < STAGE_ORDER.length - 1) return STAGE_ORDER[i + 1];
        return cur;
      });
    }, 900);

    const opLabel = isFullRoom ? "طراحی کامل" : (presetProduct ? "جای‌گذاری محصول" : "چیدمان وسایل");

    const result = await useCredits.getState().runAiOperation(opLabel, opCost, async () => {
      // THE SINGLE REAL AI CALL — no aiService.generate(), no fake setTimeout.
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

      // Render placements from the REAL pipeline placement plan when available,
      // otherwise fall back to the deterministic client layout (same visual grid).
      const renderedPlacements = plan && chosen.length >= 1
        ? buildPlacementsFromPlan(chosen, plan)
        : makePlacements(chosen);
      setPlacements(renderedPlacements);

      // Use the real edited image (Orali/provider) when the pipeline produced one,
      // otherwise keep the original and let the UI show the preview badge.
      const editedImage = pipelineRes.result.afterImage;
      const isPreview = !!pipelineRes.result.preview || (!!imageBase64 && editedImage === imageBase64);
      const outputImage = isPreview ? (imageBase64 ?? editedImage) : editedImage;

      rs.commitChange({
        label: isFullRoom ? "چیدمان کامل" : (inst.targets.map((t) => t).join("، ") || uiScope.targets.join("، ")),
        image: outputImage ?? undefined,
        placements: renderedPlacements.map((pl, idx) => ({
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

      setMatchedStoreProducts(pipelineRes.matchedProducts ?? []);
      setGeneratedPreview(outputImage ?? editedImage ?? null);
      const keptId = resolvedProduct?.id ?? pipelineRes.selectedProduct?.id;
      if (keptId) {
        const kept = resolvedProduct ?? getProductById(keptId);
        setSessionProduct({
          id: keptId,
          sku: kept?.sku ?? pipelineRes.selectedProduct?.sku ?? resolvedProduct?.sku,
          target: (kept ? categoryToTarget(kept) : undefined) ?? resolvedTarget,
        });
      }

      setStage("RENDERING");
      trackEvent("ai_finished", {
        metadata: {
          count: chosen.length,
          preview: isPreview,
          engine: pipelineRes.imageEngine,
          requestId: pipelineRes.requestId,
        },
      });

      if (isPreview) {
        toast("نتیجه به‌صورت پیش‌نمایش آماده شد (موتور تصویر در دسترس نیست)");
      } else {
        toast("چیدمان آماده شد");
      }
    } catch (e) {
      setError("خطا در نمایش نتیجه");
    } finally {
      setLoading(false);
    }
  };

  const router = useRouter();
  const updatePlacement = (id: string, patch: Partial<Placement>) => setPlacements((ps) => ps.map((pl) => (pl.product.id === id ? { ...pl, ...patch } : pl)));
  const removePlacement = (id: string) => setPlacements((ps) => ps.filter((pl) => pl.product.id !== id));
  const overlayCart = (p: Product) => { addToCart(p.id); toast("به سبد اضافه شد"); };
  const overlayWishlist = (p: Product) => { wl.toggleProduct(p.id); toast("به علاقه‌مندی اضافه شد"); };
  const overlayView = (p: Product) => router.push(`/products/${p.slug}`);

  const placePresetInRoom = async () => {
    if (!imageBase64) return toast("عکس خانه را آپلود کن", "error");
    if (!presetProduct) return;

    // Real product-in-room pipeline — no fake setTimeout, no fake success.
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

      toast(isPreview ? "محصول به‌صورت پیش‌نمایش قرار گرفت (موتور تصویر در دسترس نیست)" : "محصول در عکس قرار گرفت");
    } catch {
      setError("خطا در نمایش نتیجه");
    } finally {
      setLoading(false);
    }
  };
  const buyTheLook = () => { if (!placedProducts.length) return; placedProducts.forEach((p) => addToCart(p.id)); toast("چیدمان به سبد اضافه شد"); };
  const handleSaveToWishlist = () => { placedProducts.forEach((p) => wl.toggleProduct(p.id)); toast("طراحی ذخیره شد"); };

  // ---- shared styling ----
  const panelCls = "rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)]";
  const stepBadge = "grid h-5 w-5 place-items-center rounded-md bg-ink text-[10px] font-bold text-cream";

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

        {tab === "inspiration" && (
          <div className="rounded-2xl border border-clay/50 bg-cream p-5">
            <h3 className="mb-3 text-sm font-bold text-ink">اسکن بصری</h3>
            <p className="mb-4 text-xs leading-6 text-ink-muted">{presetProduct ? "محصول انتخاب‌شده را در عکس خانه‌ات قرار بده." : "عکس مدلی که دوست داری را آپلود کن تا محصولات مشابه پیدا کنیم."}</p>
            {presetProduct ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-clay/40 bg-ivory-2 p-3">
                  <div className="mb-1.5 text-[10px] font-bold text-terracotta-deep">محصول انتخاب‌شده</div>
                  <div className="flex items-center gap-2.5"><img src={presetProduct.images[0]} alt="" className="h-16 w-16 rounded-lg object-cover" /><div><p className="text-xs font-bold text-ink">{presetProduct.name}</p><p className="text-[10px] text-ink-muted">{presetProduct.brand}</p></div></div>
                  <button onClick={() => setPresetProduct(null)} className="mt-2 text-[10px] text-ink-muted hover:text-danger">حذف</button>
                </div>
                <div>
                  {!imageBase64 ? (
                    <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className="flex aspect-video cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 text-center transition hover:border-terracotta">
                      <Upload size={24} className="mb-1.5 text-ink-muted" /><p className="text-xs font-medium text-ink">آپلود عکس خانه</p>
                    </div>
                  ) : (<><div className="overflow-hidden rounded-xl border border-clay/40"><img src={imageBase64} alt="" className="aspect-video w-full object-cover" /></div><button onClick={placePresetInRoom} disabled={loading} className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2.5 text-xs font-bold text-cream transition hover:bg-terracotta-deep disabled:opacity-40"><Wand2 size={14} /> جای‌گذاری در خانه</button></>)}
                  <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                </div>
              </div>
            ) : !imageBase64 ? (
              <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className="mx-auto flex max-w-md cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 p-8 text-center transition hover:border-terracotta">
                <Upload size={26} className="mb-2 text-ink-muted" /><p className="text-xs font-medium text-ink">عکس مدل را آپلود کن</p><p className="mt-0.5 text-[10px] text-ink-muted">JPG, PNG</p>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="overflow-hidden rounded-xl border border-clay/40"><img src={imageBase64} alt="" className="aspect-video w-full object-cover" /></div>
                <div>
                  <button onClick={() => { setInspirationMatches([...products].sort(() => Math.random() - 0.5).slice(0, 6)); toast("محصولات مشابه پیدا شد"); }} className="mb-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-ink py-2.5 text-xs font-bold text-cream"><Sparkles size={14} /> پیدا کردن مشابه</button>
                  {inspirationMatches.length > 0 && (<><div className="grid grid-cols-3 gap-2">{inspirationMatches.map((p) => { const isSel = !!selected[p.id]; return (
                    <button key={p.id} onClick={() => toggleProduct(p)} className={cn("overflow-hidden rounded-lg border text-right transition", isSel ? "border-terracotta ring-1 ring-terracotta/40" : "border-clay/50 hover:border-terracotta/50")}>
                      <div className="relative aspect-square"><img src={p.images[0]} alt="" className="h-full w-full object-cover" />{isSel && <span className="absolute right-1 top-1 grid h-4 w-4 place-items-center rounded-full bg-terracotta text-[8px] text-white">✓</span>}</div>
                      <div className="p-1"><p className="line-clamp-1 text-[9px] font-bold text-ink">{p.name}</p><p className="text-[9px] font-bold text-terracotta-deep">{toFa(formatPrice(p.price))}</p></div>
                    </button>); })}</div>
                    <button onClick={() => { setTab("design"); toast("به محیط چیدمان منتقل شد"); }} className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-clay/50 bg-ivory-2 py-2 text-xs font-bold text-ink hover:bg-clay/20">انتقال به چیدمان ←</button>
                  </>)}
                </div>
              </div>
            )}
            <button onClick={() => setTab("design")} className="mt-3 text-[11px] text-ink-muted hover:text-ink">← بازگشت</button>
          </div>
        )}

        {tab === "design" && (
          <>
          {/* JOURNEY BAR — visual progress (reduces cognitive load) */}
          <div className="mb-4 flex items-center gap-1 text-[10px]">
            {(() => {
              let step = 1;
              if (imageBase64) step = 2;
              if (analyzing || roomAnalysis) step = 3;
              if (designElements.length > 0) step = 4;
              if (placements.length > 0) step = 5;
              const labels = ["آپلود", "تحلیل", "انتخاب", "تولید", "خرید"];
              return labels.map((label, i) => {
                const num = i + 1;
                const active = num <= step;
                const current = num === step;
                return (
                  <div key={label} className="flex flex-1 items-center gap-1">
                    <div className={cn("flex items-center gap-1 rounded-full px-2 py-1 transition", active ? "bg-terracotta/15 text-terracotta-deep" : "text-ink-muted/50", current && "ring-1 ring-terracotta/40")}>
                      <span className={cn("grid h-4 w-4 place-items-center rounded-full text-[8px] font-bold", active ? "bg-terracotta text-white" : "bg-clay/40 text-ink-muted")}>{toFa(num)}</span>
                      {label}
                    </div>
                    {i < labels.length - 1 && <div className={cn("h-px flex-1", active ? "bg-terracotta/30" : "bg-clay/30")} />}
                  </div>
                );
              });
            })()}
          </div>

          <div className="grid items-start gap-4 lg:grid-cols-12">
            {/* LEFT: Controls */}
            <div className="space-y-3 lg:col-span-5">
              {/* Upload */}
              <div className={panelCls}>
                <div className="mb-2 flex items-center justify-between border-b border-clay/30 pb-2">
                  <h2 className="flex items-center gap-1.5 text-xs font-bold text-ink"><span className={stepBadge}>۱</span> تصویر اتاق</h2>
                  {imageBase64 && <button onClick={() => { setImageBase64(null); setPlacements([]); }} className="text-[10px] text-danger hover:underline">حذف</button>}
                </div>
                {!imageBase64 ? (
                  <div onClick={() => inputRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }} className="flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed border-clay/60 bg-ivory-2 py-6 text-center transition hover:border-terracotta">
                    <Upload size={20} className="mb-1.5 text-ink-muted" /><p className="text-[11px] font-medium text-ink">عکس اتاقت را آپلود کن</p>
                    <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  </div>
                ) : <div className="overflow-hidden rounded-lg border border-clay/40"><img src={imageBase64} alt="اتاق" className="aspect-video w-full object-cover" /></div>}
              </div>

              {/* GUIDED DESIGN ASSISTANT — AI analysis + actionable suggestions */}
              {(analyzing || roomAnalysis) && imageBase64 && (
                <div className="rounded-xl border border-gold/25 bg-gold/5 p-3">
                  <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-gold"><Sparkles size={12} /> تحلیل هوشمند فضا</h3>
                  {analyzing ? (
                    <div className="flex items-center gap-1.5 py-1 text-[10px] text-ink-muted"><Loader2 size={12} className="animate-spin text-gold" /> در حال تحلیل فضا، نور و سبک…</div>
                  ) : roomAnalysis && (
                    <div className="space-y-2.5">
                      {/* tags */}
                      <div className="flex flex-wrap gap-1.5">{[roomAnalysis.roomType, roomAnalysis.style, roomAnalysis.mood].map((t) => <span key={t} className="rounded-md bg-cream px-2 py-0.5 text-[10px] font-medium text-ink">{t}</span>)}</div>
                      {/* palette */}
                      <div className="flex items-center gap-1">{roomAnalysis.palette.map((hex) => <span key={hex} className="h-4 w-4 rounded border border-clay/40" style={{ background: hex }} />)}</div>
                      {/* strengths */}
                      {roomAnalysis.strengths?.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-success">نقاط قوت:</span>
                          {roomAnalysis.strengths.map((s, i) => <div key={i} className="flex gap-1 text-[10px] leading-5 text-ink"><Check size={10} className="mt-0.5 shrink-0 text-success" /> {s}</div>)}
                        </div>
                      )}
                      {/* opportunities */}
                      {roomAnalysis.opportunities?.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="text-[9px] font-bold text-terracotta-deep">فرصت‌های بهبود:</span>
                          {roomAnalysis.opportunities.map((s, i) => <div key={i} className="flex gap-1 text-[10px] leading-5 text-ink-muted"><Lightbulb size={10} className="mt-0.5 shrink-0 text-gold" /> {s}</div>)}
                        </div>
                      )}
                      {/* GUIDED SUGGESTIONS — actionable cards */}
                      {roomAnalysis.guidedSuggestions?.length > 0 && (
                        <div className="space-y-2 pt-1">
                          <span className="text-[9px] font-bold text-ink">پیشنهادهای هوشمند:</span>
                          {roomAnalysis.guidedSuggestions.map((sg) => {
                            const impactColor = sg.impact === "high" ? "text-danger" : sg.impact === "medium" ? "text-gold" : "text-ink-muted";
                            const impactLabel = sg.impact === "high" ? "تأثیر بالا" : sg.impact === "medium" ? "تأثیر متوسط" : "تأثیر کم";
                            return (
                              <div key={sg.id} className="rounded-lg border border-clay/40 bg-cream p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-[11px] font-bold text-ink">{sg.title}</p>
                                    <p className="text-[10px] leading-5 text-ink-muted">{sg.desc}</p>
                                  </div>
                                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                                    <span className={cn("text-[8px] font-bold", impactColor)}>{impactLabel}</span>
                                    <span className="text-[8px] text-gold">{toFa(sg.creditCost)} اعتبار</span>
                                  </div>
                                </div>
                                <div className="mt-2 flex gap-1.5">
                                  <button onClick={() => applySuggestion(sg)} className="flex-1 rounded-md bg-terracotta py-1.5 text-[9px] font-bold text-white transition hover:bg-terracotta-deep">اعمال پیشنهاد</button>
                                  <button onClick={() => customizeSuggestion(sg)} className="rounded-md border border-clay/50 bg-ivory-2 px-2 py-1.5 text-[9px] font-medium text-ink-muted hover:text-ink">سفارشی</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Style */}
              <div className={panelCls}>
                <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><span className={stepBadge}>۲</span> سبک</h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {STYLES.map((s) => (
                    <button key={s.id} onClick={() => selectStyle(s.id)} className={cn("overflow-hidden rounded-lg border text-center transition", style === s.id ? "border-terracotta ring-1 ring-terracotta/40" : "border-clay/40 hover:border-terracotta/50")}>
                      <div className="relative aspect-square"><img src={s.image} alt={s.label} className="h-full w-full object-cover" />{style === s.id && <span className="absolute inset-0 grid place-items-center bg-terracotta/20"><Check size={14} className="text-white" /></span>}</div>
                      <p className="bg-ivory-2 py-0.5 text-[9px] font-bold text-ink">{s.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Items */}
              <div className={panelCls}>
                <h2 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-xs font-bold text-ink"><span className={stepBadge}>۳</span> انتخاب وسایل</h2>
                <div className="grid grid-cols-3 gap-1.5">
                  {CATEGORIES.map((c) => { const open = openCats.has(c.slug); const selCount = (selectedSubTypes[c.slug] || []).length; return (
                    <button key={c.slug} onClick={() => toggleCat(c.slug)} className={cn("flex items-center gap-1 rounded-lg border p-1.5 text-[10px] font-bold transition", open ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/40 bg-ivory-2 text-ink-muted hover:border-terracotta/50")}>
                      <c.Icon size={12} /> <span className="line-clamp-1">{c.label}</span>{selCount > 0 && <span className="rounded-full bg-terracotta px-1 text-[8px] text-white">{toFa(selCount)}</span>}
                    </button>
                  ); })}
                </div>
                {[...openCats].map((slug) => { const cat = CATEGORIES.find((c) => c.slug === slug); if (!cat) return null; const sel = selectedSubTypes[slug] || []; return (
                  <div key={slug} className="mt-2.5 rounded-xl border border-clay/40 bg-ivory-2 p-2.5">
                    <div className="mb-1.5 flex items-center justify-between text-[10px]"><span className="flex items-center gap-1 font-bold text-terracotta-deep"><cat.Icon size={11} /> {cat.label}</span>{sel.length > 0 && <button onClick={() => setSelectedSubTypes((s) => ({ ...s, [slug]: [] }))} className="text-ink-muted hover:text-danger">پاک</button>}</div>
                    <div className="flex flex-wrap gap-1">{cat.subTypes.map((st) => { const on = sel.includes(st.label); return (<button key={st.label} onClick={() => toggleSubType(slug, st.label)} className={cn("rounded-md border px-1.5 py-0.5 text-[9px] font-bold transition", on ? "border-terracotta bg-terracotta text-white" : "border-clay/50 bg-cream text-ink-muted hover:border-terracotta/50")}>{st.label}</button>); })}</div>
                    {sel.length > 0 && <div className="mt-1.5 space-y-0.5 rounded-lg bg-cream p-2">{sel.map((label) => { const st = cat.subTypes.find((x) => x.label === label); return <div key={label} className="flex gap-1 text-[9px] leading-4 text-ink-muted"><Lightbulb size={9} className="mt-0.5 shrink-0 text-gold" /> <b className="text-ink">{label}:</b> {st?.desc}</div>; })}</div>}
                  </div>
                ); })}
              </div>

              {/* Budget + Prompt */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl border border-clay/50 bg-cream p-3"><span className="mb-1 block text-[10px] font-bold text-ink-muted">بودجه</span><input type="text" inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^\d]/g, ""))} placeholder="تومان" dir="ltr" className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-terracotta" /></div>
                <div className="rounded-xl border border-clay/50 bg-cream p-3"><span className="mb-1 block text-[10px] font-bold text-ink-muted">دستور به AI</span><input value={prompt} onChange={(e) => setPrompt(e.target.value)} placeholder="مثلاً نور گرم‌تر..." className="w-full rounded-lg border border-clay/50 bg-ivory-2 px-2 py-1.5 text-xs text-ink outline-none focus:border-terracotta" /></div>
              </div>

              {/* Generate */}
              <button onClick={generate} disabled={loading || !imageBase64} className="btn-accent flex w-full items-center justify-center gap-2 py-3 text-sm font-bold disabled:opacity-40"><Wand2 size={16} /> {designElements.length > 0 ? "ببین چطور تو خونه‌ات می‌شه" : "طراحی اتاق من"}</button>
              <div className="flex items-center justify-between rounded-lg border border-clay/40 bg-cream px-3 py-1.5 text-[10px] text-ink-muted"><span>هزینه</span><span className="font-bold text-gold">{toFa(cost)} اعتبار</span></div>

              {/* Loading */}
              {loading && (
                <div className="rounded-xl border border-clay/50 bg-cream p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs"><Loader2 size={14} className="animate-spin text-terracotta-deep" /><span className="font-medium text-ink">{STAGE_LABEL[stage]}</span></div>
                  <div className="space-y-1">{progressSteps.map((s, i) => (<div key={s.key} className="flex items-center gap-2"><div className="shrink-0">{s.done ? <Check size={12} className="text-success" /> : s.active ? <Loader2 size={12} className="animate-spin text-terracotta-deep" /> : <span className="block h-3 w-3 rounded-full border border-clay" />}</div><span className={cn("text-[10px]", s.done ? "text-success" : s.active ? "font-medium text-ink" : "text-ink-muted")}>{s.label}</span></div>))}</div>
                </div>
              )}
              {error && !loading && <div className="rounded-xl border border-danger/30 bg-danger/5 p-2.5 text-[11px] text-danger"><p className="font-bold">{error}</p><button onClick={generate} className="mt-0.5 font-bold text-terracotta-deep hover:underline">تلاش مجدد</button></div>}
            </div>

            {/* RIGHT: Output */}
            <div className="space-y-3 lg:col-span-7">
              <div className="rounded-2xl border border-clay/50 bg-cream p-4 shadow-[var(--shadow-soft)]">
                <div className="mb-3 flex items-center justify-between border-b border-clay/30 pb-2">
                  <h3 className="flex items-center gap-1.5 text-xs font-bold text-ink"><Wand2 size={14} className="text-terracotta-deep" /> خروجی چیدمان</h3>
                  {placements.length > 0 && <div className="flex gap-1"><button onClick={() => toast("ذخیره شد")} className="grid h-7 w-7 place-items-center rounded-md bg-ivory-2 text-ink-muted hover:text-ink" aria-label="دانلود"><Download size={12} /></button><button onClick={async () => { const res = await shareContent({ title: "طراحی هوشمند خانه من", text: "با Homeino طراحی کردم", url: buildShareUrl("/ai") }); toast(res.method === "clipboard" ? "لینک کپی شد" : res.method === "native" ? "اشتراک‌گذاری شد" : "خطا", res.method === "failed" ? "error" : "success"); }} className="grid h-9 w-9 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:text-ink" aria-label="اشتراک‌گذاری"><Share2 size={13} /></button></div>}
                </div>
                {placements.length > 0 && imageBase64 ? (
                  <ProductOverlay mode={rs.currentImage && rs.currentImage !== imageBase64 ? "real_edit" : "interactive"} roomImage={rs.currentImage ?? imageBase64} placements={placements} onChange={updatePlacement} onRemove={removePlacement} onCart={overlayCart} onWishlist={overlayWishlist} onView={overlayView} />
                ) : generatedPreview ? (
                  <div className="overflow-hidden rounded-xl border border-clay/40"><img src={generatedPreview} alt="" className="aspect-video w-full object-cover" /></div>
                ) : (
                  <div className="flex aspect-video items-center justify-center rounded-xl border border-dashed border-clay/50 bg-ivory-2"><div className="p-6 text-center"><Wand2 size={28} className="mx-auto mb-2 text-clay" /><p className="text-xs font-medium text-ink-muted">نتیجه اینجا نمایش داده می‌شه</p></div></div>
                )}
              </div>

              {matchedStoreProducts.length > 0 && !loading && (
                <div className="rounded-xl border border-clay/50 bg-cream p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-[11px] font-bold text-ink"><ShoppingBag size={13} className="text-terracotta-deep" /> محصولات پیشنهادی فروشگاه‌ها ({toFa(matchedStoreProducts.length)})</h3>
                  <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">{matchedStoreProducts.map((p) => (
                    <div key={`${p.productId}-${p.storeId ?? ""}-${p.sku ?? ""}`} className="flex items-center gap-2 rounded-lg border border-clay/30 bg-ivory-2 p-2">
                      {p.image && <img src={p.image} alt="" className="h-10 w-10 rounded-md object-cover" />}
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-1 text-[10px] font-bold text-ink">{p.name}</p>
                        {p.storeName && <p className="flex items-center gap-0.5 text-[9px] text-ink-muted"><Store size={9} /> {p.storeName}</p>}
                        {p.sku && <p className="text-[9px] text-ink-muted" dir="ltr">{p.sku}</p>}
                      </div>
                      {typeof p.price === "number" && <span className="text-[10px] font-black text-gold">{toFa(formatPrice(p.price))}</span>}
                    </div>
                  ))}</div>
                </div>
              )}

              {lastScope && !loading && (
                <div className="rounded-xl border border-gold/25 bg-gold/5 p-3">
                  <div className="flex items-center gap-1 text-[10px] font-bold text-gold"><Lightbulb size={12} /> محدوده تغییر</div>
                  <p className="mt-0.5 text-[10px] leading-5 text-ink-muted">{lastScope.summary}</p>
                  {lastScope.lockedElements.length > 0 && <div className="mt-1 flex flex-wrap gap-0.5">{lastScope.lockedElements.slice(0, 6).map((el) => <span key={el} className="flex items-center gap-0.5 rounded bg-ivory-2 px-1 py-0.5 text-[8px] text-ink-muted"><LockIcon size={8} /> {el}</span>)}</div>}
                </div>
              )}

              {rs.history.length > 1 && !loading && (
                <div className="flex items-center justify-between rounded-xl border border-clay/50 bg-cream px-3 py-2">
                  <div className="flex items-center gap-1">
                    <button onClick={() => { rs.undo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canUndo()} className="grid h-7 w-7 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="بازگشت"><Undo2 size={13} /></button>
                    <button onClick={() => { rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} disabled={!rs.canRedo()} className="grid h-7 w-7 place-items-center rounded-md bg-ivory-2 text-ink-muted transition hover:bg-clay/20 disabled:opacity-30" aria-label="جلو"><Redo2 size={13} /></button>
                    <span className="mr-1 text-[10px] text-ink-muted">{toFa(rs.historyIndex + 1)}/{toFa(rs.history.length)}</span>
                  </div>
                  <div className="flex gap-1">{rs.history.map((snap, idx) => <button key={snap.version} onClick={() => { const steps = idx - rs.historyIndex; if (steps < 0) for (let s = 0; s < -steps; s++) rs.undo(); else for (let s = 0; s < steps; s++) rs.redo(); setPlacements(rs.placements.map((p) => ({ product: getProductById(p.productId)!, xNorm: p.placement.x, yNorm: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })).filter(Boolean)); }} className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold transition", idx === rs.historyIndex ? "bg-ink text-cream" : "bg-ivory-2 text-ink-muted hover:text-ink")}>{snap.label}</button>)}</div>
                </div>
              )}

              {placements.length > 0 && rs.currentImage === rs.originalImage && (
                <div className="flex items-center justify-center gap-1 rounded-lg border border-gold/25 bg-gold/5 px-3 py-1.5 text-[10px] text-gold"><AlertCircle size={11} /> پیش‌نمایش — تصویر اصلی حفظ شده</div>
              )}

              {designElements.length > 0 && (
                <div className="rounded-xl border border-clay/50 bg-cream p-3">
                  <h3 className="mb-2 flex items-center gap-1 text-[11px] font-bold text-ink"><Sparkles size={12} className="text-terracotta-deep" /> عناصر انتخابی</h3>
                  <div className="flex flex-wrap gap-1">{designElements.map((e, i) => <span key={i} className="rounded-full border border-clay/40 bg-ivory-2 px-2 py-0.5 text-[9px] font-medium text-ink-muted">{e.cat} · {e.label}</span>)}</div>
                </div>
              )}

              {placedProducts.length > 0 && (
                <div className="rounded-xl border border-clay/50 bg-cream p-4">
                  <h3 className="mb-2 flex items-center gap-1.5 border-b border-clay/30 pb-2 text-[11px] font-bold text-ink"><ShoppingBag size={13} className="text-terracotta-deep" /> کالاهای چیدمان ({toFa(placedProducts.length)})</h3>
                  <div className="grid max-h-48 grid-cols-1 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-2">{placedProducts.map((p) => (<div key={p.id} className="flex items-center gap-2 rounded-lg border border-clay/30 bg-ivory-2 p-2"><img src={p.images[0]} alt="" className="h-10 w-10 rounded-md object-cover" /><div className="min-w-0 flex-1"><p className="line-clamp-1 text-[10px] font-bold text-ink">{p.name}</p><p className="flex items-center gap-0.5 text-[9px] text-ink-muted"><Store size={9} /> {p.brand}</p></div><span className="text-[10px] font-black text-gold">{toFa(formatPrice(p.price))}</span></div>))}</div>
                  <div className="mt-2 flex items-center justify-between border-t border-clay/30 pt-2"><span className="text-[11px] font-bold text-ink">جمع کل:</span><span className="text-sm font-black text-terracotta-deep">{toFa(formatPrice(total))} ت</span></div>
                  <div className="mt-2 space-y-2">
                    <button onClick={buyTheLook} className="btn-accent flex w-full items-center justify-center gap-1.5 py-3 text-xs font-bold"><CreditCard size={14} /> خرید این چیدمان ({toFa(placedProducts.length)} کالا)</button>
                    <button onClick={handleSaveToWishlist} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-clay/50 bg-ivory-2 py-2.5 text-[11px] font-bold text-ink transition hover:bg-clay/20"><Heart size={13} /> ذخیره در علاقه‌مندی</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          </>
        )}
        <div className="mt-6 text-center"><Link href="/ai/design" className="text-xs text-ink-muted hover:text-ink">← بازگشت به استودیو</Link></div>
      </Container>
    </div>
  );
}

export default function AIDesignPage() {
  return (<Suspense fallback={<div className="grid min-h-[70vh] place-items-center bg-ivory"><Loader2 className="animate-spin text-ink-muted" /></div>}><DesignInner /></Suspense>);
}

const ROOM_TYPES = [["living", "نشیمن"], ["bedroom", "خواب"], ["kitchen", "آشپزخانه"], ["bathroom", "حمام"], ["office", "کار"], ["dining", "ناهارخوری"], ["outdoor", "باز"]] as const;
const BUDGETS = [["low", "اقتصادی (تا ۱۰م)"], ["mid", "متوسط (۱۰-۵۰م)"], ["high", "بالا (۵۰-۱۰۰م)"], ["premium", "لوکس (۱۰۰م+)"]] as const;

function SuggestAssistant({ onApply, onBack }: { onApply: (p: { style: string; budget: string; roomType: string; colors: string[] }) => void; onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [roomType, setRoomType] = useState(""); const [style, setStyle] = useState(""); const [budget, setBudget] = useState("");
  const [colorInput, setColorInput] = useState(""); const [colors, setColors] = useState<string[]>([]);
  const addColor = () => { const c = colorInput.trim(); if (c && !colors.includes(c)) { setColors([...colors, c]); setColorInput(""); } };
  const panelCls = "rounded-2xl border border-clay/50 bg-cream p-5 shadow-[var(--shadow-soft)]";
  return (
    <div className={cn("mx-auto max-w-md space-y-4", panelCls)}>
      <div className="flex items-center justify-center gap-2">{[0, 1, 2].map((s) => <div key={s} className={cn("h-2 w-2 rounded-full transition-all", s === step ? "scale-125 bg-terracotta" : s < step ? "bg-terracotta" : "bg-clay")} />)}</div>
      {step === 0 && (<div className="space-y-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta/10"><Sparkles size={16} className="text-terracotta-deep" /></span><div><h3 className="text-sm font-bold text-ink">نوع فضا</h3></div></div><div className="grid grid-cols-3 gap-2">{ROOM_TYPES.map(([v, l]) => <button key={v} onClick={() => setRoomType(v)} className={cn("rounded-lg border p-2.5 text-xs font-medium transition", roomType === v ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/50 text-ink-muted hover:border-terracotta/40")}>{l}</button>)}</div><div className="flex gap-2 pt-1"><button onClick={onBack} className="px-3 py-1.5 text-[11px] text-ink-muted">بازگشت</button><button onClick={() => setStep(1)} disabled={!roomType} className="flex-1 rounded-lg bg-ink py-2 text-xs font-bold text-cream disabled:opacity-40">بعدی</button></div></div>)}
      {step === 1 && (<div className="space-y-4"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta/10"><Sparkles size={16} className="text-terracotta-deep" /></span><h3 className="text-sm font-bold text-ink">سبک و بودجه</h3></div><div><p className="mb-1.5 text-[11px] font-medium text-ink-muted">سبک</p><div className="flex flex-wrap gap-1.5">{STYLES.map((s) => <button key={s.id} onClick={() => setStyle(s.id)} className={cn("rounded-lg border px-3 py-1.5 text-[11px] font-medium transition", style === s.id ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/50 text-ink-muted hover:border-terracotta/40")}>{s.label}</button>)}</div></div><div><p className="mb-1.5 text-[11px] font-medium text-ink-muted">بودجه</p><div className="space-y-1.5">{BUDGETS.map(([v, l]) => <button key={v} onClick={() => setBudget(v)} className={cn("w-full rounded-lg border p-2.5 text-left text-xs transition", budget === v ? "border-terracotta bg-terracotta/10 text-terracotta-deep" : "border-clay/50 text-ink-muted hover:border-terracotta/40")}>{l}</button>)}</div></div><div className="flex gap-2 pt-1"><button onClick={() => setStep(0)} className="px-3 py-1.5 text-[11px] text-ink-muted">قبلی</button><button onClick={() => setStep(2)} disabled={!style || !budget} className="flex-1 rounded-lg bg-ink py-2 text-xs font-bold text-cream disabled:opacity-40">بعدی</button></div></div>)}
      {step === 2 && (<div className="space-y-3"><div className="flex items-center gap-2"><span className="grid h-8 w-8 place-items-center rounded-lg bg-terracotta/10"><Sparkles size={16} className="text-terracotta-deep" /></span><h3 className="text-sm font-bold text-ink">رنگ‌ها (اختیاری)</h3></div><div className="flex gap-2"><input value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }} placeholder="مثلاً طلایی..." className="flex-1 rounded-lg border border-clay/50 bg-ivory-2 px-3 py-2 text-xs text-ink outline-none focus:border-terracotta" /><button onClick={addColor} className="rounded-lg bg-terracotta/10 px-3 py-2 text-xs font-medium text-terracotta-deep">+</button></div>{colors.length > 0 && <div className="flex flex-wrap gap-1">{colors.map((c) => <span key={c} className="flex items-center gap-0.5 rounded-full bg-ivory-2 px-2 py-0.5 text-[10px] text-ink">{c}<button onClick={() => setColors(colors.filter((x) => x !== c))} className="hover:text-danger"><X size={9} /></button></span>)}</div>}<div className="rounded-lg bg-ivory-2 p-3"><p className="text-[10px] font-bold text-terracotta-deep">خلاصه</p><div className="mt-0.5 space-y-0.5 text-[10px] text-ink-muted"><p>فضا: {ROOM_TYPES.find((r) => r[0] === roomType)?.[1]}</p><p>سبک: {STYLES.find((s) => s.id === style)?.label}</p><p>بودجه: {BUDGETS.find((b) => b[0] === budget)?.[1]}</p>{colors.length > 0 && <p>رنگ‌ها: {colors.join("، ")}</p>}</div></div><div className="flex gap-2 pt-1"><button onClick={() => setStep(1)} className="px-3 py-1.5 text-[11px] text-ink-muted">قبلی</button><button onClick={() => onApply({ style, budget, roomType, colors })} className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ink py-2 text-xs font-bold text-cream transition hover:opacity-90"><Sparkles size={14} /> دریافت پیشنهاد</button></div></div>)}
    </div>
  );
}

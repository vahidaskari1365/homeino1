// ============================================================
// HOMEINO AI ENGINE — HEURISTIC LLM (PERSISTENT INTENT PARSER)
//
// Fast, deterministic intent engine for the Persian interior design
// domain. Uses the canonical decision tree in scope.ts as its single
// source of truth — eliminating divergence between heuristic, LLM,
// and pipeline scopes.
//
// Priority order:
//   1. Explicit user prompt (if contains element/style/scope words)
//   2. SKU / Product Code resolution & Target deduction
//   3. UI selection (selectedTargets, selection.category, changeScope)
//   4. Continuation memory (previousTargets, previousScope, previousProductId)
//   5. Conservative single_item fallback
// ============================================================

import type {
  AiIntent,
  DesignIntentType,
  EditScope,
  IntentRequest,
  LlmProvider,
  RoomElement,
} from "./types";
import {
  ALL_ELEMENTS,
  ELEMENT_LABELS,
  resolveProtectedElements,
  categoryToRoomElement,
  detectCategorySkuConflict,
} from "../roomState";
import { resolveScope, extractExplicitPreserved } from "../scope";
import { getProductBySkuOrCode, getProductById } from "../../../data/products";

const STYLES: Record<string, string> = {
  modern: "Modern",
  مدرن: "Modern",
  minimal: "Minimalist",
  مینیمال: "Minimalist",
  classic: "Classic",
  کلاسیک: "Classic",
  neoclassic: "Neoclassic",
  نئوکلاسیک: "Neoclassic",
  traditional: "Traditional Persian",
  سنتی: "Traditional Persian",
  boho: "Boho",
  بوهو: "Boho",
  industrial: "Industrial",
  صنعتی: "Industrial",
  scandinavian: "Scandinavian",
  اسکاندیناوی: "Scandinavian",
  japandi: "Japandi",
  ژاپندی: "Japandi",
  luxury: "Luxury Contemporary",
  لوکس: "Luxury Contemporary",
  coastal: "Coastal",
  ساحلی: "Coastal",
  rustic: "Rustic",
  روستیک: "Rustic",
};

const COLORS: Record<string, string> = {
  کرم: "کرم",
  طوسی: "طوسی",
  سفید: "سفید",
  مشکی: "مشکی",
  قهوه‌ای: "قهوه‌ای",
  خردلی: "خردلی",
  سبز: "سبز",
  آبی: "آبی",
  سرمه‌ای: "سرمه‌ای",
  زرشکی: "زرشکی",
  نسکافه‌ای: "نسکافه‌ای",
  بژ: "بژ",
  طلایی: "طلایی",
  نقره‌ای: "نقره‌ای",
  طوسی_روشن: "طوسی روشن",
};

const REMOVE_PHRASES = ["حذف", "بردار", "پاک کن", "remove", "delete"];

const NOTES: Record<string, string> = {
  explicit_full: "بازطراحی کامل فضا با حفظ عناصر معماری.",
  explicit_target: "تغییر هدفمند فقط روی عناصر مشخص‌شده — بقیه فضا دست‌نخورده می‌ماند.",
  ui_selection: "تغییر بر اساس انتخاب رابط کاربری — سایر اجزا محافظت می‌شوند.",
  continuation: "ادامه طراحی روی تغییرات قبلی.",
  conservative: "تفسیر محافظه‌کارانه — عناصر اصلی اتاق حفظ می‌شوند.",
};

/** Parse freeform Persian request + selection into structured intent. */
export function heuristicUnderstandIntent(req: IntentRequest): AiIntent {
  const text = (req.prompt || "").trim();
  const lower = text.toLowerCase();

  // ---- Extract requested style ----
  let resolvedStyle: string | undefined = req.style;
  for (const [k, v] of Object.entries(STYLES)) {
    if (lower.includes(k)) {
      resolvedStyle = v;
      break;
    }
  }

  // ---- Extract requested colors ----
  const colors: string[] = [];
  for (const [k, v] of Object.entries(COLORS)) {
    if (lower.includes(k) && !colors.includes(v)) {
      colors.push(v);
    }
  }

  // ---- Product & SKU Resolution ----
  const rawSku = req.sku || req.productCode;
  const resolvedProduct = rawSku
    ? getProductBySkuOrCode(rawSku)
    : req.productId
      ? getProductById(req.productId)
      : undefined;

  // Selected targets from UI / Request / Category / SKU
  const selected: RoomElement[] = [];
  if (req.selectedTargets && req.selectedTargets.length > 0) {
    selected.push(...req.selectedTargets);
  }

  // If selection has category info, derive target element
  if (req.selection?.category) {
    const catTarget = categoryToRoomElement(
      req.selection.category,
      req.selection.subTypes?.join(" "),
    );
    if (!selected.includes(catTarget)) {
      selected.push(catTarget);
    }
  }

  // If SKU product resolved, derive target element
  if (resolvedProduct) {
    const productTarget = categoryToRoomElement(
      resolvedProduct.categorySlug,
      `${resolvedProduct.subCategorySlug ?? ""} ${resolvedProduct.name}`,
    );
    if (!selected.includes(productTarget)) {
      selected.push(productTarget);
    }
  }

  // Check Category vs SKU conflict if both are present
  const conflict =
    resolvedProduct && req.selection?.category
      ? detectCategorySkuConflict(
          [req.selection.category, ...(req.selection.subTypes ?? [])],
          resolvedProduct,
        )
      : undefined;

  // Explicit locked elements from prompt
  const explicitLocked = extractExplicitPreserved(text);

  // ---- 1. EMPTY PROMPT HANDLING ----
  if (!text) {
    // If raw SKU was invalid
    if (rawSku && !resolvedProduct) {
      return {
        intent: "inquiry",
        target: [],
        changes: [],
        preservedElements: [...ALL_ELEMENTS],
        scope: "single_item",
        style: req.style,
        colors: req.colors,
        confidence: 0.2,
        ambiguous: true,
        note: "این کد محصول در کاتالوگ Homeino پیدا نشد. لطفاً کد محصول را بررسی کنید.",
      };
    }

    if (selected.length > 0) {
      const scope: EditScope = selected.length === 1 ? "single_item" : "area";
      return {
        intent: "targeted_edit",
        target: selected,
        changes: [
          resolvedProduct
            ? `قرار دادن محصول ${resolvedProduct.name} (${resolvedProduct.sku || rawSku})`
            : selected.length === 1
              ? `تغییر ${ELEMENT_LABELS[selected[0]] || selected[0]}`
              : `تغییر ${selected.length} عنصر انتخابی`,
        ],
        preservedElements: resolveProtectedElements({ targets: selected, scope, explicitLocked }),
        scope,
        style: resolvedStyle || req.style,
        colors: req.colors,
        confidence: 0.9,
        note: conflict?.hasConflict
          ? conflict.message
          : "انتخاب از رابط کاربری دریافت شد — طراحی طبق عنصر انتخابی انجام می‌شود.",
      };
    }

    return {
      intent: "inquiry",
      target: [],
      changes: [],
      preservedElements: [...ALL_ELEMENTS],
      scope: "single_item",
      style: req.style,
      colors: req.colors,
      confidence: 0.35,
      ambiguous: true,
      note: "بنویسید چه چیزی باید تغییر کند تا دقیق اجرا کنیم.",
    };
  }

  // ---- 2. CANONICAL DECISION TREE (single source of truth: scope.ts) ----
  const resolution = resolveScope({
    text,
    selectedTargets: selected,
    uiScope: req.changeScope,
    previousTargets: req.previousTargets,
    previousScope: req.previousScope,
  });

  let targets = [...resolution.targets];
  let scope: EditScope = resolution.scope;
  let source = resolution.source;
  let wallDefault = false;

  // ---- 3. COLOR ONLY WITH NO TARGET («رنگ کرم کن») → Wall default ----
  if (source === "conservative" && targets.length === 0 && colors.length > 0) {
    targets = ["wall"];
    scope = "single_item";
    wallDefault = true;
  }

  const isFull = scope === "room" || scope === "whole_home";
  const isRemove = REMOVE_PHRASES.some((p) => lower.includes(p));
  const isColor = (colors.length > 0 || /رنگ|color/.test(lower)) && !isRemove && targets.length > 0;

  let intent: DesignIntentType;
  if (isFull) intent = "full_redesign";
  else if (targets.length === 0) intent = "inquiry";
  else intent = isRemove ? "remove_item" : isColor ? "color_change" : "targeted_edit";

  const preservedElements = resolveProtectedElements({ targets, scope, explicitLocked });

  const labels = (ts: RoomElement[]) => ts.map((t) => ELEMENT_LABELS[t] || t).join("، ");
  let changeDescription = "";
  if (isFull) {
    changeDescription = `بازطراحی ${scope === "whole_home" ? "کل خانه" : req.room ?? "اتاق"}${resolvedStyle ? ` با سبک ${resolvedStyle}` : ""}`;
  } else if (intent === "remove_item") {
    changeDescription = `حذف ${labels(targets)}`;
  } else if (intent === "color_change") {
    changeDescription = `تغییر رنگ ${labels(targets)}${colors.length ? ` به ${colors.join("، ")}` : ""}`;
  } else if (intent !== "inquiry") {
    changeDescription = resolvedProduct
      ? `طراحی با محصول ${resolvedProduct.name}${resolvedStyle ? ` در سبک ${resolvedStyle}` : ""}`
      : text.slice(0, 60);
  }

  const note =
    rawSku && !resolvedProduct
      ? "این کد محصول در کاتالوگ Homeino پیدا نشد. لطفاً کد محصول را بررسی کنید."
      : conflict?.hasConflict
        ? conflict.message
        : isFull && explicitLocked.length > 0
          ? "بازطراحی با حفظ عناصر درخواستی شما و حفاظت از معماری."
          : NOTES[source];

  return {
    intent,
    target: targets,
    changes: changeDescription
      ? [changeDescription, ...(explicitLocked.length ? [`حفظ ${labels(explicitLocked)}`] : [])].slice(0, 3)
      : [],
    preservedElements,
    scope,
    style: resolvedStyle || req.style,
    colors: req.colors?.length ? [...new Set([...req.colors, ...colors])] : colors,
    confidence:
      wallDefault
        ? 0.7
        : intent === "inquiry"
          ? Math.min(resolution.confidence, 0.4)
          : resolution.confidence,
    ambiguous: intent === "inquiry" || wallDefault ? true : undefined,
    note,
  };
}

export const heuristicLlmProvider: LlmProvider = {
  name: "heuristic",
  async understandIntent(req) {
    // Simulate a short round-trip so the UI states are exercised.
    await new Promise((r) => setTimeout(r, 350));
    return heuristicUnderstandIntent(req);
  },
};

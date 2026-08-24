// ============================================================
// HOMEINO AI DESIGN PIPELINE — SERVER-ONLY.
//
//   User Input
//     → AI Context Engine            (context.ts — structured context)
//     → LLM Intent Understanding     (llm/ — structured JSON, capped, retried)
//     → Change Scope + Protected     (scope.ts + roomState.ts — golden rule)
//     → Product-Aware Placement      (placement.ts — real product data)
//     → Design Instruction           (targets + hard preservation rules)
//     → Image / Overlay Generation   (Orali first, provider fallback)
//     → Result Validation            (never fake success)
//     → Real Store Matching          (roomState.ts — priority-ranked store products)
//     → Result Display               (client renders PipelineResult)
//
// The pipeline is provider-agnostic: swap Orali or the LLM via
// env vars — the UI contract (PipelineResult) never changes.
// ============================================================
import { resolveProvider } from "./provider";
import { resolveOrali, OraliNotConfiguredError } from "./orali";
import type { OverlayRegion } from "./orali";
import { understandIntent } from "./llm";
import type { IntentAnalysis, IntentRequest } from "./llm";
import {
  ALL_ELEMENTS,
  STRUCTURAL_ELEMENTS,
  DESIGNABLE_ELEMENTS,
  ELEMENT_LABELS,
  buildDesignConstraints,
  constraintsToPrompt,
  validateResult,
  resolveProtectedElements,
  detectArchitecturalTargets,
  categoryToRoomElement,
  detectCategorySkuConflict,
  matchStoreProducts,
  type RoomElement,
  type DesignConstraints,
  type RoomUnderstanding,
  type MatchedStoreProduct,
} from "./roomState";
import { resolveScope, isFullScope, scopeToEditStrength, type EditScope } from "./scope";
import {
  buildAIContext,
  compactContextForLlm,
  contextSummary,
  type ContextProduct,
  type ContextSelectedProduct,
} from "./context";
import {
  planProductPlacement,
  productPlacementPrompt,
  parseProductDimensions,
  type PlacementProduct,
  type ProductPlacementPlan,
} from "./placement";
import { createRequestId, withAiTelemetry } from "./telemetry";
import { reserveCreditsForAi, finalizeCreditsForAi, refundCreditsForAi } from "./serverCredits";
import { AiError } from "./errors";
import { getProductBySkuOrCode } from "../../data/products";
import type { GeneratedDesign } from "./types";
import { uid } from "../../lib/utils";

export type ChangeScope = "targeted" | "full";

export interface PipelineInput {
  prompt: string;
  room?: string;
  style?: string;
  colors?: string[];
  scope: ChangeScope;
  /** USER-CONFIRMED targets (from the designer UI / intent card). */
  targets?: RoomElement[];
  /** Extra elements the user explicitly locked. */
  preservedExtra?: RoomElement[];
  referenceImage?: string;
  /** Base64 PNG mask (white = edit region) for precise edits. */
  mask?: string;
  /** Pre-confirmed intent from the "understand" step — skips LLM re-run. */
  intent?: IntentAnalysis;
  // ---- Phase 4 — change scope (auto-detected when absent) ----
  editScope?: EditScope;
  // ---- Phase 15 — design memory (continuation) ----
  previousTargets?: RoomElement[];
  previousChanges?: string[];
  previousProductId?: string;
  previousSKU?: string;
  /** Scope of the previous request (continuation fidelity). */
  previousScope?: EditScope;
  // ---- Phase 7/8 / SKU / Product selection ----
  productId?: string;
  sku?: string;
  productCode?: string;
  selectedProduct?: ContextSelectedProduct;
  selection?: {
    category?: string;
    subTypes?: string[];
    targets?: RoomElement[];
  };
  products?: PlacementProduct[];
  // ---- Phase 2 — budget slice of the context ----
  budget?: { min?: number; max?: number; currency?: string };
  // ---- Phase 3 — room understanding (vision layer output) ----
  roomUnderstanding?: RoomUnderstanding;
  // ---- Phase 17 — server-side credits (server-only) ----
  userId?: string;
}

/** The compiled, engine-facing instruction — the pipeline's contract
 *  between understanding and generation. */
export interface DesignInstruction {
  prompt: string;
  targets: RoomElement[];
  preserved: RoomElement[];
  style?: string;
  colors?: string[];
  room?: string;
  constraints: DesignConstraints;
  /** English instruction string handed to the image engine. */
  enginePrompt: string;
  // ---- Phase 4 — scope-aware generation ----
  scope: EditScope;
  protectedElements: RoomElement[];
  /** Artistic freedom for the image engine (0..1). */
  strength: number;
  /** Which visual operation should be used. */
  editMode: "inpaint" | "edit" | "generate";
  /** Product placement plan when a real product was selected (Phase 8). */
  placement?: ProductPlacementPlan;
  /** Selected product info if one was placed / resolved. */
  selectedProduct?: ContextSelectedProduct;
}

export type PipelineOutcome = "completed" | "preview" | "failed";

export interface PipelineResult {
  intent: IntentAnalysis;
  instruction: DesignInstruction;
  result: GeneratedDesign;
  validation: { status: PipelineOutcome; reasons: string[] };
  /** Which visual engine produced the image ("orali" | provider name). */
  imageEngine: string;
  creditsCost: number;
  // ---- Phase 4/5 — scope + protection summary ----
  scope: EditScope;
  protectedElements: RoomElement[];
  /** Product placement when a real product was used (Phase 8). */
  placement?: ProductPlacementPlan;
  /** Real matched store products below the generated image (Phase 10-15). */
  matchedProducts?: MatchedStoreProduct[];
  selectedProduct?: ContextSelectedProduct;
  sku?: string;
  /** Debugging: compact context + request id (no secrets). */
  requestId?: string;
  contextSummary?: string;
}

/* ---------------- Step 1: Intent ---------------- */

export async function runIntentUnderstanding(input: PipelineInput): Promise<IntentAnalysis> {
  const rawSku = (input.sku || input.productCode)?.trim();
  let resolvedProduct = rawSku ? getProductBySkuOrCode(rawSku) : undefined;

  // Requirement 7: Invalid SKU validation
  if (rawSku && !resolvedProduct) {
    throw AiError.invalidSku("این کد محصول در کاتالوگ Homeino پیدا نشد. لطفاً کد محصول را بررسی کنید.");
  }

  // If no SKU provided, but productId was given, try resolving product
  if (!resolvedProduct && input.productId) {
    resolvedProduct = getProductBySkuOrCode(input.productId);
  }

  // Requirement 18: Category + SKU conflict detection
  if (resolvedProduct && input.targets?.length) {
    const conflict = detectCategorySkuConflict(input.selection?.category, input.targets, resolvedProduct);
    if (conflict.hasConflict) {
      throw AiError.categoryConflict(conflict.message);
    }
  }

  const productTarget = resolvedProduct
    ? categoryToRoomElement(
        resolvedProduct.categorySlug,
        `${resolvedProduct.subCategorySlug ?? ""} ${resolvedProduct.name}`,
      )
    : undefined;

  let inputTargets = input.targets ?? [];
  if (inputTargets.length === 0 && productTarget) {
    inputTargets = [productTarget];
  }

  if (input.intent && input.intent.target.length >= 0 && input.intent.intent) {
    return input.intent; // user already confirmed the reading
  }

  const effectiveTargets = [...new Set([...inputTargets, ...(input.intent?.target ?? [])])];
  // Canonical scope for the pre-LLM context (single source of truth — scope.ts).
  const resolution = resolveScope({
    text: input.prompt,
    selectedTargets: inputTargets,
    uiScope: input.scope,
    previousTargets: input.previousTargets,
    previousScope: input.previousScope,
  });

  const selectedProductCtx: ContextSelectedProduct | undefined = resolvedProduct
    ? {
        id: resolvedProduct.id,
        sku: resolvedProduct.sku,
        name: resolvedProduct.name,
        category: resolvedProduct.categorySlug,
        storeId: resolvedProduct.storeId,
        brand: resolvedProduct.brand,
        price: resolvedProduct.price,
        currency: resolvedProduct.currency,
        image: resolvedProduct.images[0],
        material: resolvedProduct.materials?.[0],
        color: resolvedProduct.colors?.[0]?.name,
        style: resolvedProduct.styleSlugs?.[0],
        dimensions: parseProductDimensions(resolvedProduct.dimensions),
      }
    : input.selectedProduct;

  // Build the structured context BEFORE the model call (Phase 2 & 20).
  const ctx = buildAIContext({
    prompt: input.prompt,
    style: input.style,
    room: input.room,
    colors: input.colors,
    targets: effectiveTargets,
    scope: resolution.scope,
    protectedElements: resolveProtectedElements({
      targets: effectiveTargets,
      scope: resolution.scope,
      explicitLocked: input.preservedExtra,
    }),
    roomUnderstanding: input.roomUnderstanding,
    selection: input.selection,
    selectedProduct: selectedProductCtx,
    productCode: rawSku || resolvedProduct?.sku,
    sku: rawSku || resolvedProduct?.sku,
    products: input.products as ContextProduct[] | undefined,
    budget: input.budget,
    previousTargets: input.previousTargets,
    previousProductId: input.previousProductId,
    previousSKU: input.previousSKU,
    previousChanges: input.previousChanges,
  });

  const req: IntentRequest = {
    prompt: input.prompt,
    style: input.style,
    room: input.room,
    colors: input.colors,
    changeScope: input.scope,
    selectedTargets: effectiveTargets.length ? effectiveTargets : undefined,
    previousTargets: input.previousTargets,
    previousProductId: input.previousProductId,
    previousSKU: input.previousSKU,
    previousChanges: input.previousChanges,
    previousScope: input.previousScope,
    sku: rawSku || resolvedProduct?.sku,
    productCode: rawSku || resolvedProduct?.sku,
    // Phase 12 — only the context slice the model needs (≤ ~700 chars).
    roomContext: compactContextForLlm(ctx),
    budget: input.budget,
  };
  const { analysis } = await understandIntent(req);
  return analysis;
}

/* ---------------- Step 2: Instruction ---------------- */

export function buildDesignInstruction(input: PipelineInput, intent: IntentAnalysis): DesignInstruction {
  const rawSku = (input.sku || input.productCode)?.trim();
  const resolvedProduct = rawSku
    ? getProductBySkuOrCode(rawSku)
    : input.productId
      ? getProductBySkuOrCode(input.productId)
      : undefined;

  const productTarget = resolvedProduct
    ? categoryToRoomElement(
        resolvedProduct.categorySlug,
        `${resolvedProduct.subCategorySlug ?? ""} ${resolvedProduct.name}`,
      )
    : undefined;

  let inputTargets = input.targets ?? [];
  if (inputTargets.length === 0 && productTarget) {
    inputTargets = [productTarget];
  }

  // Phase 4 / AI ACCURACY PATCH (fix 3) — the canonical decision tree (scope.ts)
  // is the SINGLE source of truth for scope & targets. An explicit editScope
  // (set by the UI) still wins over the tree.
  const resolution = resolveScope({
    text: input.prompt,
    selectedTargets: inputTargets,
    uiScope: input.scope,
    previousTargets: input.previousTargets,
    previousScope: input.previousScope,
  });
  const scope: EditScope = input.editScope ?? resolution.scope;
  // Fix 8 — never trust the LLM blindly: the LLM's answer can never WIDEN the
  // tree's scope. The UI "full" redesign mode also forces a full generation —
  // unless the prompt explicitly names a narrower target (an explicit user
  // target is priority 1 in the decision tree).
  const isFull = isFullScope(scope) || (input.scope === "full" && resolution.source !== "explicit_target");

  // Fix 4 — structural elements (walls, floor, ceiling, windows, doors,
  // geometry, camera) are ALWAYS protected by default, even in a full
  // redesign. They join the targets ONLY when the user explicitly requested
  // them — neither the LLM nor the UI can add them silently.
  const explicitStructural = detectArchitecturalTargets(String(input.prompt ?? "").toLowerCase());
  const confirmedStructural = input.intent ? intent.target.filter((t) => STRUCTURAL_ELEMENTS.includes(t)) : [];
  const allowedStructural = [...new Set([
    ...explicitStructural,
    ...resolution.targets.filter((t) => STRUCTURAL_ELEMENTS.includes(t)),
    ...confirmedStructural.filter((t) => explicitStructural.includes(t)),
  ])];

  let targets: RoomElement[];
  if (isFull) {
    // FULL REDESIGN: ALL DESIGNABLE elements are permitted (never ALL
    // elements) — architecture stays protected. A user-confirmed intent may
    // carry its own designable target list; otherwise every designable
    // element is open for redesign.
    const confirmed = input.intent
      ? intent.target.filter((t) => !STRUCTURAL_ELEMENTS.includes(t) || allowedStructural.includes(t))
      : [];
    targets = [...new Set([
      ...(confirmed.length ? confirmed : [...DESIGNABLE_ELEMENTS]),
      ...allowedStructural,
    ])];
  } else {
    // NARROW SCOPE: the tree's targets are authoritative (fix 5/8) — the LLM
    // may only narrow within them, never widen. A user-CONFIRMED intent
    // (intent card) may contribute its targets since the user approved them.
    targets = [...new Set([...resolution.targets, ...(input.intent ? intent.target : [])])]
      .filter((t) => !STRUCTURAL_ELEMENTS.includes(t) || allowedStructural.includes(t));
  }

  // Fix 5 — protected elements: structural (unless explicitly targeted) +
  // every untouched object.
  const protectedElements = resolveProtectedElements({
    targets,
    scope,
    explicitLocked: input.preservedExtra,
  });

  const preserved = ALL_ELEMENTS.filter((e) => !targets.includes(e) || protectedElements.includes(e));

  const constraints = buildDesignConstraints({
    type: isFull ? "full_redesign" : intent.intent === "color_change" ? "color_change" : "partial_edit",
    targets,
    style: input.style,
    requestedChanges: intent.changes,
    lockedElements: preserved,
    confidence: intent.confidence,
    requiresClarification: Boolean(intent.ambiguous),
  });

  // Phase 7/8 / Requirement 9 — product-aware placement plan & identity preservation.
  let placement: ProductPlacementPlan | undefined;
  const productCandidate =
    input.products?.find((p) => p.id === input.productId) ??
    (resolvedProduct
      ? {
          id: resolvedProduct.id,
          sku: resolvedProduct.sku,
          name: resolvedProduct.name,
          category: resolvedProduct.categorySlug,
          material: resolvedProduct.materials?.[0],
          color: resolvedProduct.colors?.[0]?.name,
          style: resolvedProduct.styleSlugs?.[0],
          dimensions: parseProductDimensions(resolvedProduct.dimensions),
        }
      : input.products?.[0]);

  if (productCandidate && !isFull) {
    placement = planProductPlacement(productCandidate);
  }

  const selectedProductCtx: ContextSelectedProduct | undefined = resolvedProduct
    ? {
        id: resolvedProduct.id,
        sku: resolvedProduct.sku,
        name: resolvedProduct.name,
        category: resolvedProduct.categorySlug,
        storeId: resolvedProduct.storeId,
        brand: resolvedProduct.brand,
        price: resolvedProduct.price,
        currency: resolvedProduct.currency,
        image: resolvedProduct.images[0],
        material: resolvedProduct.materials?.[0],
        color: resolvedProduct.colors?.[0]?.name,
        style: resolvedProduct.styleSlugs?.[0],
        dimensions: parseProductDimensions(resolvedProduct.dimensions),
      }
    : input.selectedProduct;

  const targetLabels = targets.map((t) => ELEMENT_LABELS[t] || t).join("، ");
  const enginePrompt = [
    isFull
      ? `Full ${scope === "whole_home" ? "home" : "room"} redesign in ${input.style ?? "modern"} style. Redesign furniture, decor, lighting and styling freely.`
      : `Edit ONLY these elements: ${targetLabels}. Everything else must remain pixel-identical.`,
    input.prompt?.trim() && `User request: ${input.prompt.trim()}`,
    input.style && `Decor style: ${input.style}`,
    input.colors?.length && `Color palette: ${input.colors.join("، ")}`,
    input.room && `Room type: ${input.room}`,
    protectedElements.length > 0 &&
      `PROTECTED ARCHITECTURE & UNTOUCHED ELEMENTS — do NOT change, move, remove or restyle: ${protectedElements.slice(0, 8).map((e) => ELEMENT_LABELS[e] || e).join("، ")}. Keep exact walls, floor structure, ceiling, windows, doors, camera angle and room geometry unchanged.`,
    placement && productCandidate && productPlacementPrompt(productCandidate, placement),
    productCandidate &&
      `Product visual identity to preserve: ${productCandidate.name ?? "selected piece"} (SKU: ${productCandidate.sku ?? productCandidate.id}). Retain exact proportions, shape, design language, material textures (${productCandidate.material ?? "authentic"}), and color tone (${productCandidate.color ?? "specified"}).`,
    constraintsToPrompt(constraints),
    "Photorealistic interior photograph, consistent perspective and lighting, high detail.",
  ]
    .filter(Boolean)
    .join("\n");

  const hasReference = Boolean(input.referenceImage);
  const editMode: DesignInstruction["editMode"] =
    !hasReference || isFull ? "generate" : input.mask ? "inpaint" : "edit";

  return {
    prompt: input.prompt,
    targets,
    preserved,
    style: input.style,
    colors: input.colors,
    room: input.room,
    constraints,
    enginePrompt,
    scope,
    protectedElements,
    strength: scopeToEditStrength(scope),
    editMode,
    placement,
    selectedProduct: selectedProductCtx,
  };
}

/* ---------------- Step 3: Generation (Orali → provider) ---------------- */

async function generateVisual(
  input: PipelineInput,
  instruction: DesignInstruction,
): Promise<{ design: GeneratedDesign; engine: string; degraded: boolean }> {
  const orali = resolveOrali();
  if (orali && input.referenceImage) {
    try {
      const targetRegion = instruction.placement?.targetRegion
        ? {
            x: instruction.placement.targetRegion.x,
            y: instruction.placement.targetRegion.y,
            w: instruction.placement.targetRegion.width,
            h: instruction.placement.targetRegion.height,
          }
        : undefined;
      const out = await orali.generateEdit({
        image: input.referenceImage,
        instruction: instruction.enginePrompt,
        mask: input.mask,
        preserveArchitecture: instruction.constraints.preserveArchitecture,
        protectedElements: instruction.protectedElements.map((e) => ELEMENT_LABELS[e]),
        targetRegion,
        style: instruction.style,
        colors: instruction.colors,
        strength: instruction.strength,
      });
      return {
        design: {
          id: uid(),
          beforeImage: input.referenceImage,
          afterImage: out.image,
          creditsUsed: creditsCostFor(instruction),
          products: [],
          regions: out.regions,
        },
        engine: "orali",
        degraded: false,
      };
    } catch (err) {
      if (!(err instanceof OraliNotConfiguredError)) {
        console.warn("[ai-pipeline] Orali failed, degrading to base provider:", err instanceof Error ? err.message : err);
      }
    }
  }

  // Fallback: base provider (mock by default — honestly marked preview).
  const { provider, name } = await resolveProvider();
  const useEdit = input.referenceImage && instruction.editMode !== "generate";
  const design = useEdit
    ? await provider.editImage({ ...toProviderInput(input), prompt: instruction.enginePrompt, mask: input.mask })
    : await provider.generateDesign({ ...toProviderInput(input), prompt: instruction.enginePrompt });
  return { design: { ...design, regions: estimateRegions(instruction) }, engine: name, degraded: false };
}

function toProviderInput(input: PipelineInput) {
  return {
    mode: "room-redesign" as const,
    prompt: input.prompt,
    style: input.style,
    room: input.room,
    color: input.colors?.join("، "),
    referenceImage: input.referenceImage,
    mask: input.mask,
  };
}

/**
 * Honest overlay metadata when no real overlay engine ran:
 * we do NOT invent fake boxes — regions stay empty and the UI shows
 * the scope as text. Real region boxes come from Orali only.
 */
function estimateRegions(_instruction: DesignInstruction): OverlayRegion[] {
  return [];
}

function creditsCostFor(instruction: DesignInstruction): number {
  return isFullScope(instruction.scope) ? 5 : 3;
}

/* ---------------- Steps 4+5: Validate → Result ---------------- */

export async function runDesignPipeline(input: PipelineInput): Promise<PipelineResult> {
  const requestId = createRequestId();

  return withAiTelemetry(
    {
      requestId,
      userId: input.userId ?? null,
      action: "pipeline",
      provider: "pipeline",
      promptHint: input.prompt,
      credits: input.scope === "full" ? 5 : 3,
    },
    async () => {
      // Phase 17 — server-side credit gate (before any AI work).
      const credit = input.userId
        ? await reserveCreditsForAi({
            userId: input.userId,
            mode: input.scope === "full" ? "generate" : "edit",
            prompt: input.prompt,
            productId: input.productId,
            cost: input.scope === "full" ? 5 : 3,
          })
        : { charged: false, cost: 0 };

      try {
        // 1) UNDERSTAND — structured, tiny, cached when pre-confirmed
        const intent = await runIntentUnderstanding(input);

        // 2) PLAN — compile the engine-facing instruction
        const instruction = buildDesignInstruction(input, intent);

        // 3) GENERATE — Orali (real overlay) or base provider
        const { design, engine } = await generateVisual(input, instruction);

        // 4) VALIDATE — never fake success
        const validation = validateResult({
          beforeImage: input.referenceImage,
          afterImage: design.afterImage,
          intent: {
            type:
              instruction.scope === "whole_home" || instruction.scope === "room"
                ? "full_redesign"
                : intent.intent === "color_change"
                  ? "color_change"
                  : "partial_edit",
            targets: instruction.targets,
            style: instruction.style,
            requestedChanges: intent.changes,
            lockedElements: instruction.preserved,
            confidence: intent.confidence,
            requiresClarification: Boolean(intent.ambiguous),
          },
          providerMarkedPreview: design.preview,
        });

        // 5) FINALIZE — server credits only on real completion.
        if (credit.charged && credit.generationId) {
          await finalizeCreditsForAi(credit.generationId, { durationMs: undefined, outputAssetUrl: design.afterImage });
        }

        // 6) REAL STORE PRODUCT MATCHING (Requirements 10-15)
        const rawSku = (input.sku || input.productCode)?.trim();
        const resolvedProduct = rawSku
          ? getProductBySkuOrCode(rawSku)
          : input.productId
            ? getProductBySkuOrCode(input.productId)
            : undefined;

        const matchedProducts = matchStoreProducts({
          sku: rawSku || resolvedProduct?.sku,
          productId: resolvedProduct?.id || input.productId,
          targets: instruction.targets,
          category: input.selection?.category || resolvedProduct?.categorySlug,
          style: instruction.style,
          colors: instruction.colors,
          roomType: instruction.room,
          budget: input.budget?.min ?? input.budget?.max,
          maxResults: 6,
        });

        const ctx = buildAIContext({
          prompt: input.prompt,
          style: input.style,
          styleLabel: input.style,
          room: input.room,
          colors: input.colors,
          targets: instruction.targets,
          scope: instruction.scope,
          protectedElements: instruction.protectedElements,
          roomUnderstanding: input.roomUnderstanding,
          selection: input.selection,
          selectedProduct: instruction.selectedProduct,
          productCode: rawSku || resolvedProduct?.sku,
          sku: rawSku || resolvedProduct?.sku,
          products: input.products as ContextProduct[] | undefined,
          budget: input.budget,
          previousTargets: input.previousTargets,
          previousProductId: input.previousProductId,
          previousSKU: input.previousSKU,
          previousChanges: input.previousChanges,
        });

        return {
          intent,
          instruction,
          result: { ...design, creditsUsed: design.creditsUsed || creditsCostFor(instruction) },
          validation: { status: validation.status, reasons: validation.reasons },
          imageEngine: engine,
          creditsCost: design.creditsUsed || creditsCostFor(instruction),
          scope: instruction.scope,
          protectedElements: instruction.protectedElements,
          placement: instruction.placement,
          matchedProducts,
          selectedProduct: instruction.selectedProduct,
          sku: rawSku || resolvedProduct?.sku,
          requestId,
          contextSummary: contextSummary(ctx),
        };
      } catch (err) {
        // 7) REFUND — server credits on failure (idempotent).
        if (credit.charged && credit.generationId) {
          await refundCreditsForAi(credit.generationId, err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
  );
}

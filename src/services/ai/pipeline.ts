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
  ALL_ELEMENTS, STRUCTURAL_ELEMENTS, DESIGNABLE_ELEMENTS, ELEMENT_LABELS, buildDesignConstraints, constraintsToPrompt,
  validateResult, resolveProtectedElements, detectArchitecturalTargets,
  type RoomElement, type DesignConstraints, type RoomUnderstanding,
} from "./roomState";
import { resolveScope, isFullScope, scopeToEditStrength, continuationTargets, type EditScope } from "./scope";
import { buildAIContext, buildFinalAiContext, compactContextForLlm, contextSummary, type ContextProduct, type SelectedProductContext } from "./context";
import { planProductPlacement, productIdentityPrompt, productPlacementPrompt, type PlacementProduct, type ProductPlacementPlan } from "./placement";
import {
  categoryToTarget,
  matchAfterGeneration,
  resolveProductCode,
  toMatchableProduct,
  type CatalogOffer,
  type CatalogStore,
  type MatchableProduct,
  type ProductResolution,
  type StoreProductMatch,
} from "./productMatching";
import { AiError } from "./errors";
import { createRequestId, withAiTelemetry } from "./telemetry";
import { reserveCreditsForAi, finalizeCreditsForAi, refundCreditsForAi } from "./serverCredits";
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
  /** Scope of the previous request (continuation fidelity). */
  previousScope?: EditScope;
  // ---- Phase 7/8 — product-aware overlay ----
  productId?: string;
  products?: PlacementProduct[];
  /** User-entered product code / SKU (resolved against the real catalog). */
  sku?: string;
  productCode?: string;
  selectedProduct?: SelectedProductContext;
  previousProductId?: string;
  previousSku?: string;
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
  /** Debugging: compact context + request id (no secrets). */
  requestId?: string;
  contextSummary?: string;
  /** Real selected / SKU-resolved product that reached the image pipeline. */
  selectedProduct?: SelectedProductContext;
  /** Real store catalog hits shown under the generated image. */
  matchedProducts?: StoreProductMatch[];
  productResolution?: ProductResolution;
  /** Spec §20 — only fields that actually exist. */
  finalContext?: Record<string, unknown>;
}

/* ---------------- Step 1: Intent ---------------- */

export async function runIntentUnderstanding(input: PipelineInput): Promise<IntentAnalysis> {
  if (input.intent && input.intent.target.length >= 0 && input.intent.intent) {
    return input.intent; // user already confirmed the reading
  }
  const effectiveTargets = [...new Set([...(input.targets ?? []), ...(input.intent?.target ?? [])])];
  // Canonical scope for the pre-LLM context (single source of truth — scope.ts).
  const resolution = resolveScope({
    text: input.prompt,
    selectedTargets: input.targets,
    uiScope: input.scope,
    previousTargets: input.previousTargets,
    previousScope: input.previousScope,
  });

  // Build the structured context BEFORE the model call (Phase 2).
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
    products: input.products as ContextProduct[] | undefined,
    budget: input.budget,
    previousTargets: input.previousTargets,
    previousChanges: input.previousChanges,
    selectedProduct: input.selectedProduct,
    productCode: input.productCode,
    sku: input.sku,
    previousSku: input.previousSku,
    previousProductId: input.previousProductId,
  });

  const req: IntentRequest = {
    prompt: input.prompt,
    style: input.style,
    room: input.room,
    colors: input.colors,
    changeScope: input.scope,
    selectedTargets: input.targets?.length ? input.targets : undefined,
    previousTargets: input.previousTargets,
    previousChanges: input.previousChanges,
    previousScope: input.previousScope,
    selectedProduct: input.selectedProduct,
    sku: input.sku ?? input.productCode,
    previousSku: input.previousSku,
    previousProductId: input.previousProductId,
    // Phase 12 — only the context slice the model needs (≤ ~700 chars).
    roomContext: compactContextForLlm(ctx),
    budget: input.budget,
  };
  const { analysis } = await understandIntent(req);
  return analysis;
}

/* ---------------- Step 2: Instruction ---------------- */

export function buildDesignInstruction(input: PipelineInput, intent: IntentAnalysis): DesignInstruction {
  // Phase 4 / AI ACCURACY PATCH (fix 3) — the canonical decision tree (scope.ts)
  // is the SINGLE source of truth for scope & targets. An explicit editScope
  // (set by the UI) still wins over the tree.
  const resolution = resolveScope({
    text: input.prompt,
    selectedTargets: input.targets,
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

  // Phase 7/8 — product-aware placement plan (real product data only).
  let placement: ProductPlacementPlan | undefined;
  const product = input.products?.find((p) => p.id === input.productId) ?? input.products?.[0];
  if (product && !isFull) {
    placement = planProductPlacement(product);
  }

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
    product && (placement ? productPlacementPrompt(product, placement) : productIdentityPrompt(product)),
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
        ? { x: instruction.placement.targetRegion.x, y: instruction.placement.targetRegion.y, w: instruction.placement.targetRegion.width, h: instruction.placement.targetRegion.height }
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

/* ---------------- Catalog (real products only) ---------------- */

export async function loadMatchingCatalog(): Promise<{
  catalog: MatchableProduct[];
  stores: CatalogStore[];
  offers: CatalogOffer[];
}> {
  try {
    const { productsRepository } = await import("../../repositories/products");
    const { storesRepository } = await import("../../repositories/stores");
    const { PRODUCT_SKUS } = await import("../../data/products");
    const { offers } = await import("../../data/offers");
    const [list, storeList] = await Promise.all([
      productsRepository.list(),
      storesRepository.list(),
    ]);
    return {
      catalog: list.map((p) => toMatchableProduct(p, p.sku ?? PRODUCT_SKUS[p.id])),
      stores: storeList.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
      offers: offers.map((o) => ({
        productId: o.productId,
        storeId: o.storeId,
        price: o.price,
        inStock: o.inStock,
        sellerSku: o.sellerSku,
      })),
    };
  } catch {
    const { products, PRODUCT_SKUS } = await import("../../data/products");
    const { stores } = await import("../../data/stores");
    const { offers } = await import("../../data/offers");
    return {
      catalog: products.map((p) => toMatchableProduct(p, PRODUCT_SKUS[p.id])),
      stores: stores.map((s) => ({ id: s.id, name: s.name, slug: s.slug })),
      offers: offers.map((o) => ({
        productId: o.productId,
        storeId: o.storeId,
        price: o.price,
        inStock: o.inStock,
        sellerSku: o.sellerSku,
      })),
    };
  }
}

function extraCodesFrom(offers: CatalogOffer[]): { sku: string; productId: string }[] {
  return offers
    .filter((o): o is CatalogOffer & { sellerSku: string } => Boolean(o.sellerSku))
    .map((o) => ({ sku: o.sellerSku, productId: o.productId }));
}

function mergeResolvedProduct(input: PipelineInput, product: NonNullable<ProductResolution["product"]>): PipelineInput {
  const target = categoryToTarget(product);
  const targets = [...new Set([...(input.targets ?? []), ...(target ? [target] : [])])];
  const already = input.products?.some((p) => p.id === product.id);
  const asPlacement: PlacementProduct = {
    id: product.id,
    name: product.name,
    category: product.category,
    material: product.material,
    color: product.color,
    style: product.style,
    sku: product.sku,
    storeId: product.storeId,
    image: product.image,
  };
  return {
    ...input,
    targets: targets.length ? targets : input.targets,
    productId: product.id,
    sku: product.sku ?? input.sku,
    productCode: input.productCode ?? product.sku,
    selectedProduct: {
      id: product.id,
      sku: product.sku,
      name: product.name,
      category: product.category,
      storeId: product.storeId,
      image: product.image,
    },
    products: already ? input.products : [asPlacement, ...(input.products ?? [])],
  };
}

/** Resolve SKU / selected product against the real catalog. Throws on invalid SKU. */
export async function resolvePipelineProduct(
  input: PipelineInput,
  catalogPack?: Awaited<ReturnType<typeof loadMatchingCatalog>>,
): Promise<{ input: PipelineInput; resolution: ProductResolution }> {
  const pack = catalogPack ?? await loadMatchingCatalog();
  const isContinuation = Boolean(continuationTargets(input.prompt, input.previousTargets));
  const code = input.sku || input.productCode || (isContinuation ? input.previousSku : undefined);

  if (code) {
    const resolution = resolveProductCode(code, pack.catalog, {
      selectedTargets: input.targets,
      extraCodes: extraCodesFrom(pack.offers),
    });
    if (resolution.status === "not_found") throw AiError.productNotFound(resolution.message);
    if (resolution.status === "conflict") throw AiError.categorySkuConflict(resolution.message);
    if (resolution.status === "ok" && resolution.product) {
      return { input: mergeResolvedProduct(input, resolution.product), resolution };
    }
    return { input, resolution };
  }

  const productId = input.selectedProduct?.id || input.productId || (isContinuation ? input.previousProductId : undefined);
  if (productId) {
    const found = pack.catalog.find((p) => p.id === productId);
    if (found) {
      const product = {
        id: found.id,
        sku: found.sku,
        name: found.name,
        category: found.categorySlug ?? found.category,
        storeId: found.storeId,
        image: found.images?.[0],
        material: found.materials?.[0],
        color: typeof found.colors?.[0] === "string" ? found.colors[0] : found.colors?.[0]?.name,
        style: found.styleSlugs?.[0],
      };
      return {
        input: mergeResolvedProduct(input, product),
        resolution: { status: "ok", product, productTarget: categoryToTarget(found) },
      };
    }
  }

  return { input, resolution: { status: "empty" } };
}

export function matchPipelineProducts(
  input: PipelineInput,
  instruction: DesignInstruction,
  pack: Awaited<ReturnType<typeof loadMatchingCatalog>>,
  generatedImage?: string,
): StoreProductMatch[] {
  return matchAfterGeneration({
    catalog: pack.catalog,
    stores: pack.stores,
    offers: pack.offers,
    sku: input.sku ?? input.selectedProduct?.sku,
    productId: input.productId ?? input.selectedProduct?.id,
    targets: instruction.targets,
    style: input.style ?? instruction.style,
    colors: input.colors ?? instruction.colors,
    room: input.roomUnderstanding?.roomType ?? input.room,
    roomAnalysis: input.roomUnderstanding
      ? {
          roomType: input.roomUnderstanding.roomType,
          furnitureTypes: input.roomUnderstanding.furnitureTypes,
          emptySpaces: input.roomUnderstanding.emptySpaces,
        }
      : undefined,
    generatedImage,
    maxResults: 8,
  });
}

/* ---------------- Steps 4+5: Validate → Result ---------------- */

export async function runDesignPipeline(input: PipelineInput): Promise<PipelineResult> {
  const requestId = createRequestId();
  const pack = await loadMatchingCatalog();
  const resolved = await resolvePipelineProduct(input, pack);
  const working = resolved.input;

  return withAiTelemetry(
    {
      requestId,
      userId: working.userId ?? null,
      action: "pipeline",
      provider: "pipeline",
      promptHint: working.prompt,
      credits: working.scope === "full" ? 5 : 3,
    },
    async () => {
      // Phase 17 — server-side credit gate (after SKU resolution, before AI work).
      const credit = working.userId
        ? await reserveCreditsForAi({
            userId: working.userId,
            mode: working.scope === "full" ? "generate" : "edit",
            prompt: working.prompt,
            productId: working.productId,
            cost: working.scope === "full" ? 5 : 3,
          })
        : { charged: false, cost: 0 };

      try {
        // 1) UNDERSTAND — structured, tiny, cached when pre-confirmed
        const intent = await runIntentUnderstanding(working);

        // 2) PLAN — compile the engine-facing instruction
        const instruction = buildDesignInstruction(working, intent);

        // 3) GENERATE — Orali (real overlay) or base provider
        const { design, engine } = await generateVisual(working, instruction);

        // 4) VALIDATE — never fake success
        const validation = validateResult({
          beforeImage: working.referenceImage,
          afterImage: design.afterImage,
          intent: {
            type: instruction.scope === "whole_home" || instruction.scope === "room" ? "full_redesign" : intent.intent === "color_change" ? "color_change" : "partial_edit",
            targets: instruction.targets,
            style: instruction.style,
            requestedChanges: intent.changes,
            lockedElements: instruction.preserved,
            confidence: intent.confidence,
            requiresClarification: Boolean(intent.ambiguous),
          },
          providerMarkedPreview: design.preview,
        });

        // 5) MATCH real store products — does NOT re-run generation or rewrite the image.
        const generatedImage = design.afterImage;
        const matchedProducts = matchPipelineProducts(working, instruction, pack, generatedImage);

        // 6) FINALIZE — server credits only on real completion.
        if (credit.charged && credit.generationId) {
          await finalizeCreditsForAi(credit.generationId, { durationMs: undefined, outputAssetUrl: design.afterImage });
        }

        const ctx = buildAIContext({
          prompt: working.prompt,
          style: working.style,
          styleLabel: working.style,
          room: working.room,
          colors: working.colors,
          targets: instruction.targets,
          scope: instruction.scope,
          protectedElements: instruction.protectedElements,
          roomUnderstanding: working.roomUnderstanding,
          products: working.products as ContextProduct[] | undefined,
          budget: working.budget,
          previousTargets: working.previousTargets,
          previousChanges: working.previousChanges,
          selectedProduct: working.selectedProduct,
          productCode: working.productCode,
          sku: working.sku,
          previousSku: working.previousSku,
          previousProductId: working.previousProductId,
        });

        const finalContext = buildFinalAiContext({
          room: ctx.room,
          roomAnalysis: ctx.analysisContext,
          selection: working.targets?.length ? { targets: working.targets } : undefined,
          target: instruction.targets,
          scope: instruction.scope,
          style: ctx.style,
          colors: working.colors,
          description: working.prompt.trim() || undefined,
          selectedProduct: working.selectedProduct,
          productCode: working.productCode,
          sku: working.sku,
          previousTargets: working.previousTargets,
          previousSku: working.previousSku,
          previousProductId: working.previousProductId,
          protectedElements: instruction.protectedElements,
          designableElements: DESIGNABLE_ELEMENTS.filter((e) => instruction.targets.includes(e)),
        });

        return {
          intent,
          instruction,
          result: {
            ...design,
            afterImage: generatedImage,
            creditsUsed: design.creditsUsed || creditsCostFor(instruction),
            products: matchedProducts.map((m) => ({ label: m.name ?? m.productId, productId: m.productId })),
          },
          validation: { status: validation.status, reasons: validation.reasons },
          imageEngine: engine,
          creditsCost: design.creditsUsed || creditsCostFor(instruction),
          scope: instruction.scope,
          protectedElements: instruction.protectedElements,
          placement: instruction.placement,
          requestId,
          contextSummary: contextSummary(ctx),
          selectedProduct: working.selectedProduct,
          matchedProducts,
          productResolution: resolved.resolution,
          finalContext,
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

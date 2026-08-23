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
  validateResult, resolveProtectedElements,
  type RoomElement, type DesignConstraints, type RoomUnderstanding,
} from "./roomState";
import { detectScope, isFullScope, scopeToEditStrength, type EditScope } from "./scope";
import { buildAIContext, compactContextForLlm, contextSummary, type ContextProduct } from "./context";
import { planProductPlacement, productPlacementPrompt, type PlacementProduct, type ProductPlacementPlan } from "./placement";
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
  // ---- Phase 7/8 — product-aware overlay ----
  productId?: string;
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
}

/* ---------------- Step 1: Intent ---------------- */

export async function runIntentUnderstanding(input: PipelineInput): Promise<IntentAnalysis> {
  if (input.intent && input.intent.target.length >= 0 && input.intent.intent) {
    return input.intent; // user already confirmed the reading
  }
  const effectiveTargets = [...new Set([...(input.targets ?? []), ...(input.intent?.target ?? [])])];
  const detectedScopeObj = detectScope(input.prompt, effectiveTargets, input.scope, input.targets);

  // Build the structured context BEFORE the model call (Phase 2).
  const ctx = buildAIContext({
    prompt: input.prompt,
    style: input.style,
    room: input.room,
    colors: input.colors,
    targets: effectiveTargets,
    scope: detectedScopeObj.scope,
    protectedElements: resolveProtectedElements({
      targets: effectiveTargets,
      scope: detectedScopeObj.scope,
      explicitLocked: input.preservedExtra,
    }),
    roomUnderstanding: input.roomUnderstanding,
    products: input.products as ContextProduct[] | undefined,
    budget: input.budget,
    previousTargets: input.previousTargets,
    previousChanges: input.previousChanges,
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
    // Phase 12 — only the context slice the model needs (≤ ~700 chars).
    roomContext: compactContextForLlm(ctx),
    budget: input.budget,
  };
  const { analysis } = await understandIntent(req);
  return analysis;
}

/* ---------------- Step 2: Instruction ---------------- */

export function buildDesignInstruction(input: PipelineInput, intent: IntentAnalysis): DesignInstruction {
  // Phase 4 — scope: explicit > LLM > heuristic (never widened implicitly).
  const heuristicScope = detectScope(input.prompt, [...new Set([...(input.targets ?? []), ...intent.target])], input.scope, input.targets).scope;
  const scope: EditScope = input.editScope ?? intent.scope ?? heuristicScope;
  const isFull = isFullScope(scope) || intent.intent === "full_redesign" || input.scope === "full";

  const targets = isFull
    ? (intent.target.length > 0 ? intent.target : [...DESIGNABLE_ELEMENTS])
    : (input.targets?.length && !isFull ? input.targets : [...new Set([...(input.targets ?? []), ...intent.target])]);

  // Phase 5 / Rule 6 — protected elements:
  // Structural elements (walls, floor, ceiling, windows, doors) are ALWAYS protected by default
  // even in full redesign, unless explicitly requested in targets.
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
    placement && product && productPlacementPrompt(product, placement),
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

        // 5) FINALIZE — server credits only on real completion.
        if (credit.charged && credit.generationId) {
          await finalizeCreditsForAi(credit.generationId, { durationMs: undefined, outputAssetUrl: design.afterImage });
        }

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
          products: input.products as ContextProduct[] | undefined,
          budget: input.budget,
          previousTargets: input.previousTargets,
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
          requestId,
          contextSummary: contextSummary(ctx),
        };
      } catch (err) {
        // 6) REFUND — server credits on failure (idempotent).
        if (credit.charged && credit.generationId) {
          await refundCreditsForAi(credit.generationId, err instanceof Error ? err.message : String(err));
        }
        throw err;
      }
    },
  );
}

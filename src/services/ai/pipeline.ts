// ============================================================
// HOMEINO AI DESIGN PIPELINE — SERVER-ONLY.
//
//   User Input
//     → LLM Intent Understanding        (llm/ — structured JSON, capped)
//     → Design Instruction              (targets + hard preservation rules)
//     → Image / Overlay Generation      (Orali first, provider fallback)
//     → Result Validation               (never fake success)
//     → Result Display                  (client renders PipelineResult)
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
  ALL_ELEMENTS, ELEMENT_LABELS, buildDesignConstraints, constraintsToPrompt,
  validateResult, type RoomElement, type DesignConstraints,
} from "./roomState";
import type { GeneratedDesign } from "./types";
import { uid } from "@/lib/utils";

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
}

/* ---------------- Step 1: Intent ---------------- */

export async function runIntentUnderstanding(input: PipelineInput): Promise<IntentAnalysis> {
  if (input.intent && input.intent.target.length >= 0 && input.intent.intent) {
    return input.intent; // user already confirmed the reading
  }
  const req: IntentRequest = {
    prompt: input.prompt,
    style: input.style,
    room: input.room,
    colors: input.colors,
    changeScope: input.scope,
    selectedTargets: input.scope === "targeted" ? input.targets : undefined,
  };
  const { analysis } = await understandIntent(req);
  return analysis;
}

/* ---------------- Step 2: Instruction ---------------- */

export function buildDesignInstruction(input: PipelineInput, intent: IntentAnalysis): DesignInstruction {
  const isFull = intent.intent === "full_redesign" || input.scope === "full";
  const targets = isFull ? [...ALL_ELEMENTS] : [...new Set([...(input.targets ?? []), ...intent.target])];
  const preserved = isFull
    ? []
    : ALL_ELEMENTS.filter((e) => !targets.includes(e) && !(input.preservedExtra ?? []).includes(e));

  const constraints = buildDesignConstraints({
    type: isFull ? "full_redesign" : intent.intent === "color_change" ? "color_change" : "partial_edit",
    targets,
    style: input.style,
    requestedChanges: intent.changes,
    lockedElements: preserved,
    confidence: intent.confidence,
    requiresClarification: Boolean(intent.ambiguous),
  });

  const targetLabels = targets.map((t) => ELEMENT_LABELS[t]).join(", ");
  const enginePrompt = [
    isFull
      ? `Full room redesign in ${input.style ?? "modern"} style.`
      : `Edit ONLY these elements: ${targetLabels}. Everything else must remain pixel-identical.`,
    input.prompt?.trim() && `User request: ${input.prompt.trim()}`,
    input.style && `Decor style: ${input.style}`,
    input.colors?.length && `Color palette: ${input.colors.join(", ")}`,
    input.room && `Room type: ${input.room}`,
    constraintsToPrompt(constraints),
    "Photorealistic interior photograph, consistent perspective and lighting, high detail.",
  ]
    .filter(Boolean)
    .join("\n");

  return { prompt: input.prompt, targets, preserved, style: input.style, colors: input.colors, room: input.room, constraints, enginePrompt };
}

/* ---------------- Step 3: Generation (Orali → provider) ---------------- */

async function generateVisual(input: PipelineInput, instruction: DesignInstruction): Promise<{ design: GeneratedDesign; engine: string; degraded: boolean }> {
  const orali = resolveOrali();
  if (orali && input.referenceImage) {
    try {
      const out = await orali.generateEdit({
        image: input.referenceImage,
        instruction: instruction.enginePrompt,
        mask: input.mask,
        preserveArchitecture: instruction.constraints.preserveArchitecture,
        style: instruction.style,
        colors: instruction.colors,
        strength: instruction.targets.length >= ALL_ELEMENTS.length ? 0.85 : 0.55,
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
  const useEdit = input.referenceImage && instruction.targets.length < ALL_ELEMENTS.length;
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
  const full = instruction.targets.length >= ALL_ELEMENTS.length;
  return full ? 5 : 3;
}

/* ---------------- Steps 4+5: Validate → Result ---------------- */

export async function runDesignPipeline(input: PipelineInput): Promise<PipelineResult> {
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
      type: intent.intent === "full_redesign" ? "full_redesign" : intent.intent === "color_change" ? "color_change" : "partial_edit",
      targets: instruction.targets,
      style: instruction.style,
      requestedChanges: intent.changes,
      lockedElements: instruction.preserved,
      confidence: intent.confidence,
      requiresClarification: Boolean(intent.ambiguous),
    },
    providerMarkedPreview: design.preview,
  });

  return {
    intent,
    instruction,
    result: { ...design, creditsUsed: design.creditsUsed || creditsCostFor(instruction) },
    validation: { status: validation.status, reasons: validation.reasons },
    imageEngine: engine,
    creditsCost: design.creditsUsed || creditsCostFor(instruction),
  };
}

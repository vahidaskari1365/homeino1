/**
 * User Input → LLM Intent → Design Instruction → Orali Image/Overlay
 * → Validation → Display
 */
import { llmService, type LlmUnderstandInput } from "./llm";
import { oraliClient, type OverlayMetadata } from "./orali";
import { validateResult, detectIntent } from "./roomState";
import type { StructuredIntent } from "./intentSchema";

export type AiJobState =
  | "idle"
  | "uploading"
  | "analyzing"
  | "understanding"
  | "generating"
  | "processing"
  | "success"
  | "partial-success"
  | "error"
  | "retry"
  | "no-result";

export interface DesignJobResult {
  originalImage: string;
  generatedImage: string;
  overlay: OverlayMetadata;
  intent: StructuredIntent;
  preview: boolean;
  status: "success" | "partial-success" | "no-result" | "error";
}

export async function runDesignPipeline(
  input: LlmUnderstandInput & { originalImage: string; mask?: string },
  onState?: (s: AiJobState) => void,
): Promise<DesignJobResult> {
  onState?.("understanding");
  const intent = await llmService.understandIntent(input);

  const instruction = [
    `intent=${intent.intent}`,
    `targets=${intent.target.join(",")}`,
    `changes=${intent.changes.join("; ")}`,
    `preserve=${intent.preservedElements.join(",")}`,
    `style=${intent.style ?? ""}`,
    `colors=${intent.colors.join(",")}`,
    `scope=${intent.scope}`,
    `prompt=${input.prompt}`,
  ].join(" | ");

  onState?.("generating");
  let visual;
  try {
    visual = await oraliClient.generate({
      originalImage: input.originalImage,
      instruction,
      intentJson: intent,
      mask: input.mask,
    });
  } catch {
    onState?.("error");
    return {
      originalImage: input.originalImage,
      generatedImage: input.originalImage,
      overlay: { version: 1, regions: [], preservedArchitecture: true, provider: "mock" },
      intent,
      preview: true,
      status: "error",
    };
  }

  onState?.("processing");
  const rawIntent = detectIntent(input.prompt, input.style);
  const validation = validateResult({
    beforeImage: input.originalImage,
    afterImage: visual.generatedImage,
    intent: rawIntent,
    providerMarkedPreview: visual.preview,
  });

  if (!visual.generatedImage) {
    onState?.("no-result");
    return {
      originalImage: input.originalImage,
      generatedImage: input.originalImage,
      overlay: visual.overlay,
      intent,
      preview: true,
      status: "no-result",
    };
  }

  const status =
    validation.status === "failed"
      ? "error"
      : validation.status === "preview"
        ? "partial-success"
        : "success";
  onState?.(status === "error" ? "error" : status);
  return {
    originalImage: input.originalImage,
    generatedImage: visual.generatedImage,
    overlay: visual.overlay,
    intent,
    preview: visual.preview || validation.status === "preview",
    status,
  };
}

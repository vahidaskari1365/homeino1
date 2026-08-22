import { startGeneration, completeGeneration, failGeneration } from "@/services/aiService";
import { llmProvider, imageProvider } from "./aiProviders";

/**
 * AI Orchestrator — the single server path from UI → API → orchestrator →
 * LLM → image/overlay provider → validation → DB.
 *
 * UI never talks to a provider directly; it calls /api/ai/generate which goes
 * through here. Room preservation (target/preserved/requested) is carried in
 * the structured intent.
 */
export async function runGeneration(params: {
  userId: string;
  designId?: string;
  productId?: string;
  prompt: string;
  mode: string;
  image?: string; // original image (URL or data) for edit modes
  mask?: string;
}) {
  // 1) classify intent via LLM (structured, short)
  const llm = llmProvider();
  const intent = params.prompt
    ? await llm.classifyIntent(params.prompt, `mode:${params.mode}`)
    : { intent: params.mode, confidence: 0.5 };

  // 2) charge credits + persist generation (transactional)
  const generation = await startGeneration(params.userId, {
    designId: params.designId,
    productId: params.productId,
    prompt: params.prompt,
    mode: params.mode,
    intent,
  });

  const startedAt = Date.now();
  try {
    if (!params.image || params.mode === "decor-suggest" || params.mode === "full-concept") {
      // no visual edit required — complete without an output asset
      await completeGeneration(generation.id, { durationMs: Date.now() - startedAt });
      return { generation, intent };
    }

    // 3) image edit via provider (Orali or honest mock)
    const provider = imageProvider();
    const output = await provider.edit({
      image: params.image,
      prompt: params.prompt,
      intent,
      mask: params.mask,
    });

    // 4) store + complete
    await completeGeneration(generation.id, {
      outputAssetUrl: output.resultUrl,
      overlayMetadata: output.overlay as never,
      durationMs: Date.now() - startedAt,
    });
    return { generation, intent, output };
  } catch (err) {
    const message = err instanceof Error ? err.message : "generation failed";
    await failGeneration(generation.id, message);
    throw err;
  }
}

import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { aiAssets, aiDesigns, aiGenerations, aiUsage } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { priceOf, spendCredits } from "./creditService";

/**
 * Server-side AI persistence + credit charging.
 * UI never mutates these rows directly — it only calls the API.
 */

export interface CreateDesignInput {
  userId: string;
  name?: string;
  mode: string;
  prompt?: string;
  roomType?: string;
  style?: string;
}

export async function createDesign(userId: string, input: CreateDesignInput) {
  const db = getDb();
  const [design] = await db
    .insert(aiDesigns)
    .values({
      userId,
      name: input.name ?? "طراحی بدون نام",
      mode: input.mode,
      prompt: input.prompt,
      roomType: input.roomType,
      style: input.style,
      status: "processing",
    })
    .returning();
  return design;
}

export interface CreateGenerationInput {
  designId?: string;
  productId?: string;
  prompt: string;
  mode: string;
  intent?: AiIntent;
}

export interface AiIntent {
  intent: string;
  target?: string;
  requestedChanges?: string[];
  preservedElements?: string[];
  style?: string | null;
  colors?: string[];
  confidence?: number;
}

/**
 * Starts a generation: charges credits FIRST (atomic), then records the
 * generation. If the generation later fails, credits are refunded via grant.
 */
export async function startGeneration(userId: string, input: CreateGenerationInput) {
  const db = getDb();
  const cost = priceOf(input.mode);

  // charge credits transactionally before doing any work
  await spendCredits(userId, cost, {
    operation: `generation:${input.mode}`,
    referenceType: "ai_design",
    note: input.prompt.slice(0, 120),
  });

  const [generation] = await db
    .insert(aiGenerations)
    .values({
      userId,
      designId: input.designId ?? null,
      productId: input.productId ?? null,
      prompt: input.prompt,
      intent: input.intent ?? null,
      target: input.intent?.target,
      preservedElements: input.intent?.preservedElements ?? [],
      requestedChanges: input.intent?.requestedChanges ?? [],
      provider: "orchestrator",
      status: "running",
      creditCost: cost,
    })
    .returning();

  await db.insert(aiUsage).values({
    userId,
    generationId: generation.id,
    provider: "orchestrator",
    action: input.mode,
    creditCost: cost,
  });

  // mark the parent design completed
  if (input.designId) {
    await db.update(aiDesigns).set({ status: "completed" }).where(eq(aiDesigns.id, input.designId));
  }
  return generation;
}

export async function completeGeneration(
  generationId: string,
  data: {
    outputAssetId?: string;
    outputAssetUrl?: string;
    overlayAssetUrl?: string;
    maskAssetUrl?: string;
    durationMs?: number;
    overlayMetadata?: Record<string, unknown>;
  },
) {
  const db = getDb();
  const [gen] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, generationId)).limit(1);
  if (!gen) throw ApiError.notFound("generation یافت نشد");

  const outputAssetId = data.outputAssetId ?? (data.outputAssetUrl ? (await createAsset(gen.userId, "generated", data.outputAssetUrl)).id : gen.outputAssetId);
  const overlayAssetId = data.overlayAssetUrl ? (await createAsset(gen.userId, "overlay", data.overlayAssetUrl)).id : gen.overlayAssetId;
  const maskAssetId = data.maskAssetUrl ? (await createAsset(gen.userId, "mask", data.maskAssetUrl)).id : gen.maskAssetId;

  const [g] = await db
    .update(aiGenerations)
    .set({
      status: "succeeded",
      outputAssetId,
      overlayAssetId,
      maskAssetId,
      overlayMetadata: data.overlayMetadata as never,
      durationMs: data.durationMs,
      completedAt: new Date(),
    })
    .where(eq(aiGenerations.id, generationId))
    .returning();
  return g;
}

async function createAsset(ownerId: string, kind: string, url: string) {
  const db = getDb();
  const [asset] = await db
    .insert(aiAssets)
    .values({ ownerId, kind: kind as never, url })
    .returning();
  return asset;
}

export async function failGeneration(generationId: string, error: string) {
  const db = getDb();
  const [gen] = await db.select().from(aiGenerations).where(eq(aiGenerations.id, generationId)).limit(1);
  if (!gen) return;
  await db
    .update(aiGenerations)
    .set({ status: "failed", error, completedAt: new Date() })
    .where(eq(aiGenerations.id, generationId));
  // refund the charged credits when a generation failed
  if (gen.creditCost > 0) {
    await spendRefundForFailed(gen.userId, gen.creditCost, generationId);
  }
}

async function spendRefundForFailed(userId: string, amount: number, generationId: string) {
  // refund via the credit grant path
  const { grantCredits } = await import("./creditService");
  await grantCredits(userId, amount, {
    type: "refund",
    operation: `generation_failed_refund:${generationId}`,
    referenceType: "ai_generation",
    referenceId: generationId,
    idempotencyKey: `refund-${generationId}`,
  });
}

export async function listDesigns(userId: string) {
  const db = getDb();
  return db
    .select()
    .from(aiDesigns)
    .where(eq(aiDesigns.userId, userId))
    .orderBy(desc(aiDesigns.createdAt));
}

export async function getDesign(userId: string, designId: string) {
  const db = getDb();
  const [design] = await db
    .select()
    .from(aiDesigns)
    .where(eq(aiDesigns.id, designId))
    .limit(1);
  if (!design || design.userId !== userId) throw ApiError.notFound("طراحی یافت نشد");
  const generations = await db
    .select()
    .from(aiGenerations)
    .where(eq(aiGenerations.designId, designId))
    .orderBy(desc(aiGenerations.createdAt));
  return { ...design, generations };
}
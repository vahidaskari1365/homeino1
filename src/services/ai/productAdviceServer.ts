// ============================================================
// HOMEINO — DB-BACKED PRODUCT ADVICE (server)
//
// The live-database twin of productAdvice.buildProductAdvice:
// resolves the product from the REAL catalog (Supabase when
// configured, shipped mock catalog otherwise), scores companions
// from the same pool, then runs the SAME pure advice core.
// This is what /api/ai action="advice" serves to the AI panel —
// so PDP quick questions stay correct when vendors add products,
// change prices or restock in the database.
// ============================================================
import { detectAdviceTopic, buildAdviceFor, type AdviceTopic, type AdviceCard } from "./productAdvice";
import { productsRepository, stylesRepository } from "@/repositories";
import { scoreSimilarProducts } from "@/lib/similarProducts";

export interface ProductAdviceResult {
  text: string;
  products?: AdviceCard[];
}

/** Accept both a detected topic (Persian/English free text) and the
 *  canonical keys the PDP chips send ("pair" | "color" | "style"). */
function normalizeTopic(topic: string): AdviceTopic | null {
  const clean = String(topic ?? "").trim().toLowerCase();
  if (clean === "pair" || clean === "color" || clean === "style") return clean;
  return detectAdviceTopic(clean);
}

/**
 * Resolve a grounded PDP answer from the live catalog.
 * `bySku` matches sku OR id OR slug, so every identifier the UI sends
 * (static ids, DB uuids, slugs) resolves through one call. Returns null
 * when the product or topic is unknown — the caller falls back.
 */
export async function resolveProductAdvice(topic: string, slugOrId: string): Promise<ProductAdviceResult | null> {
  const t = normalizeTopic(topic);
  const key = String(slugOrId ?? "").trim();
  if (!t || !key) return null;

  const product = await productsRepository.bySku(key);
  if (!product) return null;

  const [styles, pool] = await Promise.all([stylesRepository.list(), productsRepository.list()]);
  return buildAdviceFor(t, product, {
    styles,
    similar: scoreSimilarProducts(product, pool, 12),
  });
}

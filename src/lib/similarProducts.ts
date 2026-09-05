// ============================================================
// HOMEINO — STYLE-OVERLAP SIMILARITY (pure, shared)
//
// One scoring rule for "products that go together" everywhere:
//   shared styles × 2 + same category + same store
// The static mock catalog (data/products.ts) and the DB-backed
// repositories (repositories/products.ts) + agent advice engine all
// use THIS implementation, so recommendations never disagree
// between client, server and agents.
// ============================================================
import type { Product } from "@/types";

export interface SimilarityTarget {
  id: string;
  styleSlugs: string[];
  categorySlug?: string;
  storeId?: string;
}

export function scoreSimilarProducts<T extends Product>(target: SimilarityTarget, pool: T[], take = 4): T[] {
  return pool
    .filter((p) => p.id !== target.id)
    .map((p) => {
      const sharedStyles = (p.styleSlugs ?? []).filter((s) => target.styleSlugs?.includes(s)).length;
      const sameCategory = p.categorySlug === target.categorySlug ? 1 : 0;
      const sameStore = p.storeId === target.storeId ? 1 : 0;
      return { p, score: sharedStyles * 2 + sameCategory + sameStore };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id))
    .slice(0, Math.max(1, take))
    .map((x) => x.p);
}

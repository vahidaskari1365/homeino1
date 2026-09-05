// ============================================================
// AI DESIGN STUDIO — pure helpers (extracted verbatim from the
// former single-file design page). No visual/behaviour change.
// ============================================================
import type { RoomElement } from "@/services/ai/roomState";
import { categoryToRoomElement } from "@/services/ai/roomState";
import type { ProductPlacementPlan } from "@/services/ai/placement";
import type { PipelineResult } from "@/services/ai/pipeline";
import type { Product } from "@/types";
import type { Placement } from "@/components/ProductOverlay";

/** Map real selected products back to RoomElement vocabulary for pipeline targeting. */
export function deriveTargetsFromProducts(productsArr: Product[]): RoomElement[] {
  const out = new Set<RoomElement>();
  for (const p of productsArr) {
    const cat = (p.categorySlug ?? "").toLowerCase();
    const name = p.name.toLowerCase();
    out.add(categoryToRoomElement(cat, `${p.subCategorySlug ?? ""} ${name}`));
  }
  return [...out];
}

/** Translate the pipeline placement plan into ProductOverlay Placement[] coords (0..1). */
export function buildPlacementsFromPlan(productsArr: Product[], plan: ProductPlacementPlan): Placement[] {
  // If there's a single product match by productId, use it; otherwise apply to first.
  const target = productsArr.find((p) => p.id === plan.productId) ?? productsArr[0];
  const rest = productsArr.filter((p) => p.id !== target.id);
  const placements: Placement[] = [];
  // Anchor point: center of the target region.
  const cx = plan.targetRegion.x + plan.targetRegion.width / 2;
  const cy = plan.targetRegion.y + plan.targetRegion.height / 2;
  placements.push({
    product: target,
    xNorm: Math.min(0.95, Math.max(0.05, cx)),
    yNorm: Math.min(0.95, Math.max(0.05, cy)),
    scale: Math.min(2, Math.max(0.3, plan.scale)),
    rotation: plan.rotation,
  });
  // Lay out any extra products deterministically around the main placement.
  rest.forEach((p, idx) => {
    const angle = ((idx + 1) * Math.PI * 2) / Math.max(1, rest.length);
    const r = 0.22;
    placements.push({
      product: p,
      xNorm: Math.min(0.95, Math.max(0.05, cx + Math.cos(angle) * r)),
      yNorm: Math.min(0.95, Math.max(0.05, cy + Math.sin(angle) * r)),
      scale: 0.85,
      rotation: 0,
    });
  });
  return placements;
}

/** Persian summary string surfaced in the existing scope card — UI shape unchanged. */
export function buildScopeSummary(
  res: PipelineResult,
  fallback: { targets: RoomElement[]; summary: string; lockedElements: RoomElement[] },
): string {
  const targets = res.instruction.targets.length ? res.instruction.targets : fallback.targets;
  if (res.scope === "whole_home") return "بازطراحی کل خانه — همه چیز قابل تغییر است";
  if (res.scope === "room") return "بازطراحی کل اتاق";
  if (res.scope === "area") return `ناحیه ${targets.join("، ")} تغییر می‌کند`;
  return fallback.summary;
}

/** Deterministic 2D grid for the overlay when the engine returns no plan. */
export function makePlacements(prods: Product[]): Placement[] {
  const n = prods.length; if (!n) return [];
  return prods.map((p, i) => { const cols = Math.min(n, 3); const col = i % cols; const row = Math.floor(i / cols); const rows = Math.ceil(n / cols); const x = cols === 1 ? 0.5 : 0.22 + (0.56 * col) / (cols - 1); const y = rows === 1 ? 0.62 : 0.42 + (0.4 * row) / Math.max(1, rows - 1); return { product: p, xNorm: x, yNorm: y, scale: 1 }; });
}

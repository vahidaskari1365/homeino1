// ============================================================
// HOMEINO AI — CONTEXT ENGINE  (Phase 2 / 3 / 5 / 12 / 15)
//
// The AI never receives only a raw prompt. Every request gets a
// STRUCTURED context built BEFORE the model call:
//
//   AIContext = room + existingObjects + userIntent + style
//             + products + budget + previousState
//
// Token efficiency (Phase 12): only the slices the model actually
// needs are serialized — static catalog data is never re-sent and
// product lists are filtered to the request's target categories.
// ============================================================

import type { RoomElement, RoomArchitecture, RoomUnderstanding } from "./roomState";
import { PROTECTED_STRUCTURAL_ELEMENTS, ELEMENT_LABELS } from "./roomState";
import type { EditScope } from "./scope";
import { EDIT_SCOPE_LABELS } from "./scope";

/** Minimal product info used for product-aware prompting (Phase 7). */
export interface ContextProduct {
  id: string;
  name?: string;
  category?: string;
  material?: string;
  color?: string;
  style?: string;
  sku?: string;
  storeId?: string;
  image?: string;
  dimensions?: { width?: number; height?: number; depth?: number };
  price?: number;
}

/** Real selected / SKU-resolved product that must reach the image pipeline. */
export interface SelectedProductContext {
  id: string;
  sku?: string;
  name?: string;
  category?: string;
  storeId?: string;
  image?: string;
}

export interface AIContext {
  room: {
    type?: string;
    /** Compact Persian label, e.g. «پذیرایی». */
    label?: string;
    dimensions?: unknown;
    layout?: RoomUnderstanding["layout"];
    architecture?: RoomArchitecture;
  };
  existingObjects: RoomUnderstanding["objects"];
  userIntent: {
    action: string;
    scope: EditScope;
    /** Elements the user wants changed (empty = inquiry). */
    targets: RoomElement[];
    requestedChanges: string[];
    protectedElements: RoomElement[];
  };
  style?: { id: string; name: string };
  analysisContext?: {
    likelyStyle?: string;
    confidence?: number;
    emptySpaces?: string[];
    functionalIssues?: string[];
    designOpportunities?: string[];
  };
  products?: ContextProduct[];
  budget?: { min?: number; max?: number; currency?: string };
  previousState?: {
    /** Short label of the last change, e.g. «تعویض مبل». */
    lastAction?: string;
    lastTargets: RoomElement[];
    lastChanges: string[];
  };
  selectedProduct?: SelectedProductContext;
  productCode?: string;
  sku?: string;
  previousSku?: string;
  previousProductId?: string;
  description?: string;
  /** ISO timestamp — for debugging context freshness. */
  createdAt: string;
}

export interface BuildContextInput {
  prompt: string;
  style?: string;
  styleLabel?: string;
  room?: string;
  colors?: string[];
  targets: RoomElement[];
  scope: EditScope;
  protectedElements: RoomElement[];
  roomUnderstanding?: RoomUnderstanding;
  products?: ContextProduct[];
  budget?: { min?: number; max?: number; currency?: string };
  previousTargets?: RoomElement[];
  previousChanges?: string[];
  previousLabel?: string;
  selectedProduct?: SelectedProductContext;
  productCode?: string;
  sku?: string;
  previousSku?: string;
  previousProductId?: string;
}

/** Build the full structured context for one AI request. */
export function buildAIContext(input: BuildContextInput): AIContext {
  const roomType = input.roomUnderstanding?.roomType ?? input.room;
  // User style overrides analyzed style (Rule 14: USER OVERRIDES ANALYSIS)
  const resolvedStyle = input.style
    ? { id: input.style, name: input.styleLabel ?? input.style }
    : input.roomUnderstanding?.likelyStyle
      ? { id: input.roomUnderstanding.likelyStyle.style, name: input.roomUnderstanding.likelyStyle.style }
      : undefined;

  const analysisContext = input.roomUnderstanding
    ? {
        likelyStyle: input.roomUnderstanding.likelyStyle?.style ?? input.roomUnderstanding.style,
        confidence: input.roomUnderstanding.likelyStyle?.confidence ?? input.roomUnderstanding.confidence,
        emptySpaces: input.roomUnderstanding.emptySpaces,
        functionalIssues: input.roomUnderstanding.functionalIssues,
        designOpportunities: input.roomUnderstanding.designOpportunities,
      }
    : undefined;

  return {
    room: {
      type: roomType,
      label: roomType ? ELEMENT_LABELS[roomType as RoomElement] ?? roomType : undefined,
      layout: input.roomUnderstanding?.layout,
      architecture: input.roomUnderstanding?.architecture,
    },
    existingObjects: input.roomUnderstanding?.objects ?? [],
    userIntent: {
      action: input.prompt.trim().slice(0, 200),
      scope: input.scope,
      targets: input.targets,
      requestedChanges: [],
      protectedElements: input.protectedElements,
    },
    style: resolvedStyle,
    analysisContext,
    products: input.products?.length ? input.products.slice(0, 12) : undefined,
    selectedProduct: input.selectedProduct,
    productCode: input.productCode,
    sku: input.sku ?? input.selectedProduct?.sku,
    previousSku: input.previousSku,
    previousProductId: input.previousProductId,
    description: input.prompt.trim() || undefined,
    budget: input.budget,
    previousState:
      input.previousTargets?.length || input.previousChanges?.length
        ? {
            lastAction: input.previousLabel,
            lastTargets: input.previousTargets ?? [],
            lastChanges: input.previousChanges ?? [],
          }
        : undefined,
    createdAt: new Date().toISOString(),
  };
}

/** Elements the model may safely ignore while reasoning (structural). */
export const CONTEXT_STRUCTURAL_HINTS = PROTECTED_STRUCTURAL_ELEMENTS;

// ============================================================
// COMPACT SERIALIZATION — token efficiency (Phase 12)
// ============================================================

export interface CompactContextOptions {
  /** Max JSON length for the LLM context slice (default ~700 chars). */
  maxLength?: number;
  /** Include products only when the request targets their category. */
  filterProducts?: boolean;
}

/** Map an element to plausible catalog categories (kept in sync with matchProducts). */
const ELEMENT_CATEGORIES: Record<string, string[]> = {
  sofa: ["furniture"], rug: ["rugs"], curtain: ["textiles"], lighting: ["lighting"],
  wall: ["decor"], floor: ["rugs"], ceiling: ["lighting"], table: ["furniture"],
  chair: ["furniture"], tv: ["furniture"], plant: ["decor", "outdoor"], art: ["decor"],
  door: [], window: [], shelf: ["furniture"], bed: ["bedroom"],
};

/**
 * Serialize ONLY the context the model needs for this request —
 * small, structured, deterministic. Never includes full catalogs,
 * base64 images, or secrets.
 */
export function compactContextForLlm(ctx: AIContext, opts?: CompactContextOptions): string {
  const max = opts?.maxLength ?? 700;

  const parts: string[] = [];
  parts.push(`room:${ctx.room.type ?? "unknown"}`);
  if (ctx.room.layout && ctx.room.layout !== "unknown") parts.push(`layout:${ctx.room.layout}`);
  if (ctx.room.architecture) {
    const a = ctx.room.architecture;
    if (a.windows) parts.push(`windows:${a.windows}`);
    if (a.doors) parts.push(`doors:${a.doors}`);
  }
  if (ctx.style) parts.push(`style:${ctx.style.id}`);
  if (ctx.existingObjects.length) {
    parts.push(`objects:[${ctx.existingObjects.slice(0, 8).map((o) => o.type).join(",")}]`);
  }
  parts.push(`scope:${ctx.userIntent.scope}`);
  parts.push(`protected:[${ctx.userIntent.protectedElements.slice(0, 6).join(",")}]`);
  if (ctx.sku) parts.push(`sku:${ctx.sku}`);
  if (ctx.selectedProduct?.id) parts.push(`selectedProduct:${ctx.selectedProduct.id}`);
  if (ctx.previousState) {
    parts.push(
      `prev:{targets:[${ctx.previousState.lastTargets.join(",")}],changes:${JSON.stringify(ctx.previousState.lastChanges.slice(0, 2))}}`,
    );
  }

  // Product slice (Phase 12) — only categories the CURRENT TARGETS care
  // about. If the request isn't about a concrete element, no catalog info
  // is sent at all (a sofa question never ships the whole catalog).
  let products: ContextProduct[] = [];
  if (ctx.products?.length) {
    if (opts?.filterProducts === false) {
      products = ctx.products;
    } else {
      const wanted = new Set<string>();
      ctx.userIntent.targets.forEach((t) => ELEMENT_CATEGORIES[t]?.forEach((c) => wanted.add(c)));
      if (wanted.size === 0) {
        products = []; // no concrete target → do not send catalog noise
      } else {
        products = ctx.products.filter((p) => !p.category || wanted.has(p.category));
      }
    }
  }
  if (products.length) {
    parts.push(
      `products:[${products.slice(0, 4).map((p) => `${p.id}:${p.category ?? "?"}`).join(",")}]`,
    );
  }
  if (ctx.budget) {
    parts.push(`budget:${ctx.budget.max ? `<=${ctx.budget.max}` : ctx.budget.min ? `>=${ctx.budget.min}` : ""}`);
  }

  const joined = `{${parts.join(";")}}`;
  return joined.length > max ? joined.slice(0, max) : joined;
}

/** Short Persian summary of the context (used for the change plan + logs). */
export function contextSummary(ctx: AIContext): string {
  const scope = EDIT_SCOPE_LABELS[ctx.userIntent.scope];
  const protectedCount = ctx.userIntent.protectedElements.length;
  return `scope=${scope}; protected=${protectedCount} item(s); prev=${ctx.previousState ? `yes(${ctx.previousState.lastTargets.length} target(s))` : "no"}`;
}

/**
 * Final AI context sent into the pipeline — ONLY fields that actually exist.
 * Shape follows spec §20 (room, selection, target, sku, previousTargets, …).
 */
export function buildFinalAiContext(input: {
  room?: AIContext["room"];
  roomAnalysis?: AIContext["analysisContext"];
  selection?: { targets?: RoomElement[]; slugs?: string[] };
  target?: RoomElement[];
  scope?: EditScope;
  style?: AIContext["style"];
  colors?: string[];
  description?: string;
  selectedProduct?: SelectedProductContext;
  productCode?: string;
  sku?: string;
  previousTargets?: RoomElement[];
  previousSku?: string;
  previousProductId?: string;
  protectedElements?: RoomElement[];
  designableElements?: RoomElement[];
}): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.room && Object.values(input.room).some((v) => v !== undefined)) out.room = input.room;
  if (input.roomAnalysis) out.roomAnalysis = input.roomAnalysis;
  if (input.selection && (input.selection.targets?.length || input.selection.slugs?.length)) out.selection = input.selection;
  if (input.target?.length) out.target = input.target;
  if (input.scope) out.scope = input.scope;
  if (input.style) out.style = input.style;
  if (input.colors?.length) out.colors = input.colors;
  if (input.description) out.description = input.description;
  if (input.selectedProduct) out.selectedProduct = input.selectedProduct;
  if (input.productCode) out.productCode = input.productCode;
  if (input.sku) out.sku = input.sku;
  if (input.previousTargets?.length) out.previousTargets = input.previousTargets;
  if (input.previousSku) out.previousSku = input.previousSku;
  if (input.previousProductId) out.previousProductId = input.previousProductId;
  if (input.protectedElements?.length) out.protectedElements = input.protectedElements;
  if (input.designableElements?.length) out.designableElements = input.designableElements;
  return out;
}

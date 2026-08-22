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
  dimensions?: { width?: number; height?: number; depth?: number };
  price?: number;
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
  products?: ContextProduct[];
  budget?: { min?: number; max?: number; currency?: string };
  previousState?: {
    /** Short label of the last change, e.g. «تعویض مبل». */
    lastAction?: string;
    lastTargets: RoomElement[];
    lastChanges: string[];
  };
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
}

/** Build the full structured context for one AI request. */
export function buildAIContext(input: BuildContextInput): AIContext {
  const roomType = input.roomUnderstanding?.roomType ?? input.room;
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
    style: input.style ? { id: input.style, name: input.styleLabel ?? input.style } : undefined,
    products: input.products?.length ? input.products.slice(0, 12) : undefined,
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

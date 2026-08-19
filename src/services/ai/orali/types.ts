// ============================================================
// ORALI — VISUAL GENERATION LAYER (client-safe, pure types).
//
// Orali is the REAL image/overlay engine of the AI pipeline:
//   Design Instruction → Orali edit → result + overlay metadata
//
// The UI renders from OverlayRegion metadata only — it never
// fakes an overlay. When Orali is not configured the pipeline
// degrades to the base provider and honestly marks preview.
// ============================================================

/** Normalized bounding box (0..1 of image width/height, origin top-left). */
export interface OverlayBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * A region of the generated result that was actually changed.
 * Produced by the image engine (Orali) — the UI renders these as
 * an editable/inspectable layer above the result image.
 */
export interface OverlayRegion {
  id: string;
  /** Short Persian label, e.g. «مبل». */
  label: string;
  /** Element vocabulary key (sofa, wall, rug, …) when known. */
  element?: string;
  box: OverlayBox;
  /** Optional base64 PNG mask (white = edited area). */
  mask?: string;
  opacity?: number;
  status?: "applied" | "failed";
}

export interface OraliEditRequest {
  /** Base64 data-URL of the room image to edit. */
  image: string;
  /** Compiled design instruction (English, engine-facing). */
  instruction: string;
  /** Optional base64 PNG mask — edit ONLY inside the mask. */
  mask?: string;
  /** Hard preservation rule — architecture must survive. */
  preserveArchitecture: boolean;
  style?: string;
  colors?: string[];
  /** 0..1 — how much artistic freedom the engine may take. */
  strength?: number;
}

export interface OraliEditResult {
  /** Result image: data-URL or remote URL. */
  image: string;
  /** Regions the engine reports as changed (overlay metadata). */
  regions: OverlayRegion[];
  model: string;
  latencyMs?: number;
}

export interface OraliClient {
  readonly name: "orali";
  readonly configured: boolean;
  generateEdit(req: OraliEditRequest): Promise<OraliEditResult>;
}

export class OraliNotConfiguredError extends Error {
  constructor() {
    super("ORALI_NOT_CONFIGURED");
    this.name = "OraliNotConfiguredError";
  }
}

export class OraliRequestError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "OraliRequestError";
  }
}

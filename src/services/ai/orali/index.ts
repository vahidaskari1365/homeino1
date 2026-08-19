// ============================================================
// ORALI RESOLVER — single entry point for the pipeline.
// Returns the real client when configured, null otherwise
// (the pipeline then degrades to the base image provider).
// ============================================================
import { oraliClient, isOraliConfigured } from "./oraliClient";
import type { OraliClient as IOraliClient } from "./types";

export type { OraliClient, OraliEditRequest, OraliEditResult, OverlayRegion, OverlayBox } from "./types";
export { OraliNotConfiguredError, OraliRequestError } from "./types";
export { oraliClient, isOraliConfigured };

export function resolveOrali(): IOraliClient | null {
  return isOraliConfigured() ? oraliClient : null;
}

"use client";
import { useSyncExternalStore } from "react";
import { subscribeVendorSession, vendorSessionVersion } from "@/data/vendorSession";

/**
 * Re-renders the caller whenever the vendor demo session changes — the
 * one-time post-hydration restore from localStorage and every mutation.
 *
 * Returns 0 during SSR and the hydration render, so the first client paint
 * shows the same seed state the server rendered; the persisted snapshot
 * (products / order statuses / store profile) lands one frame later with
 * zero hydration mismatch.
 */
export function useVendorSessionVersion(): number {
  return useSyncExternalStore(subscribeVendorSession, vendorSessionVersion, () => 0);
}

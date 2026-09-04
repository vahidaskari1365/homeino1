"use client";
import { useSyncExternalStore } from "react";

const emptySubscribe = () => () => {};

/** Distinguishes SSR/first paint from client hydration without an effect. */
export function useHasHydrated(): boolean {
  return useSyncExternalStore(emptySubscribe, () => true, () => false);
}

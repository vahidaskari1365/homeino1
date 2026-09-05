"use client";
import { useSyncExternalStore } from "react";
import { dataSyncHub } from "@/data/crossTab";

// Global version counter bumped on every cross-tab data change
// (storage event / BroadcastChannel under `homeino-*` keys).
let version = 0;
const subscribers = new Set<() => void>();

const subscribeDataVersion = (cb: () => void) => {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
};

// Wire the singleton hub once per client bundle. SSR never reaches this,
// so the server snapshot stays a constant 0 (hydration-safe).
if (typeof window !== "undefined") {
  dataSyncHub.subscribe((key) => {
    version += 1;
    subscribers.forEach((fn) => fn());
    void key;
  });
}

/**
 * Re-renders the caller whenever Homeino's localStorage data layer is
 * mutated from ANOTHER tab (orders, ads, addresses, cart, wishlist, ...).
 * Returns 0 during SSR/hydration — pair with `useHasHydrated()` reads.
 *
 * Usage: call it once inside any component that renders a snapshot from
 * the local data layer (`listAllSecondHandAds()`, `listLocalOrders()`, ...)
 * so switching tabs shows live data instead of a stale render.
 */
export function useDataVersion(): number {
  return useSyncExternalStore(subscribeDataVersion, () => version, () => 0);
}

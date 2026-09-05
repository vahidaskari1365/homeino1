/**
 * Single owner of persisted-store rehydration.
 *
 * Every zustand `persist` store in this app is created with
 * `skipHydration: true` so the first client render matches the SSR HTML
 * (no hydration mismatch on cart/wishlist/credit badges). GlobalChrome —
 * which is mounted exactly once, app-wide — calls `rehydratePersistedStores()`
 * right after mount; persisted state then lands before the user can interact.
 */
export function rehydratePersistedStores(): void {
  if (typeof window === "undefined") return;
  // Imported lazily by GlobalChrome to keep this module side-effect free.
  void import("./useShop").then(({ useCart, useWishlist, useCompare, useRecentlyViewed, useCollections }) => {
    useCart.persist.rehydrate();
    useWishlist.persist.rehydrate();
    useCompare.persist.rehydrate();
    useRecentlyViewed.persist.rehydrate();
    useCollections.persist.rehydrate();
  });
  void import("./useApp").then(({ useAuth, useCredits, useChat }) => {
    useAuth.persist.rehydrate();
    useCredits.persist.rehydrate();
    useChat.persist.rehydrate();
  });
  void import("./useDesignSessions").then(({ useDesignSessions }) => {
    useDesignSessions?.persist?.rehydrate();
  });
}

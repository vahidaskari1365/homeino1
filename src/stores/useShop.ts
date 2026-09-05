"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, UserCollection } from "@/types";
import { trackEvent } from "@/lib/tracking";
import { addCartItem, cartCount, removeCartItem, setCartQty } from "@/lib/cartMath";

/* ---------------- CART (multi-vendor aware) ---------------- */
interface CartState {
  items: CartItem[];
  add: (productId: string, qty?: number, offerId?: string) => void;
  remove: (productId: string, offerId?: string) => void;
  setQty: (productId: string, qty: number, offerId?: string) => void;
  clear: () => void;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (productId, qty = 1, offerId) => {
        // Real behavior event → analytics_events → agentic workflows.
        void trackEvent("cart_add", { entityType: "product", entityId: productId, metadata: { qty, offerId: offerId ?? null } });
        set((s) => ({ items: addCartItem(s.items, productId, qty, offerId) }));
      },
      remove: (productId, offerId) => {
        void trackEvent("cart_remove", { entityType: "product", entityId: productId, metadata: { offerId: offerId ?? null } });
        set((s) => ({ items: removeCartItem(s.items, productId, offerId) }));
      },
      setQty: (productId, qty, offerId) => {
        if (qty <= 0) void trackEvent("cart_remove", { entityType: "product", entityId: productId, metadata: { offerId: offerId ?? null } });
        set((s) => ({ items: setCartQty(s.items, productId, qty, offerId) }));
      },
      clear: () => set({ items: [] }),
      count: () => cartCount(get().items),
    }),
    { name: "homeino-cart", skipHydration: true }
  )
);

/* ---------------- WISHLIST (multi-type) ---------------- */
interface WishlistState {
  products: string[];
  inspirations: string[];
  designs: string[];
  stores: string[];
  toggleProduct: (id: string) => void;
  toggleInspiration: (id: string) => void;
  toggleDesign: (id: string) => void;
  toggleStore: (id: string) => void;
  hasProduct: (id: string) => boolean;
  total: () => number;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      products: [],
      inspirations: [],
      designs: [],
      stores: [],
      toggleProduct: (id) => {
        // wishlist_add drives the "similar products" workflow.
        void trackEvent(get().products.includes(id) ? "wishlist_remove" : "wishlist_add", { entityType: "product", entityId: id });
        set((s) => ({
          products: s.products.includes(id)
            ? s.products.filter((x) => x !== id)
            : [...s.products, id],
        }));
      },
      toggleInspiration: (id) =>
        set((s) => ({
          inspirations: s.inspirations.includes(id)
            ? s.inspirations.filter((x) => x !== id)
            : [...s.inspirations, id],
        })),
      toggleDesign: (id) =>
        set((s) => ({
          designs: s.designs.includes(id)
            ? s.designs.filter((x) => x !== id)
            : [...s.designs, id],
        })),
      toggleStore: (id) => {
        if (!get().stores.includes(id)) void trackEvent("store_followed", { entityType: "store", entityId: id });
        set((s) => ({
          stores: s.stores.includes(id)
            ? s.stores.filter((x) => x !== id)
            : [...s.stores, id],
        }));
      },
      hasProduct: (id) => get().products.includes(id),
      total: () =>
        get().products.length +
        get().inspirations.length +
        get().designs.length +
        get().stores.length,
    }),
    { name: "homeino-wishlist", skipHydration: true }
  )
);

/* ---------------- COMPARE ---------------- */
interface CompareState {
  ids: string[];
  toggle: (id: string) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
}

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      ids: [],
      toggle: (id) =>
        set((s) => {
          if (s.ids.includes(id)) return { ids: s.ids.filter((x) => x !== id) };
          if (s.ids.length >= 4) return { ids: [...s.ids.slice(1), id] };
          return { ids: [...s.ids, id] };
        }),
      remove: (id) => set((s) => ({ ids: s.ids.filter((x) => x !== id) })),
      clear: () => set({ ids: [] }),
      has: (id) => get().ids.includes(id),
    }),
    { name: "homeino-compare", skipHydration: true }
  )
);

/* ---------------- RECENTLY VIEWED ---------------- */
interface RecentlyViewedState {
  productIds: string[];
  track: (id: string) => void;
  clear: () => void;
}

export const useRecentlyViewed = create<RecentlyViewedState>()(
  persist(
    (set, get) => ({
      productIds: [],
      track: (id) => {
        const cur = get().productIds.filter((x) => x !== id);
        // product_view is the primary signal for the Customer Intelligence agent.
        void trackEvent("product_view", { entityType: "product", entityId: id });
        set({ productIds: [id, ...cur].slice(0, 12) });
      },
      clear: () => set({ productIds: [] }),
    }),
    { name: "homeino-recent", skipHydration: true }
  )
);

/* ---------------- USER COLLECTIONS ---------------- */
interface CollectionsState {
  collections: UserCollection[];
  createCollection: (title: string, description?: string) => string;
  removeCollection: (id: string) => void;
  addProduct: (collectionId: string, productId: string) => void;
  removeProduct: (collectionId: string, productId: string) => void;
  hasProduct: (collectionId: string, productId: string) => boolean;
}

export const useCollections = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      createCollection: (title, description) => {
        const id = `collection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const collection: UserCollection = {
          id,
          title: title.trim(),
          description: description?.trim() || undefined,
          productIds: [],
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ collections: [collection, ...state.collections] }));
        return id;
      },
      removeCollection: (id) => set((state) => ({ collections: state.collections.filter((collection) => collection.id !== id) })),
      addProduct: (collectionId, productId) => set((state) => ({
        collections: state.collections.map((collection) => collection.id === collectionId && !collection.productIds.includes(productId)
          ? { ...collection, productIds: [...collection.productIds, productId] }
          : collection),
      })),
      removeProduct: (collectionId, productId) => set((state) => ({
        collections: state.collections.map((collection) => collection.id === collectionId
          ? { ...collection, productIds: collection.productIds.filter((id) => id !== productId) }
          : collection),
      })),
      hasProduct: (collectionId, productId) => Boolean(get().collections.find((collection) => collection.id === collectionId)?.productIds.includes(productId)),
    }),
    { name: "homeino-collections", skipHydration: true },
  ),
);

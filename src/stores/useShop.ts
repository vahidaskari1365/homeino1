"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/types";

/* ---------------- CART (multi-vendor aware) ---------------- */
interface CartState {
  items: CartItem[];
  add: (productId: string, qty?: number) => void;
  remove: (productId: string) => void;
  setQty: (productId: string, qty: number) => void;
  clear: () => void;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [
        { productId: "p1", qty: 1 },
        { productId: "p15", qty: 2 },
      ],
      add: (productId, qty = 1) =>
        set((s) => {
          const existing = s.items.find((i) => i.productId === productId);
          if (existing)
            return {
              items: s.items.map((i) =>
                i.productId === productId ? { ...i, qty: i.qty + qty } : i
              ),
            };
          return { items: [...s.items, { productId, qty }] };
        }),
      remove: (productId) =>
        set((s) => ({ items: s.items.filter((i) => i.productId !== productId) })),
      setQty: (productId, qty) =>
        set((s) => ({
          items: s.items
            .map((i) => (i.productId === productId ? { ...i, qty } : i))
            .filter((i) => i.qty > 0),
        })),
      clear: () => set({ items: [] }),
      count: () => get().items.reduce((n, i) => n + i.qty, 0),
    }),
    { name: "homeino-cart" }
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
      products: ["p9", "p12"],
      inspirations: ["i2"],
      designs: ["d1"],
      stores: ["st1"],
      toggleProduct: (id) =>
        set((s) => ({
          products: s.products.includes(id)
            ? s.products.filter((x) => x !== id)
            : [...s.products, id],
        })),
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
      toggleStore: (id) =>
        set((s) => ({
          stores: s.stores.includes(id)
            ? s.stores.filter((x) => x !== id)
            : [...s.stores, id],
        })),
      hasProduct: (id) => get().products.includes(id),
      total: () =>
        get().products.length +
        get().inspirations.length +
        get().designs.length +
        get().stores.length,
    }),
    { name: "homeino-wishlist" }
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
      ids: ["p1", "p29"],
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
    { name: "homeino-compare" }
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
        set({ productIds: [id, ...cur].slice(0, 12) });
      },
      clear: () => set({ productIds: [] }),
    }),
    { name: "homeino-recent" }
  )
);

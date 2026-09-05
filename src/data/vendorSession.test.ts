import { afterEach, describe, expect, it, vi } from "vitest";
import { addVendorProduct, listVendorProducts, subscribeVendorSession, updateVendorStoreProfile, vendorSessionVersion } from "./vendorSession";

// Fake window.localStorage so the persistence path (write-through) runs in node.
function stubWindow() {
  const store = new Map<string, string>();
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
      removeItem: (key: string) => void store.delete(key),
    },
  };
  return store;
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
  vi.resetModules();
});

describe("vendorSession — persisted mutations", () => {
  it("bumps the version, notifies subscribers and writes a snapshot on mutation", () => {
    const store = stubWindow();
    const seen: number[] = [];
    const unsubscribe = subscribeVendorSession(() => seen.push(vendorSessionVersion()));

    const before = listVendorProducts().length;
    addVendorProduct({
      name: "میز عسلی گردو",
      brand: "نور مبلمان",
      categorySlug: "furniture",
      subCategorySlug: "table",
      price: 9_800_000,
      stockCount: 3,
      description: "میز عسلی ساخته‌شده از چوب گردوی خشک‌شده",
    });

    expect(listVendorProducts().length).toBe(before + 1);
    expect(seen.length).toBeGreaterThan(0);
    expect(vendorSessionVersion()).toBeGreaterThan(0);

    const raw = store.get("homeino-vendor-session-v1");
    expect(raw).toBeTruthy();
    const snapshot = JSON.parse(raw ?? "{}") as { v?: number; products?: { name: string }[] };
    expect(snapshot.v).toBe(1);
    expect(snapshot.products?.some((product) => product.name === "میز عسلی گردو")).toBe(true);

    unsubscribe();
  });

  it("persists the store profile patch", () => {
    const store = stubWindow();
    subscribeVendorSession(() => {});
    updateVendorStoreProfile({ name: "خانه چوب" });
    const snapshot = JSON.parse(store.get("homeino-vendor-session-v1") ?? "{}") as { profilePatch?: { name?: string } };
    expect(snapshot.profilePatch?.name).toBe("خانه چوب");
    expect(vendorSessionVersion()).toBeGreaterThan(0);
  });
});

describe("vendorSession — restore after refresh", () => {
  it("loads the persisted snapshot into a fresh module instance after hydration", async () => {
    const store = stubWindow();
    store.set(
      "homeino-vendor-session-v1",
      JSON.stringify({
        v: 1,
        products: [],
        orders: [],
        profilePatch: { name: "چوب و هنر", city: "اصفهان" },
        skuSeq: 4,
      }),
    );

    // fresh module registry = a freshly "reloaded" page
    vi.resetModules();
    const mod = await import("./vendorSession");

    // the restore fires inside the first subscribe (post-hydration timing);
    // React then re-reads vendorSessionVersion() and re-renders — exactly the
    // useHasHydrated mechanism, so the listener itself never has to fire.
    expect(mod.vendorSessionVersion()).toBe(0);
    const unsubscribe = mod.subscribeVendorSession(() => {});
    expect(mod.vendorSessionVersion()).toBe(1);
    expect(mod.vendorStoreProfile().name).toBe("چوب و هنر");
    expect(mod.vendorStoreProfile().city).toBe("اصفهان");

    // a mutation AFTER the restore must notify subscribers
    const seen: number[] = [];
    mod.subscribeVendorSession(() => seen.push(mod.vendorSessionVersion()));
    mod.updateVendorStoreProfile({ name: "چوب و هنر ۲" });
    expect(seen.length).toBe(1);

    unsubscribe();
  });

  it("ignores a corrupted snapshot and keeps the seed session", async () => {
    const store = stubWindow();
    store.set("homeino-vendor-session-v1", "{not json");

    vi.resetModules();
    const mod = await import("./vendorSession");
    mod.subscribeVendorSession(() => {});
    expect(mod.vendorSessionVersion()).toBe(0);
    expect(mod.vendorStoreProfile().name.length).toBeGreaterThan(0); // seed name
  });
});

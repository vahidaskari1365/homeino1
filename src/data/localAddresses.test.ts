import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addSavedAddress,
  deleteSavedAddress,
  getDefaultAddress,
  listSavedAddresses,
  setDefaultAddress,
  updateSavedAddress,
  validateAddressDraft,
  type AddressDraft,
} from "./localAddresses";

const base: AddressDraft = {
  label: "خانه",
  fullName: "وحید عسکری",
  phone: "09121234567",
  city: "تهران",
  postalCode: "1234567890",
  line: "خیابان ولیعصر، کوچه مهر، پلاک ۱۲، واحد ۳",
};

// node env → the module's in-memory fallback is the store; each test starts
// from whatever the previous test left, so lists are read fresh every time.
describe("localAddresses — validation", () => {
  it("rejects a short name, bad phone, short line and bad postal code", () => {
    expect(validateAddressDraft({ ...base, fullName: "و" })).toMatch(/نام/);
    expect(validateAddressDraft({ ...base, phone: "9121234567" })).toMatch(/موبایل/);
    expect(validateAddressDraft({ ...base, phone: "0912345" })).toMatch(/موبایل/);
    expect(validateAddressDraft({ ...base, line: "کوتاه" })).toMatch(/نشانی/);
    expect(validateAddressDraft({ ...base, postalCode: "12345" })).toMatch(/کد پستی/);
    expect(validateAddressDraft(base)).toBeNull();
  });

  it("accepts a draft without a postal code", () => {
    expect(validateAddressDraft({ ...base, postalCode: undefined })).toBeNull();
  });
});

describe("localAddresses — book behaviour", () => {
  afterEach(() => {
    // wipe every row created by the previous test
    const all = listSavedAddresses();
    for (const address of all) deleteSavedAddress(address.id);
  });

  it("adds an address; the first one becomes the default automatically", () => {
    const res = addSavedAddress(base);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.created).toBe(true);
    expect(res.address.isDefault).toBe(true);
    expect(getDefaultAddress()?.id).toBe(res.address.id);
  });

  it("never duplicates the same address — checkout re-submit is idempotent", () => {
    const first = addSavedAddress(base);
    const second = addSavedAddress({ ...base });
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(second.created).toBe(false);
    expect(second.address.id).toBe(first.address.id);
    expect(listSavedAddresses()).toHaveLength(1);
  });

  it("keeps exactly one default when another address is promoted", () => {
    const a = addSavedAddress(base);
    const b = addSavedAddress({ ...base, label: "محل کار", city: "اصفهان", line: "خیابان چهارباغ بالا، ساختمان نگین، طبقه ۲" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(b.address.isDefault).toBe(false); // only the FIRST address defaults
    expect(setDefaultAddress(b.address.id)).toBe(true);
    const defaults = listSavedAddresses().filter((address) => address.isDefault);
    expect(defaults).toHaveLength(1);
    expect(defaults[0].id).toBe(b.address.id);
    // default-first ordering for the checkout picker
    expect(listSavedAddresses()[0].id).toBe(b.address.id);
  });

  it("updates an address and reports a missing id", () => {
    const added = addSavedAddress(base);
    expect(added.ok).toBe(true);
    if (!added.ok) return;
    const updated = updateSavedAddress(added.address.id, { ...base, city: "شیراز" });
    expect(updated.ok).toBe(true);
    if (!updated.ok) return;
    expect(updated.address.city).toBe("شیراز");
    const missing = updateSavedAddress("addr-nope", base);
    expect(missing.ok).toBe(false);
  });

  it("reassigns the default when the default row is deleted", () => {
    const a = addSavedAddress(base);
    const b = addSavedAddress({ ...base, city: "تبریز", line: "خیابان امام، پاساژ ستاره، پلاک ۸، واحد ۱" });
    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(deleteSavedAddress(a.address.id)).toBe(true);
    expect(deleteSavedAddress(a.address.id)).toBe(false); // already gone
    const remaining = listSavedAddresses();
    expect(remaining).toHaveLength(1);
    expect(remaining[0].isDefault).toBe(true);
  });
});

describe("localAddresses — localStorage persistence path", () => {
  it("writes through a stubbed window.localStorage and reads back", async () => {
    const store = new Map<string, string>();
    (globalThis as { window?: unknown }).window = {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => void store.set(key, value),
        removeItem: (key: string) => void store.delete(key),
      },
    };
    try {
      // fresh module instance so its memory fallback does not leak in
      vi.resetModules();
      const { addSavedAddress: addFresh, listSavedAddresses: listFresh } = await import("./localAddresses");
      const added = addFresh(base);
      expect(added.ok).toBe(true);
      expect(store.has("homeino-addresses")).toBe(true);
      expect(listFresh()[0].fullName).toBe(base.fullName);
      expect(listFresh()[0].phone).toBe(base.phone);
    } finally {
      delete (globalThis as { window?: unknown }).window;
    }
  });
});

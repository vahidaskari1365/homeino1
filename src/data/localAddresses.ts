// ============================================================
// ADDRESS BOOK — the customer's saved delivery addresses (demo persistence).
//
// Saved from the account area (/account/addresses) or straight from checkout
// («ذخیره در دفترچهٔ آدرس»). Same contract as localOrders/localSecondHandAds:
// localStorage-backed with an in-memory fallback, swap for the real addresses
// API when the backend lands. The checkout address shape
// (fullName/phone/city/line/postalCode) is a strict subset of SavedAddress so
// a saved address can be poured into the checkout form untouched.
// ============================================================
import { uid } from "@/lib/utils";

const KEY = "homeino-addresses";
const MAX_ADDRESSES = 20;

export interface SavedAddress {
  id: string;
  /** Visible label — «خانه», «محل کار»… */
  label: string;
  fullName: string;
  phone: string;
  city: string;
  postalCode: string;
  line: string;
  isDefault: boolean;
  isoCreatedAt: string;
}

export interface AddressDraft {
  label?: string;
  fullName: string;
  phone: string;
  city: string;
  postalCode?: string;
  line: string;
}

// In-memory fallback for environments without localStorage (tests, SSR,
// private mode) — the demo keeps working for the session either way.
let memoryAddresses: SavedAddress[] = [];

function read(): SavedAddress[] {
  if (typeof window === "undefined") return memoryAddresses;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedAddress[]) : [];
  } catch {
    return [];
  }
}

function write(addresses: SavedAddress[]) {
  if (typeof window === "undefined") {
    memoryAddresses = addresses;
    return;
  }
  try {
    window.localStorage.setItem(KEY, JSON.stringify(addresses));
  } catch {
    memoryAddresses = addresses; // private mode / full quota — session memory keeps working
  }
}

const PHONE_RE = /^09\d{9}$/;
const POSTAL_RE = /^\d{10}$/;

/** Shared validation — used by the address book page AND the checkout save,
 *  so no matter where an address enters, it is stored clean. */
export function validateAddressDraft(draft: AddressDraft): string | null {
  if (draft.fullName.trim().length < 3) return "نام و نام خانوادگی باید حداقل ۳ نویسه باشد";
  if (!PHONE_RE.test(draft.phone.trim())) return "شماره موبایل باید ۱۱ رقم و با ۰۹ شروع شود";
  if (!draft.city.trim()) return "شهر را وارد کن";
  if (draft.line.trim().length < 10) return "نشانی کامل باید حداقل ۱۰ نویسه باشد";
  const postal = draft.postalCode?.trim() ?? "";
  if (postal && !POSTAL_RE.test(postal)) return "کد پستی باید ۱۰ رقم باشد";
  return null;
}

function normalizeDraft(draft: AddressDraft) {
  return {
    label: draft.label?.trim() || "آدرس من",
    fullName: draft.fullName.trim(),
    phone: draft.phone.trim(),
    city: draft.city.trim(),
    postalCode: draft.postalCode?.trim() ?? "",
    line: draft.line.trim(),
  };
}

function sameAddress(a: SavedAddress, b: ReturnType<typeof normalizeDraft>): boolean {
  return (
    a.fullName === b.fullName &&
    a.phone === b.phone &&
    a.city === b.city &&
    a.line === b.line &&
    a.postalCode === b.postalCode
  );
}

/** Default first, then newest-first — a stable order for the book page and
 *  the checkout picker alike. */
export function listSavedAddresses(): SavedAddress[] {
  return read().sort(
    (a, b) => Number(b.isDefault) - Number(a.isDefault) || b.isoCreatedAt.localeCompare(a.isoCreatedAt),
  );
}

export function getDefaultAddress(): SavedAddress | null {
  return listSavedAddresses().find((address) => address.isDefault) ?? null;
}

export function addSavedAddress(
  draft: AddressDraft,
): { ok: true; address: SavedAddress; created: boolean } | { ok: false; error: string } {
  const invalid = validateAddressDraft(draft);
  if (invalid) return { ok: false, error: invalid };
  const normalized = normalizeDraft(draft);
  const addresses = read();
  // Idempotent save: re-submitting the same address from checkout never
  // duplicates a row in the book.
  const existing = addresses.find((address) => sameAddress(address, normalized));
  if (existing) return { ok: true, address: existing, created: false };
  const address: SavedAddress = {
    id: `addr-${uid()}`,
    ...normalized,
    // the first saved address becomes the default automatically
    isDefault: addresses.every((item) => !item.isDefault),
    isoCreatedAt: new Date().toISOString(),
  };
  write([address, ...addresses].slice(0, MAX_ADDRESSES));
  return { ok: true, address, created: true };
}

export function updateSavedAddress(
  id: string,
  draft: AddressDraft,
): { ok: true; address: SavedAddress } | { ok: false; error: string } {
  const invalid = validateAddressDraft(draft);
  if (invalid) return { ok: false, error: invalid };
  const addresses = read();
  const target = addresses.find((address) => address.id === id);
  if (!target) return { ok: false, error: "این آدرس پیدا نشد — شاید حذف شده باشد" };
  const next: SavedAddress = { ...target, ...normalizeDraft(draft) };
  write(addresses.map((address) => (address.id === id ? next : address)));
  return { ok: true, address: next };
}

export function deleteSavedAddress(id: string): boolean {
  const addresses = read();
  const target = addresses.find((address) => address.id === id);
  if (!target) return false;
  const rest = addresses.filter((address) => address.id !== id);
  // exactly one default survives a default-row deletion
  if (target.isDefault && rest.length) rest[0] = { ...rest[0], isDefault: true };
  write(rest);
  return true;
}

export function setDefaultAddress(id: string): boolean {
  const addresses = read();
  if (!addresses.some((address) => address.id === id)) return false;
  write(addresses.map((address) => ({ ...address, isDefault: address.id === id })));
  return true;
}

/** Count only — for the account overview tile without reading the full list. */
export function savedAddressCount(): number {
  return read().length;
}

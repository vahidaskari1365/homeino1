// ============================================================
// VENDOR REGISTRATIONS — demo applications from the «ثبت فروشگاه» wizard.
// The wizard creates a pending application that shows up under
// /admin/vendors (this module is the single source for that list).
// Module-level memory = demo; swap for an API later.
// ============================================================
export interface PendingVendor {
  id: string;
  requestedAt: string;
  faRequestedAt: string;
  storeName: string;
  ownerName: string;
  phone: string;
  city: string;
  category: string;
  description: string;
  status: "pending";
}

const KEY = "homeino-pending-vendors";

function faNow(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("fa-IR");
  } catch {
    return iso;
  }
}

function read(): PendingVendor[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as PendingVendor[]) : [];
  } catch {
    return [];
  }
}

export function listPendingVendors(): PendingVendor[] {
  return read();
}

export function submitVendorRegistration(input: Omit<PendingVendor, "id" | "requestedAt" | "faRequestedAt" | "status">): PendingVendor {
  const iso = new Date().toISOString();
  const vendor: PendingVendor = {
    ...input,
    id: `app-${Date.now().toString(36)}`,
    requestedAt: iso,
    faRequestedAt: faNow(iso),
    status: "pending",
  };
  try {
    window.localStorage.setItem(KEY, JSON.stringify([vendor, ...read()].slice(0, 40)));
  } catch {
    // demo keeps going in memory
  }
  return vendor;
}

/** Admin decision — removes the application from the pending list (demo). */
export function decideVendorApplication(id: string, approved: boolean): boolean {
  const before = read();
  const exists = before.some((vendor) => vendor.id === id);
  if (!exists) return false;
  const next = before.filter((vendor) => vendor.id !== id);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return approved;
}

// ============================================================
// CREDIT LEDGER — Backend-ready credit economy architecture.
//
// Frontend keeps an OPTIMISTIC state for UI. The AUTHORITATIVE
// source of truth will be the Backend/Database (Supabase).
// Every credit mutation flows through this ledger service so
// that swapping frontend-only → backend is a one-file change.
// ============================================================

import { uid } from "@/lib/utils";
import { CREDIT_CONFIG, AI_OPERATION_COSTS } from "@/services/ai/credits";

// ---- Ledger Entry (matches future DB schema) ----
export type LedgerEntryType =
  | "grant"        // starting credits, promotional, admin grant
  | "purchase"     // user bought credits
  | "consume"      // AI operation consumed credits
  | "refund"       // failed AI operation refunded
  | "bonus";       // reward, loyalty

export type LedgerEntryStatus =
  | "reserved"     // hold before AI operation
  | "committed"    // operation succeeded, spend is final
  | "refunded"     // operation failed, credits returned
  | "settled";     // purchase/grant completed

export interface LedgerEntry {
  id: string;
  userId: string | null;          // null until auth connected
  type: LedgerEntryType;
  amount: number;                 // positive = credit, negative = debit
  balanceAfter: number;           // running balance snapshot
  operation: string;              // e.g. "generate", "edit", "purchase"
  generationId: string | null;    // links to AI operation
  idempotencyKey: string | null;  // prevents double-charge
  status: LedgerEntryStatus;
  createdAt: string;              // ISO timestamp
}

// ---- Display configuration (single source of truth: services/ai/credits.ts) ----
export const CREDIT_DISPLAY = CREDIT_CONFIG;

// ---- Operation costs (display only — backend owns authoritative costs) ----
export const OPERATION_COSTS: Record<string, number> = { ...AI_OPERATION_COSTS };

export const getDisplayCost = (operation: string): number =>
  OPERATION_COSTS[operation] ?? 5;

// ============================================================
// IDEMPOTENCY — prevents double-charge on retry/replay
// ============================================================

const processedKeys = new Set<string>();

export function isProcessed(idempotencyKey: string): boolean {
  return processedKeys.has(idempotencyKey);
}

export function markProcessed(idempotencyKey: string): void {
  processedKeys.add(idempotencyKey);
  // Cap set size to prevent memory leak
  if (processedKeys.size > 500) {
    const first = processedKeys.values().next().value;
    if (first) processedKeys.delete(first);
  }
}

export function generateIdempotencyKey(): string {
  return `op_${uid()}_${Date.now()}`;
}

// ============================================================
// ANTI-ABUSE — rate limits + daily quota (frontend layer)
// Backend will enforce these authoritatively.
// ============================================================

const DAILY_LIMIT = 100; // max credits consumed per day
const HOURLY_OPS = 20;   // max AI operations per hour
const opsWindow: number[] = []; // timestamps of recent operations
let dailyResetAt = Date.now() + 86_400_000;

export interface AbuseCheckResult {
  allowed: boolean;
  reason?: string;
}

export function checkAbuse(consumedToday: number, cost: number): AbuseCheckResult {
  const now = Date.now();

  // Reset daily counter
  if (now > dailyResetAt) {
    dailyResetAt = now + 86_400_000;
  }

  // Daily quota
  if (consumedToday + cost > DAILY_LIMIT) {
    return { allowed: false, reason: "سقف مصرف روزانه پر شده — فردا دوباره امتحان کن" };
  }

  // Hourly operation rate
  const recent = opsWindow.filter((t) => now - t < 3_600_000);
  opsWindow.length = 0;
  opsWindow.push(...recent);
  if (recent.length >= HOURLY_OPS) {
    return { allowed: false, reason: "تعداد درخواست‌ها زیاد است — یک ساعت صبر کن" };
  }

  return { allowed: true };
}

export function recordOperation(): void {
  opsWindow.push(Date.now());
}

// ============================================================
// PURCHASE FLOW — placeholder for payment provider
// ============================================================

export interface PurchaseRequest {
  packageId: string;
  credits: number;
  price: number;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

/**
 * Purchase flow placeholder. Today: mock success.
 * Future: POST /api/credits/purchase → payment gateway → webhook → ledger insert.
 */
export async function requestPurchase(_req: PurchaseRequest): Promise<PurchaseResult> {
  // --- MOCK: simulate payment gateway delay ---
  await new Promise((r) => setTimeout(r, 1200));
  return {
    success: true,
    transactionId: `txn_${uid()}`,
  };
}

// ============================================================
// LEDGER BUILDER — creates properly formatted entries
// ============================================================

export function createLedgerEntry(params: {
  type: LedgerEntryType;
  amount: number;
  balanceAfter: number;
  operation: string;
  generationId?: string | null;
  idempotencyKey?: string | null;
  status: LedgerEntryStatus;
}): LedgerEntry {
  return {
    id: uid(),
    userId: null, // filled by backend when auth connected
    type: params.type,
    amount: params.amount,
    balanceAfter: params.balanceAfter,
    operation: params.operation,
    generationId: params.generationId ?? null,
    idempotencyKey: params.idempotencyKey ?? null,
    status: params.status,
    createdAt: new Date().toISOString(),
  };
}

"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CreditTransaction, ChatMessage } from "@/types";
import { uid } from "@/lib/utils";

/* ---------------- UI / OVERLAYS ---------------- */
type Toast = { id: string; text: string; type?: "success" | "error" | "info" };

interface UiState {
  searchOpen: boolean;
  aiPanelOpen: boolean;
  mobileNavOpen: boolean;
  toasts: Toast[];
  setSearch: (v: boolean) => void;
  setAiPanel: (v: boolean) => void;
  setMobileNav: (v: boolean) => void;
  toast: (text: string, type?: Toast["type"]) => void;
  dismissToast: (id: string) => void;
}

export const useUi = create<UiState>((set) => ({
  searchOpen: false,
  aiPanelOpen: false,
  mobileNavOpen: false,
  toasts: [],
  setSearch: (v) => set({ searchOpen: v }),
  setAiPanel: (v) => set({ aiPanelOpen: v }),
  setMobileNav: (v) => set({ mobileNavOpen: v }),
  toast: (text, type = "success") => {
    const id = uid();
    set((s) => ({ toasts: [...s.toasts, { id, text, type }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3200);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/* ---------------- AUTH (mock) ---------------- */
export type Role = "customer" | "vendor" | "admin" | "support";

interface AuthUser {
  name: string;
  email: string;
  avatar: string;
  role: Role;
  brand?: string;
}

interface AuthState {
  user: AuthUser | null;
  login: (email: string, opts?: { name?: string; role?: Role; brand?: string }) => void;
  /** Patch the logged-in user's own profile (name/city/phone) — persisted.
   *  Avatar re-derives from the name like login does. */
  updateProfile: (patch: { name?: string; email?: string; city?: string; phone?: string }) => void;
  logout: () => void;
}

// Development-only mock user. In production, user starts as null (guest).
const isDev = process.env.NODE_ENV !== "production";
const DEV_USER: AuthUser = { name: "مهمان خانه", email: "demo@homeino.ir", avatar: "م", role: "customer" };

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      // In production: user is null until real login. In dev: demo user for convenience.
      user: isDev ? DEV_USER : null,
      login: (email, opts = {}) =>
        set({
          user: {
            email,
            name: opts.name || email.split("@")[0],
            avatar: (opts.name || email)[0],
            role: opts.role || "customer",
            brand: opts.brand,
          },
        }),
      updateProfile: (patch) =>
        set((state) => {
          if (!state.user) return state;
          const name = patch.name?.trim() || state.user.name;
          return {
            user: {
              ...state.user,
              name,
              email: patch.email?.trim() || state.user.email,
              avatar: name[0],
            },
          };
        }),
      logout: () => set({ user: isDev ? DEV_USER : null }),
    }),
    { name: "homeino-auth", skipHydration: true }
  )
);

/* ---------------- AI CREDITS — LEDGER-BASED ---------------- */
import {
  createLedgerEntry, type LedgerEntry, type LedgerEntryStatus,
  generateIdempotencyKey, isProcessed, markProcessed,
  checkAbuse, recordOperation, requestPurchase, type PurchaseResult,
} from "@/services/credits/ledger";

export interface CreditLedgerEntry extends LedgerEntry {}

type AiOpResult<T> = { ok: true; result: T; generationId: string } | { ok: false; reason: "insufficient" | "failed" | "rate_limited" | "duplicate"; error?: unknown };

interface CreditState {
  /** OPTIMISTIC balance — backend is authoritative */
  balance: number;
  /** Legacy display history (for UI compatibility) */
  history: CreditTransaction[];
  /** Proper ledger entries */
  ledger: LedgerEntry[];
  /** Consumed today (for daily quota display) */
  consumedToday: number;
  /** Simple spend (legacy — no idempotency) */
  spend: (amount: number, reason: string) => boolean;
  /** Adopt the SERVER balance after a real purchase (backend is authoritative). */
  setBalance: (n: number) => void;
  /** Mock purchase — will be replaced by POST /api/credits/purchase */
  buy: (credits: number) => void;
  /** Real purchase flow with payment provider placeholder */
  purchase: (pkg: { packageId: string; credits: number; price: number }) => Promise<PurchaseResult>;
  /** Idempotent AI operation: CHECK → ABUSE CHECK → RESERVE → EXECUTE → COMMIT/REFUND */
  runAiOperation: <T>(operation: string, cost: number, exec: () => Promise<T>) => Promise<AiOpResult<T>>;
}

export const useCredits = create<CreditState>()(
  persist(
    (set, get) => ({
      balance: 120,
      history: [],
      ledger: [],
      consumedToday: 0,
      spend: (amount, reason) => {
        if (get().balance < amount) return false;
        set((s) => ({ balance: s.balance - amount, history: [{ id: uid(), amount: -amount, reason, date: "اکنون" }, ...s.history] }));
        return true;
      },
      setBalance: (n) => set({ balance: Math.max(0, Math.round(n)) }),
      buy: (credits) =>
        set((s) => ({ balance: s.balance + credits, history: [{ id: uid(), amount: credits, reason: "خرید اعتبار", date: "اکنون" }, ...s.history] })),
      purchase: async (pkg) => {
        const result = await requestPurchase(pkg);
        if (result.success) {
          const balanceAfter = get().balance + pkg.credits;
          const entry = createLedgerEntry({ type: "purchase", amount: pkg.credits, balanceAfter, operation: "purchase", status: "settled" });
          set((s) => ({ balance: balanceAfter, ledger: [entry, ...s.ledger], history: [{ id: uid(), amount: pkg.credits, reason: "خرید اعتبار", date: "اکنون" }, ...s.history] }));
        }
        return result;
      },
      runAiOperation: async (operation, cost, exec) => {
        const { balance, consumedToday } = get();

        // 1. IDEMPOTENCY — generate key, check for duplicates
        const idempotencyKey = generateIdempotencyKey();
        if (isProcessed(idempotencyKey)) {
          return { ok: false, reason: "duplicate" as const };
        }

        // 2. CHECK balance
        if (balance < cost) return { ok: false, reason: "insufficient" as const };

        // 3. ABUSE CHECK — daily quota + hourly rate
        const abuse = checkAbuse(consumedToday, cost);
        if (!abuse.allowed) return { ok: false, reason: "rate_limited" as const, error: abuse.reason };

        const generationId = uid();
        markProcessed(idempotencyKey);

        // 4. RESERVE — deduct + create reserved ledger entry
        const balanceAfterReserve = balance - cost;
        const reserveEntry = createLedgerEntry({
          type: "consume", amount: -cost, balanceAfter: balanceAfterReserve,
          operation, generationId, idempotencyKey, status: "reserved",
        });
        set((s) => ({
          balance: balanceAfterReserve,
          consumedToday: s.consumedToday + cost,
          ledger: [reserveEntry, ...s.ledger],
        }));

        try {
          // 5. EXECUTE the AI operation
          recordOperation();
          const result = await exec();

          // 6. COMMIT — update ledger entry to committed
          set((s) => ({
            ledger: s.ledger.map((e) => (e.id === reserveEntry.id ? { ...e, status: "committed" as LedgerEntryStatus } : e)),
            history: [{ id: uid(), amount: -cost, reason: operation, date: "اکنون" }, ...s.history],
          }));
          return { ok: true as const, result, generationId };
        } catch (error) {
          // 7. REFUND on failure — full credit return
          set((s) => ({
            balance: s.balance + cost,
            consumedToday: Math.max(0, s.consumedToday - cost),
            ledger: s.ledger.map((e) => (e.id === reserveEntry.id ? { ...e, status: "refunded" as LedgerEntryStatus, balanceAfter: s.balance + cost } : e)),
          }));
          return { ok: false as const, reason: "failed" as const, error };
        }
      },
    }),
    { name: "homeino-credits", skipHydration: true }
  )
);

/* ---------------- AI CHAT (overlay conversation) ----------------
 * Persisted across reloads. A stable per-browser sessionId keeps multi-turn
 * continuity working (sent with every grounded chat request). Components must
 * gate renders on `useHasHydrated()` before reading persisted messages.
 */
interface ChatState {
  messages: ChatMessage[];
  sessionId: string;
  /** Transient one-shot ask from PDP quick-question chips (NOT persisted).
   *  AIPanel consumes + clears it, then answers via the grounded advice path. */
  request: { content: string; topic?: string; productSlug?: string; nonce: number } | null;
  push: (m: Omit<ChatMessage, "id" | "createdAt">) => string;
  update: (id: string, patch: Partial<ChatMessage>) => void;
  clear: () => void;
  askAssistant: (r: { content: string; topic?: string; productSlug?: string }) => void;
  clearRequest: () => void;
  /** Returns the stable localStorage session id, generating it on first use. */
  ensureSessionId: () => string;
}

export const useChat = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [
        { id: "m0", role: "assistant", content: "سلام! من دستیار Homeino هستم. می‌تونم کمک کنم اتاقت رو طراحی کنم، فرش مناسب پیدا کنم یا محصولی رو با دکوراسیونت هماهنگ کنم.", createdAt: Date.now() },
      ],
      sessionId: "",
      request: null,
      askAssistant: (r) => set({ request: { ...r, nonce: Date.now() } }),
      clearRequest: () => set({ request: null }),
      // id + timestamp generated here (store, not render) → keeps components pure
      push: (m) => { const id = uid(); set((s) => ({ messages: [...s.messages, { id, createdAt: Date.now(), ...m }] })); return id; },
      update: (id, patch) =>
        set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),
      clear: () => set({ messages: [], sessionId: "" }),
      ensureSessionId: () => {
        const current = get().sessionId;
        if (current) return current;
        const next = `ch_${uid()}_${Date.now().toString(36)}`;
        set({ sessionId: next });
        return next;
      },
    }),
    {
      name: "homeino-chat",
      skipHydration: true,
      // Only finished turns are persisted (never the live "…" bubble) and the
      // conversation is capped so localStorage stays small.
      partialize: (s) => ({
        messages: s.messages.filter((m) => !m.pending).slice(-60),
        sessionId: s.sessionId,
      }),
    },
  ),
);

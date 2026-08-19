"use client";
// ============================================================
// DESIGN SESSIONS — persisted AI design history (client-side).
// Backend sync comes later; the store shape is the contract the
// future /api/designs endpoint will serve.
//
// Each session: thumbnail · date · prompt · style · status ·
// reopen (continue editing) · delete.
// ============================================================
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OverlayRegion } from "@/services/ai/orali/types";
import type { RoomElement } from "@/services/ai/roomState";
import { uid } from "@/lib/utils";

export type DesignSessionStatus = "success" | "partial-success" | "error" | "no-result";

export interface DesignSession {
  id: string;
  title: string;
  prompt: string;
  roomType: string;
  style: string;
  colors: string[];
  scope: "targeted" | "full";
  targets: RoomElement[];
  status: DesignSessionStatus;
  /** Compressed before/after images (data-URLs). */
  beforeImage: string;
  afterImage: string;
  regions: OverlayRegion[];
  products: { label: string; productId?: string }[];
  creditsUsed: number;
  createdAt: number;
  preview?: boolean;
  intentSummary?: string;
  imageEngine?: string;
}

interface DesignSessionState {
  sessions: DesignSession[];
  saveSession: (input: Omit<DesignSession, "id" | "createdAt">) => string;
  removeSession: (id: string) => void;
  clearAll: () => void;
}

export const useDesignSessions = create<DesignSessionState>()(
  persist(
    (set) => ({
      sessions: [],
      saveSession: (input) => {
        const id = `ds_${uid()}`;
        set((s) => ({ sessions: [{ ...input, id, createdAt: Date.now() }, ...s.sessions].slice(0, 40) }));
        return id;
      },
      removeSession: (id) => set((s) => ({ sessions: s.sessions.filter((x) => x.id !== id) })),
      clearAll: () => set({ sessions: [] }),
    }),
    {
      name: "homeino-ai-designs",
      // Guard against quota errors — drop oldest half and retry once.
      storage: {
        getItem: (name) => {
          try {
            const raw = localStorage.getItem(name);
            return raw ? JSON.parse(raw) : null;
          } catch {
            return null;
          }
        },
        setItem: (name, value) => {
          try {
            localStorage.setItem(name, JSON.stringify(value));
          } catch {
            try {
              const parsed = JSON.parse(JSON.stringify(value)) as { state?: { sessions?: DesignSession[] } };
              if (parsed.state?.sessions?.length) {
                parsed.state.sessions = parsed.state.sessions.slice(0, Math.ceil(parsed.state.sessions.length / 2));
                localStorage.setItem(name, JSON.stringify(parsed));
              }
            } catch { /* give up silently — history is non-critical */ }
          }
        },
        removeItem: (name) => {
          try { localStorage.removeItem(name); } catch { /* ignore */ }
        },
      },
    }
  )
);

export const getSessionById = (id: string): DesignSession | undefined =>
  useDesignSessions.getState().sessions.find((s) => s.id === id);

export const SESSION_STATUS_META: Record<DesignSessionStatus, { label: string; tone: "success" | "gold" | "danger" | "neutral" }> = {
  success: { label: "موفق", tone: "success" },
  "partial-success": { label: "پیش‌نمایش", tone: "gold" },
  error: { label: "ناموفق", tone: "danger" },
  "no-result": { label: "بدون نتیجه", tone: "neutral" },
};

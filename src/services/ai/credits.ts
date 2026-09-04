// ============================================================
// AI CREDITS — fully configurable, never hardcode in components.
// Cost per operation lives here so it can be tuned centrally.
// ============================================================

export const CREDIT_CONFIG = {
  startingBalance: 120,
  buyPackages: [
    { id: "pk1", credits: 100, price: 99000, label: "۱۰۰ اعتبار", popular: false },
    { id: "pk2", credits: 300, price: 249000, label: "۳۰۰ اعتبار", popular: true },
    { id: "pk3", credits: 800, price: 599000, label: "۸۰۰ اعتبار", popular: false },
  ],
  subscriptions: [
    { id: "sub-free", name: "رایگان", price: 0, credits: 120, perks: ["۱۲۰ اعتبار ماهانه", "دقت استاندارد"] },
    { id: "sub-plus", name: "پلاس", price: 290000, credits: 600, perks: ["۶۰۰ اعتبار ماهانه", "دقت بالا", "اولویت در صف"] },
    { id: "sub-pro", name: "حرفه‌ای", price: 690000, credits: 2000, perks: ["۲۰۰۰ اعتبار ماهانه", "دقت حداکثری", "پشتیبانی ویژه"] },
  ],
} as const;

import { AI_MODES } from "./types";

export const costForMode = (mode: string): number => {
  const m = AI_MODES.find((x) => x.id === mode);
  return m ? m.cost : 5;
};

// ---- Centralized per-operation costs (single source of truth) ----
export type AiOperationType =
  | "generate" | "edit" | "inpaint" | "placement" | "analyze" | "chat" | "suggest";

export const AI_OPERATION_COSTS: Record<AiOperationType, number> = {
  generate: 5, edit: 3, inpaint: 3, placement: 4, analyze: 5, chat: 0, suggest: 1,
};

export const costOf = (op: AiOperationType): number => AI_OPERATION_COSTS[op];

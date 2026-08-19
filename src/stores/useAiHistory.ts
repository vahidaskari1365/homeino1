"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "@/lib/utils";
import type { OverlayMetadata } from "@/services/ai/orali";
import type { StructuredIntent } from "@/services/ai/intentSchema";

export type HistoryStatus = "success" | "partial-success" | "error";

export interface AiHistoryItem {
  id: string;
  thumbnail: string;
  date: string;
  prompt: string;
  style: string;
  status: HistoryStatus;
  originalImage: string;
  generatedImage: string;
  overlay?: OverlayMetadata;
  intent?: StructuredIntent;
}

interface AiHistoryState {
  items: AiHistoryItem[];
  add: (item: Omit<AiHistoryItem, "id" | "date">) => string;
  remove: (id: string) => void;
  get: (id: string) => AiHistoryItem | undefined;
}

export const useAiHistory = create<AiHistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        const id = uid();
        const rec: AiHistoryItem = {
          ...item,
          id,
          date: new Date().toLocaleDateString("fa-IR"),
        };
        set((s) => ({ items: [rec, ...s.items].slice(0, 40) }));
        return id;
      },
      remove: (id) => set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
      get: (id) => get().items.find((i) => i.id === id),
    }),
    { name: "homeino-ai-history" },
  ),
);

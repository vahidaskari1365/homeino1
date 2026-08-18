"use client";
import { create } from "zustand";
import type {
  RoomState, RoomSnapshot, RoomElement, ProductPlacement,
} from "@/services/ai/roomState";
import { ALL_ELEMENTS } from "@/services/ai/roomState";

// ============================================================
// ROOM STATE STORE — the single source of truth for an AI
// design session. Preserves originalImage forever, tracks
// every applied change as a versioned snapshot, supports
// undo / redo. Wired to the design page incrementally.
// ============================================================

const EMPTY_STATE: RoomState = {
  originalImage: null,
  currentImage: null,
  roomType: "پذیرایی",
  detectedStyle: "modern",
  detectedColors: [],
  budget: 0,
  lockedElements: ALL_ELEMENTS,
  appliedChanges: [],
  placements: [],
  history: [],
  historyIndex: -1,
};

interface RoomStateActions {
  loadRoom: (image: string, roomType?: string) => void;
  reset: () => void;
  setRoomMeta: (patch: Partial<Pick<RoomState, "roomType" | "detectedStyle" | "detectedColors" | "budget">>) => void;
  lockElements: (elements: RoomElement[]) => void;
  unlockAll: () => void;
  /** Apply a change and push a new version snapshot (for undo). */
  commitChange: (params: { label: string; image?: string; placements: ProductPlacement[]; change: string; scope?: string }) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useRoomState = create<RoomState & RoomStateActions>((set, get) => ({
  ...EMPTY_STATE,

  loadRoom: (image, roomType = "پذیرایی") =>
    set({
      originalImage: image,
      currentImage: image,
      roomType,
      appliedChanges: [],
      placements: [],
      history: [{ version: 0, label: "اتاق اصلی", image, placements: [], changes: [], timestamp: Date.now() }],
      historyIndex: 0,
      lockedElements: ALL_ELEMENTS,
    }),

  reset: () => set(EMPTY_STATE),

  setRoomMeta: (patch) => set(patch),

  lockElements: (elements) => set({ lockedElements: elements }),
  unlockAll: () => set({ lockedElements: [] }),

  commitChange: ({ label, image, placements, change }) => {
    const s = get();
    const version = s.historyIndex + 1;
    const snapshot: RoomSnapshot = {
      version,
      label,
      image: image ?? s.currentImage ?? s.originalImage ?? "",
      placements: placements.map((p) => ({ productId: p.productId, x: p.placement.x, y: p.placement.y, scale: p.placement.scale, rotation: p.placement.rotation })),
      changes: [...s.appliedChanges, change],
      timestamp: Date.now(),
    };
    // truncate any redo history (we branched)
    const history = [...s.history.slice(0, s.historyIndex + 1), snapshot];
    set({
      currentImage: snapshot.image,
      placements,
      appliedChanges: snapshot.changes,
      history,
      historyIndex: history.length - 1,
    });
    // scope metadata stored implicitly via change label
  },

  undo: () => {
    const s = get();
    if (s.historyIndex <= 0) return;
    const idx = s.historyIndex - 1;
    const snap = s.history[idx];
    set({
      currentImage: snap.image,
      placements: snap.placements.map((p) => ({ productId: p.productId, category: "", reason: "", placement: { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation } })),
      appliedChanges: snap.changes,
      historyIndex: idx,
    });
  },

  redo: () => {
    const s = get();
    if (s.historyIndex >= s.history.length - 1) return;
    const idx = s.historyIndex + 1;
    const snap = s.history[idx];
    set({
      currentImage: snap.image,
      placements: snap.placements.map((p) => ({ productId: p.productId, category: "", reason: "", placement: { x: p.x, y: p.y, scale: p.scale, rotation: p.rotation } })),
      appliedChanges: snap.changes,
      historyIndex: idx,
    });
  },

  canUndo: () => get().historyIndex > 0,
  canRedo: () => get().historyIndex < get().history.length - 1,
}));

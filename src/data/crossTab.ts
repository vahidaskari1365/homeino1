// ============================================================
// Cross-tab live sync for the localStorage data layer.
//
// Every Homeino store (orders, ads, addresses, cart, wishlist,
// vendor session, ...) persists under a `homeino-*` key. When a
// second tab changes one of those keys, the browser fires a
// `storage` event in every OTHER tab — we bridge those events
// (plus a BroadcastChannel for browsers/contexts where storage
// events are unreliable) into a single typed subscription that
// React components consume through `useDataVersion()`.
//
// No appearance change: this only makes already-rendered local
// data refresh live instead of requiring a page reload.
// ============================================================

export const DATA_SYNC_PREFIX = "homeino-";

/** Injectable transport seams so tests can drive the hub without a DOM. */
export interface DataSyncHubDeps {
  /** Register a callback for native storage events (other tabs). */
  addStorageListener?: (fn: (key: string | null) => void) => void;
  /**
   * Create a cross-tab channel. The factory receives the hub's message
   * router; returned channel is used for outbound notify() messages.
   */
  createChannel?: (onMessage: (key: string) => void) => {
    postMessage: (msg: { key: string }) => void;
    close?: () => void;
  } | null;
}

export interface DataSyncHub {
  subscribe: (fn: (key: string) => void) => () => void;
  /** Manually notify subscribers (e.g. same-tab writes that bypass storage events). */
  notify: (key: string) => void;
  stop: () => void;
}

/**
 * Create the cross-tab hub. The default deps wire the real browser
 * transports (storage event + BroadcastChannel); tests inject fakes.
 */
export function createDataSyncHub(deps: DataSyncHubDeps = {}): DataSyncHub {
  const listeners = new Set<(key: string) => void>();
  let channel: ReturnType<NonNullable<DataSyncHubDeps["createChannel"]>> = null;
  let started = false;

  const emit = (key: string | null | undefined) => {
    if (!key || !key.startsWith(DATA_SYNC_PREFIX)) return;
    listeners.forEach((fn) => fn(key));
  };

  const subscribe = (fn: (key: string) => void) => {
    if (!started) {
      started = true;
      deps.addStorageListener?.((key) => emit(key));
      channel = deps.createChannel?.(emit) ?? null;
    }
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  };

  const notify = (key: string) => {
    emit(key);
    channel?.postMessage({ key });
  };

  const stop = () => {
    listeners.clear();
    channel?.close?.();
    channel = null;
    started = false;
  };

  return { subscribe, notify, stop };
}

/** Singleton hub wired to the real browser transports (SSR-safe). */
export const dataSyncHub = createDataSyncHub({
  addStorageListener: (fn) => {
    if (typeof window === "undefined") return;
    window.addEventListener("storage", (event) => fn(event.key));
  },
  createChannel: (onMessage) => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return null;
    try {
      const ch = new BroadcastChannel("homeino-sync");
      ch.onmessage = (event: MessageEvent) => {
        const key = (event.data as { key?: string } | null)?.key;
        if (typeof key === "string") onMessage(key);
      };
      return ch;
    } catch {
      return null;
    }
  },
});

/** Subscribe to cross-tab data changes. Returns an unsubscribe fn. */
export function subscribeDataSync(fn: (key: string) => void): () => void {
  return dataSyncHub.subscribe(fn);
}

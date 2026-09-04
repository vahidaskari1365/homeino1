"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/stores/useApp";

// ============================================================
// Homeino — Tracking layer.
//
// Events are POSTed to /api/analytics, which persists them to
// `analytics_events` (Supabase) and fires the event-triggered workflows.
// localStorage is only an OFFLINE BUFFER now: an event is queued, sent, and
// removed from the queue on success — the database is the source of truth.
// ============================================================

export type AnalyticsEventType =
  | "page_view" | "user_registered" | "user_login" | "user_logout"
  | "room_uploaded" | "ai_started" | "ai_finished" | "ai_failed"
  | "ai_design_started" | "ai_design_finished" | "ai_design_failed" | "ai_design_no_result"
  | "design_saved" | "product_viewed" | "product_clicked" | "product_favorited"
  | "add_to_cart" | "remove_from_cart" | "checkout_started" | "order_placed"
  | "store_viewed" | "store_followed" | "object_detected" | "object_selected"
  | "token_consumed" | "content_viewed" | "purchase_conversion"
  // agentic marketplace events (server-side profile + workflows consume these)
  | "product_view" | "product_search" | "search" | "style_view" | "store_view"
  | "wishlist_add" | "wishlist_remove" | "cart_add" | "cart_remove"
  | "recommendation_click" | "recommendation_dismiss" | "recommendation_view"
  | "ai_design_start" | "ai_design_complete" | "ai_product_select"
  | "chat_message" | "agent_run";

export interface TrackEventOptions {
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
  path?: string;
}

const SESSION_KEY = "homeino_session_id";
const QUEUE_KEY = "homeino_events";
const ENDPOINT = "/api/analytics";
const MAX_QUEUE = 200;
const MAX_BATCH = 20;

interface QueuedEvent {
  id: string;
  event_type: string;
  session_id: string;
  timestamp: string;
  device?: string;
  platform?: string;
  entityType?: string | null;
  entityId?: string | null;
  path?: string | null;
  metadata?: Record<string, unknown>;
}

/** Simple hash for PII — never store raw email/phone in analytics */
function hashEmail(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h << 5) - h + email.charCodeAt(i);
    h |= 0;
  }
  return `u_${Math.abs(h).toString(36)}`;
}

export function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch {
    return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s_${Date.now()}`;
  }
}

function getDeviceInfo(): { device: string; platform: string } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return {
    device: /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop",
    platform: /windows/i.test(ua) ? "windows" : /mac/i.test(ua) ? "mac" : /linux/i.test(ua) ? "linux" : "other",
  };
}

function readQueue(): QueuedEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    return Array.isArray(parsed) ? (parsed as QueuedEvent[]) : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueuedEvent[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue.slice(-MAX_QUEUE)));
  } catch {
    /* storage full/unavailable — tracking must never break UX */
  }
}

function pushToQueue(event: QueuedEvent) {
  writeQueue([...readQueue(), event]);
}

function dropFromQueue(ids: string[]) {
  const set = new Set(ids);
  writeQueue(readQueue().filter((e) => !set.has(e.id)));
}

async function send(events: QueuedEvent[]): Promise<boolean> {
  if (!events.length) return true;
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify(events.length === 1 ? { event: events[0] } : { events }),
    });
    return res.ok;
  } catch {
    return false; // offline — the event stays queued
  }
}

/** Send everything still sitting in the offline buffer (called on app mount). */
export async function flushEventQueue(): Promise<number> {
  const queued = readQueue();
  if (!queued.length) return 0;
  let flushed = 0;
  for (let i = 0; i < queued.length; i += MAX_BATCH) {
    const batch = queued.slice(i, i + MAX_BATCH);
    const sent = await send(batch);
    if (!sent) break;
    dropFromQueue(batch.map((e) => e.id));
    flushed += batch.length;
  }
  return flushed;
}

export async function trackEvent(eventType: AnalyticsEventType | string, options: TrackEventOptions = {}): Promise<void> {
  const evt: QueuedEvent = {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event_type: String(eventType).slice(0, 60),
    session_id: getSessionId(),
    timestamp: new Date().toISOString(),
    ...getDeviceInfo(),
    entityType: options.entityType ?? null,
    entityId: options.entityId ?? null,
    path: options.path ?? (typeof window !== "undefined" ? window.location.pathname.slice(0, 300) : null),
    metadata: options.metadata ?? {},
  };

  // Buffer first so a dropped connection never loses the event.
  pushToQueue(evt);
  const sent = await send([evt]);
  if (sent) dropFromQueue([evt.id]);
  if (!sent && process.env.NODE_ENV !== "production") console.debug("[track] queued (offline):", evt.event_type);
}

export function readEventQueue(): unknown[] {
  return readQueue();
}

const Ctx = createContext<{ track: typeof trackEvent }>({ track: trackEvent });

export function TrackingProvider({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const prevEmail = useRef<string | null>(null);
  const flushed = useRef(false);

  // Flush anything buffered while the visitor was offline.
  useEffect(() => {
    if (flushed.current) return;
    flushed.current = true;
    void flushEventQueue();
  }, []);

  useEffect(() => {
    const id = user?.email ?? null;
    // Hash email for analytics — never store raw PII
    const hashedId = id ? hashEmail(id) : null;
    if (hashedId && hashedId !== prevEmail.current) trackEvent("user_login", { metadata: { userHash: hashedId, role: user?.role } });
    if (!hashedId && prevEmail.current) trackEvent("user_logout");
    prevEmail.current = hashedId;
  }, [user]);

  return <Ctx.Provider value={{ track: trackEvent }}>{children}</Ctx.Provider>;
}

export function useTracking() {
  return useContext(Ctx);
}

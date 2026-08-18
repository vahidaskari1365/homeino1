"use client";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useAuth } from "@/stores/useApp";

// ============================================================
// Homeino — Tracking layer (Backend-ready, no external deps).
// Today events are queued in localStorage + logged; replace
// trackEvent's body with a POST to /api/analytics when the
// backend is connected (Supabase analytics_events table).
// ============================================================

export type AnalyticsEventType =
  | "page_view" | "user_registered" | "user_login" | "user_logout"
  | "room_uploaded" | "ai_started" | "ai_finished" | "ai_failed"
  | "design_saved" | "product_viewed" | "product_clicked" | "product_favorited"
  | "add_to_cart" | "remove_from_cart" | "checkout_started" | "order_placed"
  | "store_viewed" | "store_followed" | "object_detected" | "object_selected"
  | "token_consumed" | "content_viewed" | "purchase_conversion";

export interface TrackEventOptions {
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

const SESSION_KEY = "homeino_session_id";
const QUEUE_KEY = "homeino_events";

/** Simple hash for PII — never store raw email/phone in analytics */
function hashEmail(email: string): string {
  let h = 0;
  for (let i = 0; i < email.length; i++) {
    h = (h << 5) - h + email.charCodeAt(i);
    h |= 0;
  }
  return `u_${Math.abs(h).toString(36)}`;
}

function getSessionId(): string {
  try {
    let id = sessionStorage.getItem(SESSION_KEY);
    if (!id) { id = crypto.randomUUID(); sessionStorage.setItem(SESSION_KEY, id); }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function getDeviceInfo(): { device: string; platform: string } {
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  return {
    device: /mobile|android|iphone|ipad/i.test(ua) ? "mobile" : "desktop",
    platform: /windows/i.test(ua) ? "windows" : /mac/i.test(ua) ? "mac" : /linux/i.test(ua) ? "linux" : "other",
  };
}

export async function trackEvent(eventType: AnalyticsEventType, options: TrackEventOptions = {}): Promise<void> {
  try {
    const evt = {
      id: crypto.randomUUID(),
      event_type: eventType,
      session_id: getSessionId(),
      timestamp: new Date().toISOString(),
      ...getDeviceInfo(),
      entityType: options.entityType ?? null,
      entityId: options.entityId ?? null,
      metadata: options.metadata ?? {},
    };
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]");
    q.push(evt);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-200)));
    if (process.env.NODE_ENV !== "production") console.debug("[track]", eventType, options.metadata ?? "");
  } catch {
    /* swallow — tracking must never break UX */
  }
}

export function readEventQueue(): unknown[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]"); } catch { return []; }
}

const Ctx = createContext<{ track: typeof trackEvent }>({ track: trackEvent });

export function TrackingProvider({ children }: { children: ReactNode }) {
  const user = useAuth((s) => s.user);
  const prevEmail = useRef<string | null>(null);

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

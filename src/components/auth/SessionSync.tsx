"use client";
import { useEffect, useRef } from "react";
import { useAuth, type Role } from "@/stores/useApp";
import { fetchMe } from "@/lib/commerceClient";

/**
 * SessionSync — the bridge that makes the real Supabase session observable to
 * the whole UI. Mounted once in GlobalChrome:
 *
 *   Supabase Auth (httpOnly cookie)  →  /api/auth/me  →  useAuth.user (real id/role)
 *
 * - On success: hydrates the zustand store with the SERVER-confirmed identity
 *   (real auth.users UUID). From here on, Customer Memory, agents, credits and
 *   orders all share the same real user_id that the server already uses.
 * - On 401: the local store is a stale projection (guest or old session) —
 *   clear it so the UI never shows a fake logged-in state. (commerceClient
 *   has already attempted one transparent refresh before we see the 401.)
 * - Guest (401 with no prior local user): no-op — stays null, exactly as
 *   production should start.
 *
 * Runs once per full page load; navigation is client-side so the projection
 * stays accurate. A `loggedOutAt` marker prevents the login→me roundtrip from
 * resurrecting a user right after explicit logout.
 */
const LOGGED_OUT_KEY = "homeino-logged-out-at";

export function SessionSync() {
  const inflight = useRef(false);

  useEffect(() => {
    if (inflight.current) return;
    inflight.current = true;

    let loggedOut = false;
    try { loggedOut = Boolean(window.localStorage.getItem(LOGGED_OUT_KEY)); } catch { /* private mode */ }
    if (loggedOut) return;

    void (async () => {
      const res = await fetchMe();
      const current = useAuth.getState().user;
      if (res.ok) {
        try { window.localStorage.removeItem(LOGGED_OUT_KEY); } catch { /* ignore */ }
        const { id, email, name, role } = res.data;
        // Same identity → keep local edits (avatar/name); otherwise adopt server truth.
        if (current?.id === id) return;
        useAuth.getState().login(email, {
          id,
          name: name || email.split("@")[0],
          role: (["customer", "vendor", "admin", "support"].includes(role ?? "") ? role : "customer") as Role,
        });
        return;
      }
      // Stale local user (expired/revoked session) — drop the fake projection.
      if (current && current.id) {
        useAuth.getState().logout();
      }
    })();
  }, []);

  return null;
}

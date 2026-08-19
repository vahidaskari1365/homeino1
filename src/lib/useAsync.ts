"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ApiErr, ApiResult } from "./apiClient";
import { apiErrorMessage } from "./apiClient";

/**
 * Standardized async state — every UI that talks to a backend
 * should render off of this. Discriminated on `status`.
 */
export type AsyncState<T> =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: T; empty: boolean }
  | { status: "error"; error: string; retryable: boolean };

interface UseAsyncOptions<T> {
  /** Run automatically on mount. Default: true. */
  auto?: boolean;
  /** Consider the result "empty" (renders EmptyState). Default checks arrays / null / undefined. */
  isEmpty?: (data: T) => boolean;
  /** Deps that re-trigger auto runs. */
  deps?: unknown[];
}

function defaultEmpty<T>(data: T): boolean {
  if (data == null) return true;
  if (Array.isArray(data)) return data.length === 0;
  return false;
}

/**
 * useAsync wraps any Promise-returning function into the
 * loading / success / error / empty / retry contract the
 * app UI is designed around.
 *
 *   const users = useAsync(() => usersRepo.list(), { deps: [] });
 *   users.status === "loading"  → <Spinner />
 *   users.status === "error"    → <ErrorState onRetry={users.retry} />
 *   users.status === "success"  → users.empty ? <EmptyState /> : ...
 */
export function useAsync<T>(fn: () => Promise<T> | Promise<ApiResult<T>>, opts: UseAsyncOptions<T> = {}) {
  const { auto = true, isEmpty = defaultEmpty, deps = [] } = opts;
  const [state, setState] = useState<AsyncState<T>>({ status: auto ? "loading" : "idle" });
  const runIdRef = useRef(0);
  const mountedRef = useRef(true);
  const fnRef = useRef(fn);
  const emptyRef = useRef(isEmpty);

  // Keep refs in sync with the latest render — happens after commit,
  // so it never triggers extra renders and satisfies the strict rules.
  useEffect(() => {
    fnRef.current = fn;
    emptyRef.current = isEmpty;
  });

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    const id = ++runIdRef.current;
    setState({ status: "loading" });
    try {
      const raw = await fnRef.current();
      if (!mountedRef.current || id !== runIdRef.current) return;

      // Unwrap ApiResult if the caller returned one.
      if (raw && typeof raw === "object" && "ok" in raw) {
        const result = raw as ApiResult<T>;
        if (result.ok) {
          const data = result.data;
          setState({ status: "success", data, empty: emptyRef.current(data) });
        } else {
          setState({
            status: "error",
            error: apiErrorMessage(result as ApiErr),
            retryable: (result as ApiErr).code !== "abort",
          });
        }
      } else {
        const data = raw as T;
        setState({ status: "success", data, empty: emptyRef.current(data) });
      }
    } catch (err) {
      if (!mountedRef.current || id !== runIdRef.current) return;
      setState({
        status: "error",
        error: err instanceof Error ? err.message : "خطای ناشناخته",
        retryable: true,
      });
    }
  }, []);

  const depsKey = JSON.stringify(deps);
  useEffect(() => {
    if (!auto) return;
    // Defer to a microtask so React sees this as an async user-triggered
    // update (satisfies the "no setState in effect body" rule).
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) void run();
    });
    return () => {
      cancelled = true;
    };
    // depsKey encodes the caller-provided dep list.
  }, [run, auto, depsKey]);

  return {
    ...state,
    /** Manual retry — safe to call from Error UI. */
    retry: run,
    /** Alias for parity with legacy code. */
    refetch: run,
  } as AsyncState<T> & { retry: () => Promise<void>; refetch: () => Promise<void> };
}

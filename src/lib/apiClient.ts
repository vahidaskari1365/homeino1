// ============================================================
// API CLIENT — production-grade fetch wrapper.
//
// This is the single place the client makes HTTP calls from.
// It gives every future backend integration:
//   • Explicit loading / success / error / retry / timeout / abort
//   • Standardized ApiResult tagged union (never throws to callers
//     that use `apiCall(...)`, so UIs can pattern-match instead of
//     wrapping try/catch everywhere)
//   • Automatic JSON parsing with typed responses
//   • Exponential-backoff retry for GET-idempotent calls
//   • Abort support (compose with useEffect cleanup / user cancel)
//
// The base URL is resolved from `NEXT_PUBLIC_API_BASE_URL` when set,
// or defaults to relative `/api` (Next.js Route Handlers). This means
// the same code works against the current mock API, a Supabase-backed
// route, or a fully external service — no UI change required.
// ============================================================

export type ApiOk<T> = { ok: true; data: T; status: number };
export type ApiErr = {
  ok: false;
  status: number;
  code: "network" | "timeout" | "abort" | "http" | "parse" | "unknown";
  message: string;
  /** Optional partial payload the server returned (validation errors, etc.). */
  details?: unknown;
};
export type ApiResult<T> = ApiOk<T> | ApiErr;

export interface ApiCallOptions extends Omit<RequestInit, "body" | "signal"> {
  /** JSON body — serialized automatically; sets `Content-Type: application/json`. */
  json?: unknown;
  /** Raw body (multipart, etc.). Wins over `json`. */
  body?: BodyInit | null;
  /** Timeout in ms (default 20_000). Set to 0 to disable. */
  timeoutMs?: number;
  /** External abort signal — composed with the internal timeout signal. */
  signal?: AbortSignal;
  /** How many retry attempts for transient failures on idempotent methods. Default 2. */
  retries?: number;
  /** Base backoff (ms). Default 400 → 400ms, 800ms, 1600ms … */
  retryBackoffMs?: number;
  /** Force retry regardless of method (opt-in for POST). */
  retryPost?: boolean;
}

const DEFAULT_TIMEOUT = 20_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_BACKOFF = 400;

function getBaseUrl(): string {
  // Only NEXT_PUBLIC_ vars ship to the client. If unset, use relative paths
  // so the same handler can serve both dev and prod without a rebuild.
  if (typeof process !== "undefined" && process.env.NEXT_PUBLIC_API_BASE_URL) {
    return process.env.NEXT_PUBLIC_API_BASE_URL.replace(/\/+$/, "");
  }
  return "";
}

function isIdempotent(method: string): boolean {
  const m = method.toUpperCase();
  return m === "GET" || m === "HEAD" || m === "OPTIONS";
}

function composeSignals(a: AbortSignal | undefined, b: AbortSignal): AbortSignal {
  if (!a) return b;
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  a.addEventListener("abort", onAbort, { once: true });
  b.addEventListener("abort", onAbort, { once: true });
  if (a.aborted || b.aborted) ctl.abort();
  return ctl.signal;
}

async function parseBody<T>(res: Response): Promise<T | undefined> {
  const type = res.headers.get("content-type") ?? "";
  if (!type.includes("application/json")) {
    return undefined;
  }
  try {
    return (await res.json()) as T;
  } catch {
    return undefined;
  }
}

/**
 * Run an HTTP request and return a typed `ApiResult` (never throws for
 * callers). Consumers should discriminate on `result.ok`.
 */
export async function apiCall<T>(path: string, options: ApiCallOptions = {}): Promise<ApiResult<T>> {
  const {
    json,
    body,
    timeoutMs = DEFAULT_TIMEOUT,
    signal,
    retries = DEFAULT_RETRIES,
    retryBackoffMs = DEFAULT_BACKOFF,
    retryPost,
    headers,
    method = "GET",
    ...rest
  } = options;

  const url = path.startsWith("http") ? path : `${getBaseUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  const attempts = 1 + (isIdempotent(method) || retryPost ? retries : 0);

  let lastErr: ApiErr | null = null;

  for (let attempt = 0; attempt < attempts; attempt++) {
    const timeoutCtl = new AbortController();
    const timeoutId = timeoutMs > 0 ? setTimeout(() => timeoutCtl.abort(), timeoutMs) : null;

    try {
      const finalBody = body !== undefined ? body : json !== undefined ? JSON.stringify(json) : undefined;
      const finalHeaders: HeadersInit = {
        ...(json !== undefined ? { "Content-Type": "application/json" } : {}),
        Accept: "application/json",
        ...headers,
      };

      const res = await fetch(url, {
        ...rest,
        method,
        headers: finalHeaders,
        body: finalBody,
        signal: composeSignals(signal, timeoutCtl.signal),
      });

      const data = await parseBody<T>(res);

      if (!res.ok) {
        lastErr = {
          ok: false,
          status: res.status,
          code: "http",
          message: `HTTP ${res.status}`,
          details: data,
        };
        // Retry only transient server errors (5xx) or 429.
        if (attempt < attempts - 1 && (res.status >= 500 || res.status === 429)) {
          await sleep(retryBackoffMs * 2 ** attempt);
          continue;
        }
        return lastErr;
      }

      return { ok: true, data: data as T, status: res.status };
    } catch (err) {
      const aborted = (err as { name?: string })?.name === "AbortError";
      const isTimeout = aborted && timeoutCtl.signal.aborted;
      const externallyAborted = aborted && signal?.aborted;

      lastErr = {
        ok: false,
        status: 0,
        code: externallyAborted ? "abort" : isTimeout ? "timeout" : "network",
        message: err instanceof Error ? err.message : "Network error",
      };

      // Only retry network / timeout, and never after external abort.
      if (!externallyAborted && attempt < attempts - 1) {
        await sleep(retryBackoffMs * 2 ** attempt);
        continue;
      }
      return lastErr;
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  }

  return lastErr ?? { ok: false, status: 0, code: "unknown", message: "Unknown error" };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Convenience wrappers. */
export const api = {
  get: <T>(path: string, opts?: ApiCallOptions) => apiCall<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, json?: unknown, opts?: ApiCallOptions) => apiCall<T>(path, { ...opts, method: "POST", json }),
  put: <T>(path: string, json?: unknown, opts?: ApiCallOptions) => apiCall<T>(path, { ...opts, method: "PUT", json }),
  patch: <T>(path: string, json?: unknown, opts?: ApiCallOptions) => apiCall<T>(path, { ...opts, method: "PATCH", json }),
  delete: <T>(path: string, opts?: ApiCallOptions) => apiCall<T>(path, { ...opts, method: "DELETE" }),
};

/** Human-friendly Persian message for an ApiErr, safe to show in the UI. */
export function apiErrorMessage(err: ApiErr): string {
  switch (err.code) {
    case "network":
      return "اتصال به سرور برقرار نشد — اتصال اینترنتت را بررسی کن.";
    case "timeout":
      return "پاسخ سرور بیش از حد طول کشید — لطفاً دوباره تلاش کن.";
    case "abort":
      return "درخواست لغو شد.";
    case "http":
      if (err.status === 401) return "برای ادامه باید وارد شوی.";
      if (err.status === 403) return "دسترسی به این عملیات مجاز نیست.";
      if (err.status === 404) return "اطلاعات درخواستی یافت نشد.";
      if (err.status === 429) return "درخواست‌ها بیش از حد است — کمی صبر کن.";
      if (err.status >= 500) return "سرور در حال حاضر پاسخگو نیست — بعداً تلاش کن.";
      return "درخواست ناموفق بود.";
    case "parse":
      return "پاسخ سرور نامعتبر است.";
    default:
      return "خطای غیرمنتظره — دوباره تلاش کن.";
  }
}

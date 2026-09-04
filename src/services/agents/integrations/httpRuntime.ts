// ============================================================
// HOMEINO — HTTP RUNTIME (guarded external requests)
//
// External calls are only allowed to an explicit allowlist:
//   HOMEINO_AGENT_ALLOWED_DOMAINS="example.com,api.partner.ir"
// plus the Homeino site host and the catalog CDN.
//
// The runtime never follows redirects off the allowlist, caps the response size
// and always returns structured data (no HTML is ever persisted).
// ============================================================

const MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 10_000;

export function allowedDomains(extra: string[] = []): string[] {
  const fromEnv = (process.env.HOMEINO_AGENT_ALLOWED_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
  const site = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://homeino.ir").hostname.toLowerCase();
    } catch {
      return "homeino.ir";
    }
  })();
  const integrations = [
    process.env.DIFY_API_BASE_URL,
    process.env.LANGFLOW_BASE_URL,
    process.env.OLLAMA_BASE_URL,
    process.env.MEM0_BASE_URL,
    process.env.BROWSER_USE_API_BASE_URL,
    process.env.STAGEHAND_API_BASE_URL,
  ]
    .filter((v): v is string => Boolean(v))
    .map((v) => {
      try {
        return new URL(v).hostname.toLowerCase();
      } catch {
        return "";
      }
    })
    .filter(Boolean);
  return [...new Set([...fromEnv, ...integrations, site, ...extra.map((d) => d.toLowerCase())])];
}

export function isDomainAllowed(url: string, extra: string[] = []): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
    const host = parsed.hostname.toLowerCase();
    return allowedDomains(extra).some((domain) => host === domain || host.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

export interface HttpTaskRequest {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  allowedDomains?: string[];
  expectJson?: boolean;
}

export interface HttpTaskResult {
  ok: boolean;
  status?: number;
  url: string;
  contentType?: string;
  json?: unknown;
  excerpt?: string;
  bytes?: number;
  error?: string;
  blocked?: boolean;
}

export async function runHttpTask(request: HttpTaskRequest): Promise<HttpTaskResult> {
  const method = (request.method ?? "GET").toUpperCase();
  if (!["GET", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return { ok: false, url: request.url, error: "method not allowed", blocked: true };
  }
  if (!isDomainAllowed(request.url, request.allowedDomains ?? [])) {
    return {
      ok: false,
      url: request.url,
      blocked: true,
      error: `دامنه در allowlist نیست. دامنه‌های مجاز: ${allowedDomains(request.allowedDomains ?? []).join(", ") || "(هیچ)"}`,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), request.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  try {
    const res = await fetch(request.url, {
      method,
      redirect: "error", // never follow a redirect off the allowlist
      signal: controller.signal,
      headers: { Accept: "application/json, text/plain;q=0.8", ...(request.headers ?? {}) },
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const contentType = res.headers.get("content-type") ?? "";
    const text = (await res.text()).slice(0, MAX_RESPONSE_BYTES);
    let json: unknown;
    if (contentType.includes("application/json")) {
      try {
        json = JSON.parse(text);
      } catch {
        json = undefined;
      }
    }
    return {
      ok: res.ok,
      status: res.status,
      url: request.url,
      contentType,
      json,
      excerpt: text.slice(0, 2000),
      bytes: text.length,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (error) {
    return { ok: false, url: request.url, error: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

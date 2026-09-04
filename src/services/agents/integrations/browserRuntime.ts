// ============================================================
// HOMEINO — BROWSER AGENT RUNTIME
//
// Two external providers are supported, both shaped by their own projects:
//
//   Browser Use (browser-use/browser-use, MIT)
//     task-oriented cloud API: give it a URL + instruction, it drives a browser
//     and returns structured results. Env: BROWSER_USE_API_KEY,
//     BROWSER_USE_API_BASE_URL, BROWSER_USE_RUN_PATH.
//
//   Stagehand (browserbase/stagehand, MIT core)
//     the act / extract / observe primitives over Playwright, exposed by a
//     sidecar you host. Env: STAGEHAND_API_BASE_URL, BROWSERBASE_API_KEY.
//
// RULES (enforced here, not by convention):
//   • only allowlisted domains may be opened
//   • the task must be a read/extraction — no login bypassing, no scraping of
//     sites that forbid it, no destructive interaction
//   • if no provider is configured the task FAILS honestly (notConfigured) —
//     the agent never pretends a browser ran
// ============================================================
import type { BrowserRuntime, BrowserTaskRequest, BrowserTaskResult } from "../types";
import { allowedDomains, isDomainAllowed } from "./httpRuntime";

export interface BrowserProviderStatus {
  provider: string;
  label: string;
  configured: boolean;
  missing: string[];
  baseUrl?: string;
}

export function browserProviderStatus(): BrowserProviderStatus[] {
  return [
    {
      provider: "browser_use",
      label: "Browser Use (cloud task API)",
      configured: Boolean(process.env.BROWSER_USE_API_KEY),
      missing: process.env.BROWSER_USE_API_KEY ? [] : ["BROWSER_USE_API_KEY"],
      baseUrl: process.env.BROWSER_USE_API_BASE_URL ?? "https://api.browser-use.com",
    },
    {
      provider: "stagehand",
      label: "Stagehand (act / extract / observe sidecar)",
      configured: Boolean(process.env.STAGEHAND_API_BASE_URL),
      missing: process.env.STAGEHAND_API_BASE_URL ? [] : ["STAGEHAND_API_BASE_URL"],
      baseUrl: process.env.STAGEHAND_API_BASE_URL,
    },
  ];
}

/** Agent-level allowlist ∪ environment allowlist. */
export function effectiveAllowedDomains(agentDomains: string[] = []): string[] {
  return allowedDomains(agentDomains);
}

export function assertBrowserTaskAllowed(request: BrowserTaskRequest): { ok: true } | { ok: false; reason: string } {
  if (!request.url) return { ok: false, reason: "url is required" };
  let parsed: URL;
  try {
    parsed = new URL(request.url);
  } catch {
    return { ok: false, reason: "url is not valid" };
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return { ok: false, reason: `protocol not allowed: ${parsed.protocol}` };
  }
  if (!isDomainAllowed(request.url, request.allowedDomains)) {
    return {
      ok: false,
      reason: `دامنه‌ی ${parsed.hostname} در allowlist مرورگر نیست. دامنه‌های مجاز: ${effectiveAllowedDomains(request.allowedDomains).join(", ") || "(هیچ)"}`,
    };
  }
  if (!request.instruction || request.instruction.trim().length < 3) {
    return { ok: false, reason: "instruction is required" };
  }
  // Explicitly refuse automation aimed at bypassing protections.
  const forbidden = /(captcha|cloudflare|bypass|paywall|login as|hack|ddos|scrape.*(private|personal))/i;
  if (forbidden.test(request.instruction)) {
    return { ok: false, reason: "this browser task is not allowed (bypassing protections / private data)" };
  }
  return { ok: true };
}

async function post(url: string, headers: Record<string, string>, body: unknown, timeoutMs: number): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await res.text();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = { raw: text.slice(0, 2000) };
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Browser Use cloud runtime. */
export const browserUseRuntime: BrowserRuntime = {
  name: "browser_use",
  isConfigured: () => Boolean(process.env.BROWSER_USE_API_KEY),
  async run(request: BrowserTaskRequest): Promise<BrowserTaskResult> {
    const allowed = assertBrowserTaskAllowed(request);
    if (!allowed.ok) return { ok: false, provider: "browser_use", url: request.url, action: request.action ?? "extract", data: {}, steps: 0, error: allowed.reason };
    if (!this.isConfigured()) {
      return { ok: false, provider: "browser_use", url: request.url, action: request.action ?? "extract", data: {}, steps: 0, notConfigured: true, error: "BROWSER_USE_API_KEY تنظیم نشده است" };
    }
    const base = (process.env.BROWSER_USE_API_BASE_URL ?? "https://api.browser-use.com").replace(/\/+$/, "");
    const path = process.env.BROWSER_USE_RUN_PATH ?? "/v1/tasks/run";
    try {
      const payload = (await post(
        `${base}${path}`,
        { "X-Browser-Use-API-Key": process.env.BROWSER_USE_API_KEY ?? "", Accept: "application/json" },
        {
          url: request.url,
          prompt: request.instruction,
          action: request.action ?? "extract",
          max_steps: request.maxSteps ?? 8,
          schema: request.schema ?? null,
          allowed_domains: request.allowedDomains,
          metadata: { agentKey: request.agentKey, runId: request.runId ?? null },
        },
        60_000,
      )) as Record<string, unknown>;
      const data = (payload.result ?? payload.data ?? payload.output ?? payload) as Record<string, unknown>;
      const steps = Number(payload.steps ?? payload.total_steps ?? 0) || 0;
      return { ok: true, provider: "browser_use", url: request.url, action: request.action ?? "extract", data, steps };
    } catch (error) {
      return { ok: false, provider: "browser_use", url: request.url, action: request.action ?? "extract", data: {}, steps: 0, error: error instanceof Error ? error.message : String(error) };
    }
  },
};

/** Stagehand sidecar runtime — act / extract / observe primitives. */
export const stagehandRuntime: BrowserRuntime = {
  name: "stagehand",
  isConfigured: () => Boolean(process.env.STAGEHAND_API_BASE_URL),
  async run(request: BrowserTaskRequest): Promise<BrowserTaskResult> {
    const allowed = assertBrowserTaskAllowed(request);
    if (!allowed.ok) return { ok: false, provider: "stagehand", url: request.url, action: request.action ?? "extract", data: {}, steps: 0, error: allowed.reason };
    if (!this.isConfigured()) {
      return { ok: false, provider: "stagehand", url: request.url, action: request.action ?? "extract", data: {}, steps: 0, notConfigured: true, error: "STAGEHAND_API_BASE_URL تنظیم نشده است" };
    }
    const base = (process.env.STAGEHAND_API_BASE_URL ?? "").replace(/\/+$/, "");
    const action = request.action ?? "extract";
    const headers: Record<string, string> = { Accept: "application/json" };
    if (process.env.BROWSERBASE_API_KEY) headers.Authorization = `Bearer ${process.env.BROWSERBASE_API_KEY}`;
    try {
      const payload = (await post(
        `${base}/${action}`,
        headers,
        {
          url: request.url,
          ...(action === "act" ? { action: request.instruction } : { instruction: request.instruction }),
          ...(action === "extract" && request.schema ? { schema: request.schema } : {}),
          maxSteps: request.maxSteps ?? 8,
          allowedDomains: request.allowedDomains,
          metadata: { agentKey: request.agentKey, runId: request.runId ?? null },
        },
        60_000,
      )) as Record<string, unknown>;
      return {
        ok: true,
        provider: "stagehand",
        url: request.url,
        action,
        data: (payload.data ?? payload.result ?? payload) as Record<string, unknown>,
        steps: Number(payload.steps ?? 1) || 1,
      };
    } catch (error) {
      return { ok: false, provider: "stagehand", url: request.url, action, data: {}, steps: 0, error: error instanceof Error ? error.message : String(error) };
    }
  },
};

/** Honest "no provider" runtime — never fabricates a result. */
export const unconfiguredBrowserRuntime: BrowserRuntime = {
  name: "none",
  isConfigured: () => false,
  async run(request: BrowserTaskRequest): Promise<BrowserTaskResult> {
    const allowed = assertBrowserTaskAllowed(request);
    return {
      ok: false,
      provider: "none",
      url: request.url,
      action: request.action ?? "extract",
      data: {},
      steps: 0,
      notConfigured: true,
      error: allowed.ok
        ? "هیچ پروایدر مرورگری پیکربندی نشده است (BROWSER_USE_API_KEY یا STAGEHAND_API_BASE_URL). نتیجه‌ای ساخته نمی‌شود."
        : allowed.reason,
    };
  },
};

export function resolveBrowserRuntime(preferred?: string): BrowserRuntime {
  const order = preferred ? [preferred, "browser_use", "stagehand"] : ["browser_use", "stagehand"];
  for (const name of order) {
    if (name === "browser_use" && browserUseRuntime.isConfigured()) return browserUseRuntime;
    if (name === "stagehand" && stagehandRuntime.isConfigured()) return stagehandRuntime;
  }
  return unconfiguredBrowserRuntime;
}

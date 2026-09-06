// ============================================================
// Z-Image Engine config resolution (SERVER-ONLY).
//
// Single source of truth for where the engine credentials come
// from. Two flavors, used differently:
//   • env  → ORALI_API_BASE_URL|ZAI_API_BASE_URL|GLM_API_BASE_URL
//            + *_API_KEY (+ZAI_API_TOKEN) — production deployments
//            with real keys (the official z.ai GLM API works here)
//   • file → `.z-ai-config` JSON (baseUrl, apiKey, token?) in
//            process cwd / $HOME / /etc — sandbox & self-hosted
//
// FLAVOR — how the base URL is spoken to:
//   "engine"      self-hosted / sandbox engine:
//                   POST {base}/chat/completions · /images/generations[·/edit]
//   "zai-public"  official z.ai GLM API (api.z.ai):
//                   base is normalized to https://api.z.ai/api/paas/v4
//                   POST {base}/chat/completions · /images/generations
//                   (generation only — the public API has NO edit endpoint)
//
// Never imported by client bundles. Values never leave the server.
// ============================================================
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type EngineFlavor = "engine" | "zai-public";

export interface EngineConfig {
  baseUrl: string;
  apiKey: string;
  token?: string;
  /** where the config came from — useful for honest status reporting */
  source: "env" | "file";
  /** which dialect the endpoint speaks (paths + default models differ) */
  flavor: EngineFlavor;
  /** chat model override — default per flavor inside the client */
  chatModel?: string;
  /** image-generation model override (public API requires a model param) */
  imageModel?: string;
}

/** The official z.ai GLM API base, normalized so {base}/chat/completions works. */
export function normalizePublicZaiBase(raw: string): string {
  const url = new URL(raw);
  let path = url.pathname.replace(/\/+$/, "");
  if (!path.endsWith("/paas/v4")) {
    path += path.endsWith("/api") ? "/paas/v4" : "/api/paas/v4";
  }
  return `${url.protocol}//${url.host}${path}`;
}

/** ONLY the official public host → "zai-public". Note: internal-api.z.ai
 *  (sandbox engine) must stay "engine" — it has its own edit endpoint. */
export function detectFlavor(rawBaseUrl: string): EngineFlavor {
  try {
    return new URL(rawBaseUrl).hostname.toLowerCase() === "api.z.ai" ? "zai-public" : "engine";
  } catch {
    return "engine";
  }
}

function resolveFlavor(rawBaseUrl: string): { baseUrl: string; flavor: EngineFlavor } {
  const flavor = detectFlavor(rawBaseUrl);
  return flavor === "zai-public"
    ? { flavor, baseUrl: normalizePublicZaiBase(rawBaseUrl) }
    : { flavor, baseUrl: rawBaseUrl.replace(/\/+$/, "") };
}

function readModels(): { chatModel?: string; imageModel?: string } {
  const chatModel = (process.env.ZAI_CHAT_MODEL || process.env.GLM_CHAT_MODEL || "").trim() || undefined;
  const imageModel = (process.env.ZAI_IMAGE_MODEL || process.env.GLM_IMAGE_MODEL || "").trim() || undefined;
  return { chatModel, imageModel };
}

function fromEnv(): EngineConfig | null {
  const rawBase = process.env.ORALI_API_BASE_URL || process.env.ZAI_API_BASE_URL || process.env.GLM_API_BASE_URL || "";
  const apiKey = process.env.ORALI_API_KEY || process.env.ZAI_API_KEY || process.env.GLM_API_KEY || "";
  if (rawBase && apiKey) {
    const { baseUrl, flavor } = resolveFlavor(rawBase);
    return { baseUrl, apiKey, token: process.env.ZAI_API_TOKEN || undefined, source: "env", flavor, ...readModels() };
  }
  return null;
}

function fromFile(): EngineConfig | null {
  for (const dir of [process.cwd(), homedir(), "/etc"]) {
    try {
      const file = join(dir, ".z-ai-config");
      if (!existsSync(file)) continue;
      const cfg = JSON.parse(readFileSync(file, "utf8")) as Partial<EngineConfig>;
      if (cfg.baseUrl && cfg.apiKey) {
        const { baseUrl, flavor } = resolveFlavor(String(cfg.baseUrl));
        return {
          baseUrl,
          apiKey: String(cfg.apiKey),
          token: cfg.token ? String(cfg.token) : undefined,
          source: "file",
          flavor,
        };
      }
    } catch { /* try next location */ }
  }
  return null;
}

export function engineConfig(): EngineConfig | null {
  return fromEnv() ?? fromFile();
}

export function isZEngineConfigured(): boolean {
  return engineConfig() !== null;
}

/** File-based only (sandbox / self-hosted) — treated as sample mode. */
export function isZEngineFileConfigured(): boolean {
  return engineConfig()?.source === "file";
}

/** Env-based only (production keys) — treated as a real paid provider. */
export function isZEngineEnvConfigured(): boolean {
  return engineConfig()?.source === "env";
}

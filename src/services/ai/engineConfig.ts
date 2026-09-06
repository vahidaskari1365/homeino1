// ============================================================
// Z-Image Engine config resolution (SERVER-ONLY).
//
// Single source of truth for where the engine credentials come
// from. Two flavors, used differently:
//   • env  → ORALI_API_BASE_URL|ZAI_API_BASE_URL + *_API_KEY (+ZAI_API_TOKEN)
//            production deployments with real keys
//   • file → `.z-ai-config` JSON (baseUrl, apiKey, token?) in
//            process cwd / $HOME / /etc — sandbox & self-hosted
//
// Never imported by client bundles. Values never leave the server.
// ============================================================
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface EngineConfig {
  baseUrl: string;
  apiKey: string;
  token?: string;
  /** where the config came from — useful for honest status reporting */
  source: "env" | "file";
}

function fromEnv(): EngineConfig | null {
  const baseUrl = (process.env.ORALI_API_BASE_URL || process.env.ZAI_API_BASE_URL || "").replace(/\/+$/, "");
  const apiKey = process.env.ORALI_API_KEY || process.env.ZAI_API_KEY || "";
  if (baseUrl && apiKey) {
    return { baseUrl, apiKey, token: process.env.ZAI_API_TOKEN || undefined, source: "env" };
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
        return {
          baseUrl: String(cfg.baseUrl).replace(/\/+$/, ""),
          apiKey: String(cfg.apiKey),
          token: cfg.token ? String(cfg.token) : undefined,
          source: "file",
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

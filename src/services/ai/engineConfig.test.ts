// ============================================================
// Engine config tests — GLM public API wiring (z.ai official).
// Covers: host→flavor detection (public vs internal engine!),
// base-URL normalization, env aliases precedence, model overrides.
// ============================================================
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectFlavor,
  engineConfig,
  normalizePublicZaiBase,
} from "./engineConfig";

const ENV_KEYS = [
  "ORALI_API_BASE_URL", "ORALI_API_KEY",
  "ZAI_API_BASE_URL", "ZAI_API_KEY", "ZAI_API_TOKEN",
  "ZAI_CHAT_MODEL", "ZAI_IMAGE_MODEL",
  "GLM_API_BASE_URL", "GLM_API_KEY", "GLM_CHAT_MODEL", "GLM_IMAGE_MODEL",
] as const;

const saved = new Map<string, string | undefined>();

beforeEach(() => {
  for (const k of ENV_KEYS) {
    saved.set(k, process.env[k]);
    delete process.env[k];
  }
});

afterEach(() => {
  for (const [k, v] of saved) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("detectFlavor", () => {
  it("classifies ONLY the official public host as zai-public", () => {
    expect(detectFlavor("https://api.z.ai/api")).toBe("zai-public");
    expect(detectFlavor("https://API.Z.AI/api/paas/v4")).toBe("zai-public");
  });

  it("keeps the sandbox internal engine on the engine dialect", () => {
    // critical: internal-api.z.ai has /images/generations/edit — it must
    // NEVER be normalized into the public /paas/v4 shape
    expect(detectFlavor("https://internal-api.z.ai/v1")).toBe("engine");
    expect(detectFlavor("https://my-selfhost.local/v1")).toBe("engine");
  });
});

describe("normalizePublicZaiBase", () => {
  it("accepts every common shape the user may paste", () => {
    expect(normalizePublicZaiBase("https://api.z.ai")).toBe("https://api.z.ai/api/paas/v4");
    expect(normalizePublicZaiBase("https://api.z.ai/")).toBe("https://api.z.ai/api/paas/v4");
    expect(normalizePublicZaiBase("https://api.z.ai/api")).toBe("https://api.z.ai/api/paas/v4");
    expect(normalizePublicZaiBase("https://api.z.ai/api/paas/v4")).toBe("https://api.z.ai/api/paas/v4");
    expect(normalizePublicZaiBase("https://api.z.ai/api/paas/v4/")).toBe("https://api.z.ai/api/paas/v4");
  });
});

describe("engineConfig env resolution", () => {
  it("resolves GLM_* aliases against the official public API", () => {
    process.env.GLM_API_BASE_URL = "https://api.z.ai";
    process.env.GLM_API_KEY = "test-key";
    const cfg = engineConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.flavor).toBe("zai-public");
    expect(cfg!.baseUrl).toBe("https://api.z.ai/api/paas/v4");
    expect(cfg!.source).toBe("env");
  });

  it("keeps self-hosted engine URLs untouched", () => {
    process.env.ZAI_API_BASE_URL = "https://internal-api.z.ai/v1";
    process.env.ZAI_API_KEY = "test-key";
    const cfg = engineConfig();
    expect(cfg!.flavor).toBe("engine");
    expect(cfg!.baseUrl).toBe("https://internal-api.z.ai/v1");
  });

  it("prefers ORALI/ZAI over GLM when several are set", () => {
    process.env.ZAI_API_BASE_URL = "https://internal-api.z.ai/v1";
    process.env.ZAI_API_KEY = "engine-key";
    process.env.GLM_API_BASE_URL = "https://api.z.ai/api";
    process.env.GLM_API_KEY = "glm-key";
    const cfg = engineConfig();
    expect(cfg!.flavor).toBe("engine");
    expect(cfg!.baseUrl).toBe("https://internal-api.z.ai/v1");
  });

  it("falls back to the file config when the env pair is incomplete", () => {
    process.env.GLM_API_BASE_URL = "https://api.z.ai/api"; // key missing
    const cfg = engineConfig();
    // sandbox/self-hosted `.z-ai-config` may legitimately take over —
    // what matters is that env did NOT half-apply
    if (cfg) expect(cfg.source).toBe("file");
    else expect(cfg).toBeNull();
  });

  it("reads chat/image model overrides from both alias families", () => {
    process.env.GLM_API_BASE_URL = "https://api.z.ai/api";
    process.env.GLM_API_KEY = "test-key";
    process.env.GLM_CHAT_MODEL = "glm-5.3";
    process.env.ZAI_IMAGE_MODEL = "glm-image";
    const cfg = engineConfig();
    expect(cfg!.chatModel).toBe("glm-5.3");
    expect(cfg!.imageModel).toBe("glm-image");
  });
});

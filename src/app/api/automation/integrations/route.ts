// ============================================================
// /api/automation/integrations — external platform connections (admin)
//
//   GET   list connections + whether each secret is actually configured
//   PATCH { provider, baseUrl?, isActive?, label?, capabilities?, config? }
//
// Secrets are NEVER returned — only the env var NAME and a boolean.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { getStore } from "@/services/agents/store";
import { llmStatus } from "@/services/agents/llmGateway";
import { browserProviderStatus } from "@/services/agents/integrations/browserRuntime";
import { allowedDomains } from "@/services/agents/integrations/httpRuntime";
import { isDifyConfigured, isLangflowConfigured } from "@/services/agents/integrations/externalRuntimes";
import { isMem0Configured } from "@/services/memory/customerMemory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const store = await getStore();
  const items = await store.listIntegrations();

  const configured: Record<string, boolean> = {
    dify: isDifyConfigured(),
    langflow: isLangflowConfigured(),
    mem0: isMem0Configured(),
    ollama: Boolean(process.env.OLLAMA_BASE_URL),
    browser_use: Boolean(process.env.BROWSER_USE_API_KEY),
    stagehand: Boolean(process.env.STAGEHAND_API_BASE_URL ?? process.env.STAGEHAND_SIDECAR_URL),
  };

  return ok({
    items: items.map((item) => ({
      ...item,
      secretConfigured: item.secretEnvVar ? Boolean(process.env[item.secretEnvVar]) : false,
      secretEnvVar: item.secretEnvVar ?? null,
      runtimeConfigured: configured[item.provider] ?? false,
    })),
    llm: llmStatus(),
    browser: browserProviderStatus(),
    httpAllowlist: allowedDomains(),
  });
});

export const PATCH = guard(async (req) => {
  await requireAdminUser(req);
  const body = (await readBody(req, 50_000)) as Record<string, unknown>;
  const provider = String(body.provider ?? "").trim().slice(0, 60);
  if (!provider) throw ApiError.badRequest("provider الزامی است");

  const store = await getStore();
  const patch: Parameters<typeof store.updateIntegration>[1] = {};
  if (typeof body.baseUrl === "string") {
    const url = body.baseUrl.trim();
    if (url && !/^https?:\/\//i.test(url)) throw ApiError.badRequest("baseUrl باید با http(s) شروع شود");
    patch.baseUrl = url.slice(0, 300) || null;
  }
  if (typeof body.label === "string") patch.label = body.label.slice(0, 160);
  if (typeof body.isActive === "boolean") patch.isActive = body.isActive;
  if (typeof body.healthStatus === "string") patch.healthStatus = body.healthStatus.slice(0, 30);
  if (Array.isArray(body.capabilities)) patch.capabilities = body.capabilities.filter((c): c is string => typeof c === "string").slice(0, 20);
  if (body.config && typeof body.config === "object") patch.config = body.config as Record<string, unknown>;
  // A secret VALUE is never accepted here — only the env var name that holds it.
  if (typeof body.secretEnvVar === "string") patch.secretEnvVar = body.secretEnvVar.replace(/[^A-Z0-9_]/gi, "").slice(0, 60) || null;

  if (!Object.keys(patch).length) throw ApiError.badRequest("هیچ فیلد قابل بروزرسانی ارسال نشد");
  const updated = await store.updateIntegration(provider, patch);
  if (!updated) throw ApiError.notFound(`اتصال «${provider}» پیدا نشد`);
  return ok({ integration: { ...updated, secretConfigured: updated.secretEnvVar ? Boolean(process.env[updated.secretEnvVar]) : false } });
});

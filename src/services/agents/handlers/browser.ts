// ============================================================
// HOMEINO — BROWSER AGENT HANDLER
//
// Only for allowed tasks: open an allowlisted page, extract information,
// return structured data. Everything else is refused before any request is
// made, and the tool itself requires a human approval.
// ============================================================
import type { AgentHandler } from "./types";
import { num, str } from "./types";
import { assertBrowserTaskAllowed, effectiveAllowedDomains } from "../integrations/browserRuntime";

export const runBrowserAgent: AgentHandler = async (input, ctx) => {
  const url = str(input.url) ?? "";
  const instruction = str(input.instruction) ?? "";
  const action = (str(input.action) ?? "extract") as "goto" | "act" | "extract" | "observe";
  const agentDomains = Array.isArray(ctx.agent.config?.allowedDomains) ? (ctx.agent.config.allowedDomains as string[]) : [];
  const requestDomains = Array.isArray(input.allowedDomains) ? (input.allowedDomains as unknown[]).filter((d): d is string => typeof d === "string") : [];
  // The agent config is the ceiling — a request can narrow it, never widen it.
  const allowedDomains = agentDomains.length ? agentDomains.filter((d) => !requestDomains.length || requestDomains.includes(d)) : requestDomains;

  const check = assertBrowserTaskAllowed({
    url,
    instruction,
    action,
    allowedDomains,
    maxSteps: num(input.maxSteps ?? ctx.agent.config?.maxSteps, 8),
    schema: input.schema as Record<string, string> | undefined,
    agentKey: ctx.agent.key,
    runId: ctx.runId,
  });

  if (!check.ok) {
    ctx.log(`وظیفه مرورگر رد شد: ${check.reason}`);
    return { output: { dataState: "no_data", ok: false, blocked: true, reason: check.reason, allowedDomains: effectiveAllowedDomains(agentDomains) }, dataState: "no_data" };
  }

  const result = await ctx.callTool("browserTask", { url, instruction, action, allowedDomains, maxSteps: num(input.maxSteps ?? ctx.agent.config?.maxSteps, 8), schema: input.schema });
  const data = result.data as { ok?: boolean; provider?: string; data?: Record<string, unknown>; steps?: number; error?: string; notConfigured?: boolean } | undefined;

  if (!result.ok || !data?.ok) {
    return {
      output: {
        dataState: "no_data",
        ok: false,
        url,
        action,
        provider: data?.provider ?? "none",
        notConfigured: data?.notConfigured ?? false,
        error: data?.error ?? result.error ?? "browser task failed",
        allowedDomains: effectiveAllowedDomains(agentDomains),
      },
      dataState: "no_data",
    };
  }

  return {
    output: {
      dataState: "ok",
      ok: true,
      url,
      action,
      provider: data.provider,
      steps: data.steps ?? 0,
      data: data.data ?? {},
      allowedDomains: effectiveAllowedDomains(agentDomains),
    },
    dataState: "ok",
  };
};

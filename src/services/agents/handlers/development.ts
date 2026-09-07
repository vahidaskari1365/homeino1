// ============================================================
// HOMEINO — DEVELOPMENT AGENT
//
// Prompt Stage 4.8: Task → Agent → Plan → Code → Tests → Human
// Approval → Merge. Inside Homeino the agent owns the PLAN stage
// only: it turns a dev task into a structured implementation plan
// (files, steps, tests, risks) and files it for human approval.
// It has no write access to the codebase and no deploy path —
// code changes and merges stay with the human team.
// ============================================================
import type { AgentHandler } from "./types";
import { str } from "./types";

interface DevPlan {
  summary?: string;
  files?: string[];
  steps?: string[];
  tests?: string[];
  risks?: string[];
}

export const runDevelopmentAgent: AgentHandler = async (input, ctx) => {
  const task = str(input.task ?? input.description ?? ctx.agent.config?.defaultTask);
  if (!task) {
    return {
      output: { dataState: "no_data", reason: "missing_task_description" },
      dataState: "no_data",
    };
  }

  const scope = str(input.scope ?? ctx.agent.config?.scope) ?? "general";
  const llm = await ctx.callTool("llmComplete", {
    json: true,
    system:
      "تو معمار ارشد کد Homeino هستی. یک پلن پیاده‌سازی کوتاه و دقیق به فارسی بده. فقط JSON با کلیدهای summary, files, steps, tests, risks. هرگز دستور اجرا یا deploy صادر نکن.",
    prompt: `وظیفه توسعه:\n${task}\n\nدامنه: ${scope}\nپلن پیاده‌سازی را خروجی بده.`,
  });

  let plan: DevPlan | null = null;
  if (llm.ok) {
    const payload = llm.data as { json?: DevPlan; text?: string };
    plan = payload.json ?? null;
    if (!plan && str(payload.text)) {
      plan = { summary: str(payload.text) };
    }
  }
  if (!plan) {
    // Honest fallback: no LLM → deterministic minimal plan shell.
    plan = {
      summary: `پلن دستی برای: ${task}`,
      steps: ["بررسی کد فعلی", "پیاده‌سازی", "تست", "بازبینی انسانی"],
      tests: [],
      risks: ["بدون LLM — پلن حداقلی"],
    };
    ctx.log("LLM در دسترس نبود؛ پلن حداقلی ساخته شد");
  }

  const approvalId = await ctx.requestApproval(
    "development_plan",
    `پلن پیاده‌سازی «${task.slice(0, 80)}» آماده بازبینی است — پس از تأیید، تبدیل به تیکت می‌شود`,
    { scope, planSummary: plan.summary ?? "" },
  );

  const taskResult = await ctx.callTool("createTask", {
    title: `پلن توسعه: ${task.slice(0, 80)}`,
    type: "development_plan",
    priority: 3,
    assigneeRole: "admin",
    payload: { task, scope, plan, approvalId: approvalId ?? null, runId: ctx.runId },
  });

  ctx.log(`پلن توسعه برای «${task.slice(0, 60)}» ثبت شد — منتظر تأیید انسانی`);

  return {
    output: {
      dataState: "ok",
      task,
      scope,
      plan,
      approvalId: approvalId ?? null,
      taskId: str((taskResult.data as { taskId?: string })?.taskId) ?? null,
      note: "این ایجنت فقط پلن می‌سازد؛ تغییر کد و merge بدون تأیید انسانی انجام نمی‌شود.",
      summary: plan.summary ?? `پلن برای: ${task}`,
    },
    dataState: "ok",
    approvalId: approvalId ?? undefined,
  };
};

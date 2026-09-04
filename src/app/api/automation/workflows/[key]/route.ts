// ============================================================
// /api/automation/workflows/[key] — read / update / delete a workflow (admin)
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { getWorkflow, updateWorkflow, deleteWorkflow, WORKFLOW_STATUSES, TRIGGER_KINDS } from "@/services/workflows/registry";
import { listWorkflowRuns } from "@/services/automation/executionLog";
import type { WorkflowPatch } from "@/services/agents/store/types";
import type { WorkflowEdgeDefinition, WorkflowNodeDefinition } from "@/services/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/i;

async function readKey(params: Promise<{ key: string }>) {
  const { key } = await params;
  const clean = decodeURIComponent(key).trim();
  if (!KEY_RE.test(clean)) throw ApiError.badRequest("کلید ورک‌فلو نامعتبر است");
  return clean;
}

export const GET = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  await requireAdminUser(req);
  const key = await readKey(params);
  const workflow = await getWorkflow(key);
  if (!workflow) throw ApiError.notFound(`ورک‌فلو «${key}» پیدا نشد`);
  const runs = await listWorkflowRuns({ workflowKey: workflow.key, limit: 25 });
  return ok({ workflow, runs });
});

export const PATCH = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  const key = await readKey(params);
  await requireAdminUser(req);
  const body = (await readBody(req, 500_000)) as Record<string, unknown>;
  const patch: WorkflowPatch = {};

  if (typeof body.name === "string") patch.name = body.name.trim().slice(0, 160);
  if (typeof body.description === "string") patch.description = body.description.slice(0, 2000);
  if (typeof body.status === "string") {
    if (!WORKFLOW_STATUSES.includes(body.status as never)) throw ApiError.badRequest("status نامعتبر است");
    patch.status = body.status as never;
  }
  if (typeof body.runtime === "string") {
    if (!["local", "dify", "langflow"].includes(body.runtime)) throw ApiError.badRequest("runtime نامعتبر است");
    patch.runtime = body.runtime as never;
  }
  if (typeof body.triggerKind === "string") {
    if (!TRIGGER_KINDS.includes(body.triggerKind as never)) throw ApiError.badRequest("triggerKind نامعتبر است");
    patch.triggerKind = body.triggerKind as never;
  }
  if (body.trigger && typeof body.trigger === "object") patch.trigger = body.trigger as never;
  if (body.schedule !== undefined) patch.schedule = (body.schedule ?? null) as never;
  if (body.config && typeof body.config === "object") patch.config = body.config as Record<string, unknown>;

  if (Array.isArray(body.nodes)) {
    patch.nodes = body.nodes.slice(0, 60).map((entry, index) => {
      const node = (entry ?? {}) as Record<string, unknown>;
      const position = (node.position ?? {}) as Record<string, unknown>;
      return {
        key: String(node.key ?? `n${index + 1}`).slice(0, 40),
        type: String(node.type ?? "end") as WorkflowNodeDefinition["type"],
        label: typeof node.label === "string" ? node.label.slice(0, 160) : undefined,
        agentKey: typeof node.agentKey === "string" ? node.agentKey.slice(0, 80) : undefined,
        config: (node.config && typeof node.config === "object" ? node.config : {}) as Record<string, unknown>,
        position: { x: Number(position.x ?? 0) || 0, y: Number(position.y ?? 0) || 0 },
      };
    });
  }
  if (Array.isArray(body.edges)) {
    const keys = new Set((patch.nodes ?? []).map((n) => n.key));
    patch.edges = body.edges
      .slice(0, 120)
      .map((entry) => (entry ?? {}) as Record<string, unknown>)
      .filter((edge) => (keys.size ? keys.has(String(edge.from)) && keys.has(String(edge.to)) : true))
      .map(
        (edge): WorkflowEdgeDefinition => ({
          from: String(edge.from).slice(0, 40),
          to: String(edge.to).slice(0, 40),
          label: typeof edge.label === "string" && edge.label ? edge.label.slice(0, 40) : null,
        }),
      );
  }

  if (!Object.keys(patch).length) throw ApiError.badRequest("هیچ فیلد قابل بروزرسانی ارسال نشد");

  try {
    const workflow = await updateWorkflow(key, patch);
    if (!workflow) throw ApiError.notFound(`ورک‌فلو «${key}» پیدا نشد`);
    return ok({ workflow });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw ApiError.badRequest(error instanceof Error ? error.message : "بروزرسانی ورک‌فلو ناموفق بود");
  }
});

export const DELETE = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  await requireAdminUser(req);
  const key = await readKey(params);
  const workflow = await getWorkflow(key);
  if (!workflow) throw ApiError.notFound(`ورک‌فلو «${key}» پیدا نشد`);
  if (workflow.isBuiltin) throw ApiError.forbidden("ورک‌فلوهای داخلی قابل حذف نیستند — می‌توانی غیرفعالشان کنی");
  const deleted = await deleteWorkflow(key);
  return ok({ deleted, key });
});

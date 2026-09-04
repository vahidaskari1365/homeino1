// ============================================================
// /api/automation/workflows — Workflow Registry (admin)
//   GET  list workflows + builder metadata (node types, agents, triggers)
//   POST create a workflow (graph validated server-side)
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireAdminUser } from "@/lib/api/auth";
import {
  createWorkflow,
  listWorkflows,
  validateWorkflow,
  workflowBuilderMeta,
  WORKFLOW_STATUSES,
  TRIGGER_KINDS,
} from "@/services/workflows/registry";
import type { WorkflowEdgeDefinition, WorkflowNodeDefinition } from "@/services/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/;

function readNodes(raw: unknown): WorkflowNodeDefinition[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, 60).map((entry, index) => {
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

function readEdges(raw: unknown, nodes: WorkflowNodeDefinition[]): WorkflowEdgeDefinition[] {
  if (!Array.isArray(raw)) return [];
  const keys = new Set(nodes.map((n) => n.key));
  return raw
    .slice(0, 120)
    .map((entry) => (entry ?? {}) as Record<string, unknown>)
    .filter((edge) => keys.has(String(edge.from)) && keys.has(String(edge.to)))
    .map((edge) => ({
      from: String(edge.from).slice(0, 40),
      to: String(edge.to).slice(0, 40),
      label: typeof edge.label === "string" && edge.label ? edge.label.slice(0, 40) : null,
    }));
}

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const url = new URL(req.url);
  const [workflows, meta] = await Promise.all([listWorkflows(), workflowBuilderMeta()]);
  const status = url.searchParams.get("status");
  const items = status && WORKFLOW_STATUSES.includes(status as never) ? workflows.filter((w) => w.status === status) : workflows;
  return ok({ items, meta });
});

export const POST = guard(async (req) => {
  const { user } = await requireAdminUser(req);
  rateLimit(`workflows:create:${user.id}`, { windowMs: 60_000, max: 20 });
  const body = (await readBody(req, 500_000)) as Record<string, unknown>;

  const key = String(body.key ?? "").trim().toLowerCase();
  const name = String(body.name ?? "").trim();
  if (!KEY_RE.test(key)) throw ApiError.badRequest("کلید ورک‌فلو نامعتبر است (a-z 0-9 - _)");
  if (!name) throw ApiError.badRequest("نام ورک‌فلو الزامی است");

  const nodes = readNodes(body.nodes);
  const edges = readEdges(body.edges, nodes);
  const triggerKind = String(body.triggerKind ?? "manual");
  if (!TRIGGER_KINDS.includes(triggerKind as never)) throw ApiError.badRequest("triggerKind نامعتبر است");
  const status = String(body.status ?? "draft");
  if (!WORKFLOW_STATUSES.includes(status as never)) throw ApiError.badRequest("status نامعتبر است");

  const trigger = (body.trigger && typeof body.trigger === "object" ? body.trigger : {}) as Record<string, unknown>;
  const validation = await validateWorkflow({ key, name, nodes, edges, triggerKind: triggerKind as never, trigger: trigger as never });
  if (!validation.ok) throw ApiError.badRequest(validation.errors.join(" · "));

  try {
    const workflow = await createWorkflow(
      {
        key,
        name,
        description: typeof body.description === "string" ? body.description.slice(0, 2000) : undefined,
        status: status as never,
        runtime: (["local", "dify", "langflow"].includes(String(body.runtime)) ? String(body.runtime) : "local") as never,
        triggerKind: triggerKind as never,
        trigger: {
          eventTypes: Array.isArray(trigger.eventTypes) ? (trigger.eventTypes as unknown[]).filter((v): v is string => typeof v === "string").slice(0, 20) : undefined,
          windowMinutes: typeof trigger.windowMinutes === "number" ? Math.min(43200, Math.max(1, Math.round(trigger.windowMinutes))) : undefined,
          condition: typeof trigger.condition === "string" ? trigger.condition.slice(0, 400) : undefined,
        },
        schedule: (body.schedule && typeof body.schedule === "object" ? body.schedule : null) as never,
        config: (body.config && typeof body.config === "object" ? body.config : {}) as Record<string, unknown>,
        nodes,
        edges,
      },
      user.id,
    );
    return ok({ workflow, warnings: validation.warnings }, { status: 201 });
  } catch (error) {
    throw ApiError.conflict(error instanceof Error ? error.message : "ساخت ورک‌فلو ناموفق بود");
  }
});

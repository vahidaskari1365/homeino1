// ============================================================
// /api/automation/workflows/[key]/validate — dry validation of a stored or
// submitted graph (admin). Nothing is executed and nothing is written.
// ============================================================
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { ApiError } from "@/lib/api/errors";
import { requireAdminUser } from "@/lib/api/auth";
import { getWorkflow, validateWorkflow } from "@/services/workflows/registry";
import type { WorkflowNodeDefinition } from "@/services/agents/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/i;

export const POST = guard(async (req, { params }: { params: Promise<{ key: string }> }) => {
  await requireAdminUser(req);
  const { key } = await params;
  const workflowKey = decodeURIComponent(key).trim();
  if (!KEY_RE.test(workflowKey)) throw ApiError.badRequest("کلید ورک‌فلو نامعتبر است");

  const body = (await readBody(req, 500_000)) as Record<string, unknown>;
  const stored = await getWorkflow(workflowKey);

  const nodes = Array.isArray(body.nodes)
    ? (body.nodes as WorkflowNodeDefinition[]).slice(0, 60)
    : stored?.nodes ?? [];
  const edges = Array.isArray(body.edges) ? body.edges : stored?.edges ?? [];

  const validation = await validateWorkflow({
    key: workflowKey,
    name: typeof body.name === "string" ? body.name : stored?.name ?? workflowKey,
    nodes,
    edges: edges as never,
    triggerKind: (typeof body.triggerKind === "string" ? body.triggerKind : stored?.triggerKind ?? "manual") as never,
    trigger: (body.trigger && typeof body.trigger === "object" ? body.trigger : stored?.trigger ?? {}) as never,
  });

  return ok({
    workflowKey,
    ...validation,
    nodeCount: nodes.length,
    edgeCount: Array.isArray(edges) ? edges.length : 0,
    checkedAt: new Date().toISOString(),
  });
});

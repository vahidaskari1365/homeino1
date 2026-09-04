// ============================================================
// HOMEINO — WORKFLOW REGISTRY
//
// Workflows are stored graphs (nodes + edges) — the same shape Dify and
// Langflow use — so they can be executed locally today and delegated to an
// external platform later without changing the stored definition.
// ============================================================
import type { WorkflowDefinition, WorkflowEdgeDefinition, WorkflowNodeDefinition, WorkflowNodeType, WorkflowStatus, TriggerKind } from "../agents/types";
import type { NewWorkflowInput, WorkflowPatch } from "../agents/store/types";
import { ensureSeeded } from "../agents/store";
import { WORKFLOW_NODE_TYPES, NODE_TYPE_LABELS } from "../agents/defaults";
import { sanitizeSchedule } from "../agents/registry";
import { getAgent } from "../agents/registry";

export const TRIGGER_KINDS: TriggerKind[] = ["event", "schedule", "manual", "webhook"];
export const WORKFLOW_STATUSES: WorkflowStatus[] = ["draft", "active", "paused", "archived"];
export { WORKFLOW_NODE_TYPES, NODE_TYPE_LABELS };

const KEY_RE = /^[a-z0-9][a-z0-9-_]{1,79}$/;

export interface WorkflowValidation {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export function validateWorkflowGraph(input: {
  key?: string;
  name?: string;
  nodes?: WorkflowNodeDefinition[];
  edges?: WorkflowEdgeDefinition[];
  triggerKind?: TriggerKind;
  trigger?: WorkflowDefinition["trigger"];
}): WorkflowValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const nodes = input.nodes ?? [];
  const edges = input.edges ?? [];

  if (input.key !== undefined && !KEY_RE.test(input.key)) errors.push("کلید ورک‌فلو نامعتبر است (a-z 0-9 - _)");
  if (input.name !== undefined && !input.name.trim()) errors.push("نام ورک‌فلو الزامی است");
  if (!nodes.length) errors.push("ورک‌فلو حداقل به یک گره نیاز دارد");

  const keys = nodes.map((n) => n.key);
  const duplicates = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (duplicates.length) errors.push(`کلید گره تکراری است: ${[...new Set(duplicates)].join(", ")}`);

  for (const node of nodes) {
    if (!node.key) errors.push("هر گره باید کلید داشته باشد");
    if (!WORKFLOW_NODE_TYPES.includes(node.type as WorkflowNodeType)) errors.push(`نوع گره نامعتبر: ${String(node.type)}`);
  }

  const triggers = nodes.filter((n) => n.type === "trigger");
  if (triggers.length > 1) errors.push("فقط یک گره تریگر مجاز است");
  if (!triggers.length && nodes.length) warnings.push("گره تریگر وجود ندارد — ورک‌فلو از اولین گره اجرا می‌شود");
  if (!nodes.some((n) => n.type === "end")) warnings.push("گره پایان وجود ندارد");

  for (const edge of edges) {
    if (!keys.includes(edge.from)) errors.push(`یال از گره ناشناخته: ${edge.from}`);
    if (!keys.includes(edge.to)) errors.push(`یال به گره ناشناخته: ${edge.to}`);
  }

  const orphans = keys.filter((k) => !edges.some((e) => e.to === k) && !triggers.some((t) => t.key === k));
  if (orphans.length) warnings.push(`گره‌های بدون ورودی: ${orphans.join(", ")}`);

  if (input.triggerKind === "event") {
    const eventTypes = input.trigger?.eventTypes ?? [];
    if (!eventTypes.length) errors.push("تریگر رویدادی نیاز به فهرست eventTypes دارد");
  }

  return { ok: !errors.length, errors, warnings };
}

/** Async validation — additionally checks that referenced agents exist. */
export async function validateWorkflow(input: Parameters<typeof validateWorkflowGraph>[0]): Promise<WorkflowValidation> {
  const base = validateWorkflowGraph(input);
  for (const node of input.nodes ?? []) {
    if (node.type === "agent" || (node.type === "recommendation" && node.agentKey)) {
      if (!node.agentKey) {
        base.errors.push(`گره «${node.key}» از نوع agent بدون agentKey است`);
        continue;
      }
      const agent = await getAgent(node.agentKey);
      if (!agent) base.errors.push(`ایجنت «${node.agentKey}» در رجیستری وجود ندارد`);
      else if (agent.status !== "active") base.warnings.push(`ایجنت «${node.agentKey}» در وضعیت ${agent.status} است`);
    }
  }
  base.ok = !base.errors.length;
  return base;
}

export function sanitizeWorkflowInput<T extends Partial<NewWorkflowInput>>(input: T): T {
  const nodes = (input.nodes ?? []).map((node, index) => ({
    ...node,
    key: String(node.key ?? `n${index + 1}`).slice(0, 40),
    type: (WORKFLOW_NODE_TYPES.includes(node.type as WorkflowNodeType) ? node.type : "end") as WorkflowNodeType,
    label: node.label?.slice(0, 160),
    config: node.config ?? {},
    position: node.position ?? { x: 0, y: index * 96 },
  }));
  const keys = new Set(nodes.map((n) => n.key));
  const edges = (input.edges ?? [])
    .filter((edge) => keys.has(edge.from) && keys.has(edge.to))
    .map((edge) => ({ from: edge.from, to: edge.to, label: edge.label ?? null }));
  return {
    ...input,
    key: input.key?.trim().toLowerCase(),
    name: input.name?.trim(),
    nodes,
    edges,
    schedule: sanitizeSchedule(input.schedule),
    triggerKind: (TRIGGER_KINDS.includes(input.triggerKind as TriggerKind) ? input.triggerKind : "manual") as TriggerKind,
  } as T;
}

export async function listWorkflows(): Promise<WorkflowDefinition[]> {
  const store = await ensureSeeded();
  return store.listWorkflows();
}

export async function getWorkflow(keyOrId: string): Promise<WorkflowDefinition | null> {
  const store = await ensureSeeded();
  return store.getWorkflow(keyOrId);
}

export async function createWorkflow(input: NewWorkflowInput, actorId?: string | null): Promise<WorkflowDefinition> {
  const store = await ensureSeeded();
  const clean = sanitizeWorkflowInput(input);
  const validation = await validateWorkflow(clean);
  if (!validation.ok) throw new Error(validation.errors.join(" · "));
  const existing = await store.getWorkflow(clean.key!);
  if (existing) throw new Error(`کلید ورک‌فلو «${clean.key}» قبلاً استفاده شده است`);
  return store.createWorkflow({ ...clean, status: clean.status ?? "draft", createdBy: actorId ?? null } as NewWorkflowInput);
}

export async function updateWorkflow(keyOrId: string, patch: WorkflowPatch): Promise<WorkflowDefinition | null> {
  const store = await ensureSeeded();
  const existing = await store.getWorkflow(keyOrId);
  if (!existing) return null;
  const merged = { ...existing, ...patch } as Parameters<typeof validateWorkflowGraph>[0];
  const clean = sanitizeWorkflowInput(patch as Partial<NewWorkflowInput>);
  const validation = await validateWorkflow({ ...merged, ...(clean as object) });
  if (!validation.ok) throw new Error(validation.errors.join(" · "));
  return store.updateWorkflow(keyOrId, { ...patch, ...clean } as WorkflowPatch);
}

export async function deleteWorkflow(keyOrId: string): Promise<boolean> {
  const store = await ensureSeeded();
  return store.deleteWorkflow(keyOrId);
}

export async function setWorkflowStatus(keyOrId: string, status: WorkflowStatus): Promise<WorkflowDefinition | null> {
  const store = await ensureSeeded();
  return store.updateWorkflow(keyOrId, { status });
}

/** Node types + agent list for the builder UI. */
export async function workflowBuilderMeta() {
  const { listAgents } = await import("../agents/registry");
  const agents = await listAgents();
  return {
    nodeTypes: WORKFLOW_NODE_TYPES.map((type) => ({ type, label: NODE_TYPE_LABELS[type] })),
    triggerKinds: TRIGGER_KINDS,
    statuses: WORKFLOW_STATUSES,
    agents: agents.map((a) => ({ key: a.key, name: a.name, status: a.status })),
  };
}

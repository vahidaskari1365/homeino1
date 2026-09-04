// ============================================================
// HOMEINO — HUMAN APPROVAL SYSTEM
//
// Any tool flagged `requiresApproval` (payments, refunds, order cancellation,
// destructive writes, external HTTP, browser automation, price changes) stops
// the run, creates an approval record and puts the task/run in
// `waiting_approval`. Nothing executes until an admin decides.
//
// When approved, the action is executed here — through the same guarded code
// paths, with an audit log row, and only against real database entities.
// ============================================================
import { eq } from "drizzle-orm";
import { getStore, hasDatabase } from "../agents/store";
import type { ApprovalRecord } from "../agents/store/types";
import type { RiskLevel } from "../agents/permissions";
import { runHttpTask } from "../agents/integrations/httpRuntime";
import { resolveBrowserRuntime } from "../agents/integrations/browserRuntime";

export interface ApprovalRequest {
  agentKey?: string | null;
  action: string;
  reason?: string;
  riskLevel?: RiskLevel;
  payload?: Record<string, unknown>;
  taskId?: string | null;
  runId?: string | null;
  expiresHours?: number;
}

export async function requestApproval(request: ApprovalRequest): Promise<string> {
  const store = await getStore();
  const expiresAt = new Date(Date.now() + (request.expiresHours ?? 72) * 3600_000).toISOString();
  const approvalId = await store.createApproval({
    agentKey: request.agentKey ?? null,
    taskId: request.taskId ?? null,
    runId: request.runId ?? null,
    action: request.action,
    reason: request.reason,
    riskLevel: request.riskLevel ?? "high",
    payload: request.payload ?? {},
    expiresAt,
  });
  if (request.taskId) {
    await store.updateTask(request.taskId, { status: "waiting_approval" });
    await store.addTaskLog(request.taskId, "warn", `درخواست تأیید انسانی ثبت شد: ${request.action}`, { approvalId });
  }
  return approvalId;
}

export async function listApprovals(filter?: { status?: ApprovalRecord["status"]; limit?: number }): Promise<ApprovalRecord[]> {
  const store = await getStore();
  return store.listApprovals(filter);
}

export async function getApproval(id: string): Promise<ApprovalRecord | null> {
  const store = await getStore();
  return store.getApproval(id);
}

export interface DecisionResult {
  ok: boolean;
  approval: ApprovalRecord | null;
  executed?: boolean;
  result?: Record<string, unknown>;
  error?: string;
}

export async function decideApproval(options: {
  approvalId: string;
  decision: "approved" | "rejected";
  decidedBy: string | null;
  note?: string;
}): Promise<DecisionResult> {
  const store = await getStore();
  const approval = await store.decideApproval(options.approvalId, options.decision, options.decidedBy, options.note);
  if (!approval) return { ok: false, approval: null, error: "approval_not_found_or_already_decided" };

  if (approval.taskId) {
    await store.addTaskLog(approval.taskId, options.decision === "approved" ? "info" : "warn", `تصمیم تأیید: ${options.decision}`, {
      decidedBy: options.decidedBy,
      note: options.note ?? null,
    });
  }

  if (options.decision === "rejected") {
    if (approval.taskId) await store.updateTask(approval.taskId, { status: "cancelled", error: "rejected by admin", completedAt: new Date().toISOString() });
    if (approval.runId) await store.updateRun(approval.runId, { status: "cancelled", error: "approval rejected", finishedAt: new Date().toISOString() });
    return { ok: true, approval, executed: false };
  }

  const execution = await executeApprovedAction(approval, options.decidedBy);
  if (approval.taskId) {
    await store.updateTask(approval.taskId, {
      status: execution.ok ? "completed" : "failed",
      result: execution.result ?? null,
      error: execution.ok ? null : execution.error ?? "execution failed",
      completedAt: new Date().toISOString(),
    });
  }
  return { ok: true, approval, executed: execution.ok, result: execution.result, error: execution.error };
}

/** Normalize `tool:updateProductPrice` / `updateProductPrice` → tool key. */
export function approvalToolKey(action: string): string {
  return action.replace(/^tool:/, "").trim();
}

const EXECUTABLE_ACTIONS = new Set([
  "updateProductPrice",
  "cancelOrder",
  "refundPayment",
  "deleteEntity",
  "httpRequest",
  "browserTask",
]);

export async function executeApprovedAction(
  approval: ApprovalRecord,
  actorId: string | null,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const toolKey = approvalToolKey(approval.action);
  const payload = approval.payload ?? {};

  if (!EXECUTABLE_ACTIONS.has(toolKey)) {
    // Informational approvals (e.g. "send campaign") are recorded, not executed.
    return { ok: true, result: { executed: false, reason: "informational_approval", toolKey } };
  }

  switch (toolKey) {
    case "updateProductPrice":
      return updateProductPrice(payload, actorId, approval);
    case "cancelOrder":
      return cancelOrder(payload, actorId, approval);
    case "refundPayment":
      return refundPayment(payload, actorId, approval);
    case "deleteEntity":
      return deleteEntity(payload, actorId, approval);
    case "httpRequest":
      return runApprovedHttp(payload);
    case "browserTask":
      return runApprovedBrowser(payload, approval);
    default:
      return { ok: false, error: `unsupported action: ${toolKey}` };
  }
}

async function updateProductPrice(payload: Record<string, unknown>, actorId: string | null, approval: ApprovalRecord) {
  if (!hasDatabase()) return { ok: false, error: "DATABASE_URL لازم است — تغییر قیمت بدون دیتابیس انجام نمی‌شود" };
  const productId = String(payload.productId ?? "");
  const price = Number(payload.price);
  if (!productId || !Number.isFinite(price) || price <= 0) return { ok: false, error: "productId/price نامعتبر است" };

  const { getDb } = await import("@/db");
  const { products } = await import("@/db/schema");
  const db = getDb();
  const [before] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
  if (!before) return { ok: false, error: "محصول در دیتابیس پیدا نشد" };

  await db.update(products).set({ price: Math.round(price), updatedAt: new Date() }).where(eq(products.id, productId));
  await audit(actorId, "agent.product_price_update", "product", productId, { price: before.price }, { price: Math.round(price) }, approval);
  return { ok: true, result: { executed: true, productId, before: before.price, after: Math.round(price) } };
}

async function cancelOrder(payload: Record<string, unknown>, actorId: string | null, approval: ApprovalRecord) {
  if (!hasDatabase()) return { ok: false, error: "DATABASE_URL لازم است" };
  const orderId = String(payload.orderId ?? "");
  if (!orderId) return { ok: false, error: "orderId نامعتبر است" };
  const { getDb } = await import("@/db");
  const { orders } = await import("@/db/schema");
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, error: "سفارش پیدا نشد" };
  if (order.status === "cancelled") return { ok: true, result: { executed: false, reason: "already_cancelled" } };
  await db.update(orders).set({ status: "cancelled", updatedAt: new Date() }).where(eq(orders.id, orderId));
  await audit(actorId, "agent.order_cancel", "order", orderId, { status: order.status }, { status: "cancelled" }, approval);
  return { ok: true, result: { executed: true, orderId, status: "cancelled" } };
}

async function refundPayment(payload: Record<string, unknown>, actorId: string | null, approval: ApprovalRecord) {
  if (!hasDatabase()) return { ok: false, error: "DATABASE_URL لازم است" };
  const orderId = String(payload.orderId ?? "");
  const amount = Number(payload.amount ?? 0);
  if (!orderId) return { ok: false, error: "orderId نامعتبر است" };
  const { getDb } = await import("@/db");
  const { orders } = await import("@/db/schema");
  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return { ok: false, error: "سفارش پیدا نشد" };
  // The gateway call itself is never automated — we only record the decision.
  await db.update(orders).set({ status: "refunded", updatedAt: new Date() }).where(eq(orders.id, orderId));
  await audit(actorId, "agent.order_refund", "order", orderId, { status: order.status }, { status: "refunded", amount: amount || order.total }, approval);
  return {
    ok: true,
    result: { executed: true, orderId, status: "refunded", amount: amount || order.total, note: "ثبت شد؛ انتقال وجه باید در درگاه پرداخت انجام شود" },
  };
}

const DELETABLE_ENTITIES = new Set(["product", "recommendation"]);

async function deleteEntity(payload: Record<string, unknown>, actorId: string | null, approval: ApprovalRecord) {
  const entity = String(payload.entity ?? "");
  const id = String(payload.id ?? "");
  if (!DELETABLE_ENTITIES.has(entity)) return { ok: false, error: `حذف موجودیت «${entity || "نامشخص"}» مجاز نیست` };
  if (!id) return { ok: false, error: "id نامعتبر است" };

  if (entity === "recommendation") {
    const store = await getStore();
    await store.setRecommendationStatus(id, "expired");
    await audit(actorId, "agent.recommendation_expire", "recommendation", id, null, { status: "expired" }, approval);
    return { ok: true, result: { executed: true, entity, id, status: "expired" } };
  }

  if (!hasDatabase()) return { ok: false, error: "DATABASE_URL لازم است" };
  const { getDb } = await import("@/db");
  const { products } = await import("@/db/schema");
  const db = getDb();
  const [product] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!product) return { ok: false, error: "محصول پیدا نشد" };
  // Soft delete only — real data is never hard-deleted by an agent.
  await db.update(products).set({ deletedAt: new Date(), status: "archived", updatedAt: new Date() }).where(eq(products.id, id));
  await audit(actorId, "agent.product_soft_delete", "product", id, { status: product.status }, { status: "archived", deletedAt: true }, approval);
  return { ok: true, result: { executed: true, entity: "product", id, softDelete: true } };
}

async function runApprovedHttp(payload: Record<string, unknown>) {
  const result = await runHttpTask({
    url: String(payload.url ?? ""),
    method: String(payload.method ?? "GET"),
    body: payload.body as Record<string, unknown> | undefined,
    allowedDomains: Array.isArray(payload.allowedDomains) ? (payload.allowedDomains as string[]) : [],
  });
  return result.ok ? { ok: true, result: { executed: true, ...result } } : { ok: false, error: result.error ?? "http task failed", result: { ...result } };
}

async function runApprovedBrowser(payload: Record<string, unknown>, approval: ApprovalRecord) {
  const runtime = resolveBrowserRuntime(typeof payload.provider === "string" ? payload.provider : undefined);
  const result = await runtime.run({
    url: String(payload.url ?? ""),
    instruction: String(payload.instruction ?? ""),
    action: (payload.action as "goto" | "act" | "extract" | "observe") ?? "extract",
    allowedDomains: Array.isArray(payload.allowedDomains) ? (payload.allowedDomains as string[]) : [],
    maxSteps: Number(payload.maxSteps ?? 8),
    schema: payload.schema as Record<string, string> | undefined,
    agentKey: approval.agentKey ?? "browser",
    runId: approval.runId ?? null,
  });
  return result.ok ? { ok: true, result: { executed: true, ...result } } : { ok: false, error: result.error ?? "browser task failed", result: { ...result } };
}

async function audit(
  actorId: string | null,
  action: string,
  entity: string,
  entityId: string,
  before: unknown,
  after: unknown,
  approval: ApprovalRecord,
) {
  if (!hasDatabase()) return;
  try {
    const { getDb } = await import("@/db");
    const { auditLogs } = await import("@/db/schema");
    await getDb().insert(auditLogs).values({
      actorId: actorId ?? null,
      action,
      entity,
      entityId,
      before: (before ?? null) as Record<string, unknown> | null,
      after: (after ?? null) as Record<string, unknown> | null,
    });
  } catch (error) {
    console.warn("[approvals] audit write failed:", (error as Error).message, { approvalId: approval.id });
  }
}

/** Expire stale approvals so a paused run cannot be resumed months later. */
export async function expireStaleApprovals(): Promise<number> {
  const store = await getStore();
  const pending = await store.listApprovals({ status: "pending", limit: 200 });
  const now = Date.now();
  let expired = 0;
  for (const approval of pending) {
    if (!approval.expiresAt) continue;
    if (new Date(approval.expiresAt).getTime() > now) continue;
    // Expiry is not a human decision — it gets its own status (and its own
    // counter in the admin approval queue).
    await store.expireApproval(approval.id);
    expired += 1;
  }
  return expired;
}

// ============================================================
// HOMEINO — AGENT PERMISSION SYSTEM
//
// Agents never get unrestricted access. Every tool declares the permission it
// needs; every agent stores an explicit permission list; dangerous operations
// additionally require a human approval (agent_approvals).
// ============================================================

export const AGENT_PERMISSIONS = [
  "READ_PRODUCTS",
  "READ_CUSTOMERS",
  "READ_ORDERS",
  "READ_ANALYTICS",
  "READ_INVENTORY",
  "READ_VENDORS",
  "WRITE_RECOMMENDATIONS",
  "WRITE_CUSTOMER_PROFILE",
  "WRITE_CUSTOMER_MEMORY",
  "WRITE_TASKS",
  "SEND_NOTIFICATION",
  "REQUEST_APPROVAL",
  "CALL_LLM",
  "BROWSER_AUTOMATION",
  "EXTERNAL_ACTION",
  "WRITE_PRODUCTS",
  "ORDER_CANCEL",
  "PAYMENT",
  "REFUND",
  "DELETE",
  "DATABASE_DESTRUCTIVE_WRITE",
] as const;

export type AgentPermissionKey = (typeof AGENT_PERMISSIONS)[number];

export const PERMISSION_LABELS: Record<AgentPermissionKey, string> = {
  READ_PRODUCTS: "خواندن محصولات",
  READ_CUSTOMERS: "خواندن مشتریان",
  READ_ORDERS: "خواندن سفارش‌ها",
  READ_ANALYTICS: "خواندن تحلیل رفتاری",
  READ_INVENTORY: "خواندن موجودی",
  READ_VENDORS: "خواندن فروشندگان",
  WRITE_RECOMMENDATIONS: "نوشتن پیشنهادها",
  WRITE_CUSTOMER_PROFILE: "نوشتن پروفایل مشتری",
  WRITE_CUSTOMER_MEMORY: "نوشتن حافظه مشتری",
  WRITE_TASKS: "ساخت وظیفه",
  SEND_NOTIFICATION: "ارسال اعلان",
  REQUEST_APPROVAL: "درخواست تأیید انسانی",
  CALL_LLM: "فراخوانی مدل زبانی",
  BROWSER_AUTOMATION: "اتوماسیون مرورگر",
  EXTERNAL_ACTION: "اقدام بیرونی (HTTP)",
  WRITE_PRODUCTS: "تغییر محصولات",
  ORDER_CANCEL: "لغو سفارش",
  PAYMENT: "پرداخت",
  REFUND: "بازگشت وجه",
  DELETE: "حذف داده",
  DATABASE_DESTRUCTIVE_WRITE: "نوشتن مخرب در دیتابیس",
};

export type RiskLevel = "low" | "medium" | "high" | "critical";

/** Permissions that can never run without a human decision. */
export const APPROVAL_REQUIRED_PERMISSIONS: readonly AgentPermissionKey[] = [
  "DELETE",
  "PAYMENT",
  "REFUND",
  "ORDER_CANCEL",
  "DATABASE_DESTRUCTIVE_WRITE",
  "EXTERNAL_ACTION",
  "BROWSER_AUTOMATION",
  "WRITE_PRODUCTS",
];

export const PERMISSION_RISK: Record<AgentPermissionKey, RiskLevel> = {
  READ_PRODUCTS: "low",
  READ_CUSTOMERS: "medium",
  READ_ORDERS: "medium",
  READ_ANALYTICS: "low",
  READ_INVENTORY: "low",
  READ_VENDORS: "low",
  WRITE_RECOMMENDATIONS: "low",
  WRITE_CUSTOMER_PROFILE: "medium",
  WRITE_CUSTOMER_MEMORY: "medium",
  WRITE_TASKS: "low",
  SEND_NOTIFICATION: "medium",
  REQUEST_APPROVAL: "low",
  CALL_LLM: "medium",
  BROWSER_AUTOMATION: "high",
  EXTERNAL_ACTION: "high",
  WRITE_PRODUCTS: "critical",
  ORDER_CANCEL: "critical",
  PAYMENT: "critical",
  REFUND: "critical",
  DELETE: "critical",
  DATABASE_DESTRUCTIVE_WRITE: "critical",
};

export function isPermission(value: unknown): value is AgentPermissionKey {
  return typeof value === "string" && (AGENT_PERMISSIONS as readonly string[]).includes(value);
}

export function normalizePermissions(input: unknown): AgentPermissionKey[] {
  if (!Array.isArray(input)) return [];
  const out: AgentPermissionKey[] = [];
  for (const item of input) {
    if (isPermission(item) && !out.includes(item)) out.push(item);
  }
  return out;
}

export function hasPermission(
  granted: readonly AgentPermissionKey[],
  required: AgentPermissionKey,
): boolean {
  return granted.includes(required);
}

export function requiresApproval(permission: AgentPermissionKey): boolean {
  return APPROVAL_REQUIRED_PERMISSIONS.includes(permission);
}

export function riskOf(permission: AgentPermissionKey): RiskLevel {
  return PERMISSION_RISK[permission] ?? "medium";
}

/** Highest risk inside a permission set — used for approval routing. */
export function maxRisk(permissions: readonly AgentPermissionKey[]): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high", "critical"];
  let best = 0;
  for (const p of permissions) best = Math.max(best, order.indexOf(riskOf(p)));
  return order[best] ?? "low";
}

/** Sanitize an incoming permission list: unknown keys are dropped, never added. */
export function diffPermissions(
  granted: readonly AgentPermissionKey[],
  requested: readonly AgentPermissionKey[],
): { allowed: AgentPermissionKey[]; denied: AgentPermissionKey[] } {
  const allowed: AgentPermissionKey[] = [];
  const denied: AgentPermissionKey[] = [];
  for (const p of requested) {
    if (!isPermission(p)) continue;
    (granted.includes(p) ? allowed : denied).push(p);
  }
  return { allowed, denied };
}

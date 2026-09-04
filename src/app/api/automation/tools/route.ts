// ============================================================
// /api/automation/tools — Tool Registry + permission catalog (admin)
// ============================================================
import { guard } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { requireAdminUser } from "@/lib/api/auth";
import { listToolRegistry } from "@/services/agents/registry";
import { AGENT_PERMISSIONS, PERMISSION_LABELS, PERMISSION_RISK, APPROVAL_REQUIRED_PERMISSIONS } from "@/services/agents/permissions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = guard(async (req) => {
  await requireAdminUser(req);
  const [tools] = await Promise.all([listToolRegistry()]);
  return ok({
    items: tools,
    permissions: AGENT_PERMISSIONS.map((key) => ({
      key,
      label: PERMISSION_LABELS[key],
      risk: PERMISSION_RISK[key],
      requiresApproval: APPROVAL_REQUIRED_PERMISSIONS.includes(key),
    })),
    count: tools.length,
  });
});

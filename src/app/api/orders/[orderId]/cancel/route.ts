import { cancelOwnOrder } from "@/services/orderService";
import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

/**
 * Owner-initiated order cancellation (pending → cancelled, stock released).
 * Full lifecycle transitions (confirm/ship/deliver) stay vendor/admin-side —
 * a customer can never push their own order forward, only cancel it.
 */
export const POST = guard(async (req, { params }: { params: Promise<{ orderId: string }> }) => {
  const { user } = await requireUser(req);
  const { orderId } = await params;
  const order = await cancelOwnOrder(user.id, orderId);
  return ok(order);
});

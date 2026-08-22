import { getOrderForUser } from "@/services/orderService";
import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async (req, { params }: { params: Promise<{ orderId: string }> }) => {
  const { user } = await requireUser(req);
  const { orderId } = await params;
  return ok(await getOrderForUser(user.id, orderId));
});
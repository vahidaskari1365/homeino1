import { getOrderForUser } from "@/services/orderService";
import { requireUser } from "@/lib/api/auth";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async (req, { params }: { params: Promise<{ orderId: string }> }) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("جزئیات سفارش (API)", "در حالت دمو، سفارش‌ها از حافظهٔ مرورگر خوانده می‌شوند و این API پس از راه‌اندازی دیتابیس فعال می‌شود.");
  const { user } = await requireUser(req);
  const { orderId } = await params;
  return ok(await getOrderForUser(user.id, orderId));
});
import { createOrderFromCart, listOrders, getOrderByNumber, getOrderForUser } from "@/services/orderService";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard, readBody, parsePagination } from "@/lib/api/http";
import { validate, isObject, isOptionalObject, isOptionalString } from "@/lib/api/validate";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("سفارش‌ها (API)", "در حالت دمو، سفارش‌های ثبت‌شده در مرورگر (localStorage) نگهداری می‌شوند و این API پس از راه‌اندازی دیتابیس فعال می‌شود.");
  const { user } = await requireUser(req);
  const { page, limit } = parsePagination(req.nextUrl.searchParams);
  // checkout/success looks real orders up by number: ?orderNumber=HO-...
  const orderNumber = req.nextUrl.searchParams.get("orderNumber");
  if (orderNumber) {
    const order = await getOrderByNumber(orderNumber);
    // Ownership: only the buyer may read the order.
    if (order.userId !== user.id) throw ApiError.notFound("سفارش یافت نشد");
    return ok(await getOrderForUser(user.id, order.id));
  }
  return ok(await listOrders(user.id, page, limit));
});

export const POST = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("ثبت سفارش (API)", "در حالت دمو، سفارش بدون دیتابیس در «سفارش‌های من» (مرورگر) ثبت می‌شود.");
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, {
    shippingAddress: isObject,
    billingAddress: isOptionalObject,
    customerNote: isOptionalString(1000),
    shippingMethod: isOptionalString(10),
  });

  const order = await createOrderFromCart(user.id, {
    shippingAddress: input.shippingAddress as Record<string, unknown>,
    billingAddress: input.billingAddress as Record<string, unknown> | undefined,
    customerNote: input.customerNote,
    shippingMethod: input.shippingMethod,
  });
  return ok(order, { status: 201 });
});
import { createOrderFromCart, listOrders } from "@/services/orderService";
import { requireUser } from "@/lib/api/auth";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard, readBody, parsePagination } from "@/lib/api/http";
import { validate, isObject, isOptionalObject, isOptionalString } from "@/lib/api/validate";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("سفارش‌ها (API)", "در حالت دمو، سفارش‌های ثبت‌شده در مرورگر (localStorage) نگهداری می‌شوند و این API پس از راه‌اندازی دیتابیس فعال می‌شود.");
  const { user } = await requireUser(req);
  const { page, limit } = parsePagination(req.nextUrl.searchParams);
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
  });

  const order = await createOrderFromCart(user.id, {
    shippingAddress: input.shippingAddress as Record<string, unknown>,
    billingAddress: input.billingAddress as Record<string, unknown> | undefined,
    customerNote: input.customerNote,
  });
  return ok(order, { status: 201 });
});
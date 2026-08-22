import { removeCartItem, updateCartItem } from "@/services/cartService";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isInt } from "@/lib/api/validate";

export const runtime = "nodejs";

export const PATCH = guard(async (req, { params }: { params: Promise<{ itemId: string }> }) => {
  const { user } = await requireUser(req);
  const { itemId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(itemId)) throw ApiError.badRequest("شناسه نامعتبر است");
  const body = await readBody(req);
  const input = validate(body, { quantity: isInt(0, 99) });
  return ok(await updateCartItem(user.id, itemId, input.quantity));
});

export const DELETE = guard(async (req, { params }: { params: Promise<{ itemId: string }> }) => {
  const { user } = await requireUser(req);
  const { itemId } = await params;
  return ok(await removeCartItem(user.id, itemId));
});
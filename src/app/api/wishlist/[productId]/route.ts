import { removeFromWishlist } from "@/services/wishlistService";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const DELETE = guard(async (req, { params }: { params: Promise<{ productId: string }> }) => {
  const { user } = await requireUser(req);
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(productId)) throw ApiError.badRequest("شناسه نامعتبر است");
  return ok(await removeFromWishlist(user.id, productId));
});
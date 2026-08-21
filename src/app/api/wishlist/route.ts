import { addToWishlist, listWishlist } from "@/services/wishlistService";
import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isUuid } from "@/lib/api/validate";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  const { user } = await requireUser(req);
  return ok(await listWishlist(user.id));
});

export const POST = guard(async (req) => {
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, { productId: isUuid });
  return ok(await addToWishlist(user.id, input.productId as string));
});
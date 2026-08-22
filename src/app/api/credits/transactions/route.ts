import { getTransactions } from "@/services/creditService";
import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard, parsePagination } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  const { user } = await requireUser(req);
  const { page, limit } = parsePagination(req.nextUrl.searchParams);
  return ok(await getTransactions(user.id, limit, (page - 1) * limit));
});
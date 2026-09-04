import { getBalance} from "@/services/creditService";
import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  const { user } = await requireUser(req);
  return ok(await getBalance(user.id));
});

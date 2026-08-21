import { getCategoryTree } from "@/services/catalogService";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async () => {
  return ok(await getCategoryTree());
});
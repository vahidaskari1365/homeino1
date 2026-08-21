import { getProductBySlug } from "@/services/catalogService";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  const { slug } = await params;
  return ok(await getProductBySlug(slug));
});
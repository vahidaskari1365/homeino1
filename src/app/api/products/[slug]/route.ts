import { getProductBySlug } from "@/services/catalogService";
import { demoUnavailable, ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";

export const runtime = "nodejs";

export const GET = guard(async (_req, { params }: { params: Promise<{ slug: string }> }) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("صفحه محصول (API)", "در حالت دمو، صفحهٔ محصول از دادهٔ نمونهٔ محلی ساخته می‌شود.");
  const { slug } = await params;
  return ok(await getProductBySlug(slug));
});
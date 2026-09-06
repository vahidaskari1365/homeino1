// ============================================================
// POST /api/ai/studio-agents — run the Homeino Studio agent crew
// for a finished design (designer / shopping-assistant / inventory /
// recommendation / customer-intelligence / browser report).
// ============================================================
import { NextRequest } from "next/server";
import { guard, readBody } from "@/lib/api/http";
import { ok } from "@/lib/api/response";
import { optionalUser } from "@/lib/api/auth";
import { getClientIp, rateLimit } from "@/lib/api/rateLimit";
import { runStudioAgents, type StudioAgentProductRef } from "@/services/agents/studio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function sessionIdOf(req: NextRequest, explicit?: unknown): string | null {
  const fromBody = typeof explicit === "string" && explicit.trim() ? explicit.trim().slice(0, 80) : null;
  if (fromBody) return fromBody;
  const cookie = req.headers.get("cookie") ?? "";
  const match = /homeino_session_id=([^;]+)/.exec(cookie);
  return match ? decodeURIComponent(match[1]).slice(0, 80) : null;
}

export const POST = guard(async (req: NextRequest) => {
  const ip = getClientIp(req);
  await rateLimit(`studio-agents:${ip}`, { windowMs: 60_000, max: 20 });

  const body = (await readBody(req, 100_000)) as Record<string, unknown>;
  const { userId } = await optionalUser(req);

  const rawProducts = Array.isArray(body.products) ? body.products : [];
  const products: StudioAgentProductRef[] = rawProducts
    .slice(0, 12)
    .map((p): StudioAgentProductRef | null => {
      const item = (p ?? {}) as Record<string, unknown>;
      const id = typeof item.id === "string" && item.id.trim() ? item.id.trim().slice(0, 80) : null;
      if (!id) return null;
      return {
        id,
        name: typeof item.name === "string" ? item.name.slice(0, 160) : undefined,
        category: typeof item.category === "string" ? item.category.slice(0, 60) : undefined,
        sku: typeof item.sku === "string" ? item.sku.slice(0, 60) : undefined,
        price: typeof item.price === "number" && Number.isFinite(item.price) ? item.price : undefined,
      } satisfies StudioAgentProductRef;
    })
    .filter((p): p is StudioAgentProductRef => p !== null);

  const result = await runStudioAgents({
    products,
    roomType: typeof body.roomType === "string" ? body.roomType.slice(0, 60) : undefined,
    style: typeof body.style === "string" ? body.style.slice(0, 60) : undefined,
    colors: Array.isArray(body.colors) ? body.colors.filter((c): c is string => typeof c === "string").slice(0, 6) : undefined,
    targets: Array.isArray(body.targets) ? body.targets.filter((t): t is string => typeof t === "string").slice(0, 10) : undefined,
    budget: typeof body.budget === "number" && Number.isFinite(body.budget) ? body.budget : undefined,
    userId,
    sessionId: sessionIdOf(req, body.sessionId),
    designId: typeof body.designId === "string" ? body.designId.slice(0, 80) : undefined,
  });

  return ok(result);
});

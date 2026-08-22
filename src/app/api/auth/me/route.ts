import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard } from "@/lib/api/http";
import { ensureProfile } from "@/lib/api/auth";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  const { user } = await requireUser(req);
  const profile = await ensureProfile(user.id);
  return ok({
    id: user.id,
    email: user.email,
    phone: user.phone,
    role: user.role,
    name: profile.name,
    avatar: profile.avatar,
  });
});
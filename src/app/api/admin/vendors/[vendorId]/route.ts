import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isEnum, isOptionalString, isOptionalInt } from "@/lib/api/validate";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vendors, vendorVerificationLogs } from "@/db/schema";
import { requireAdminUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";

export const runtime = "nodejs";

type Params = { params: Promise<{ vendorId: string }> };

/**
 * Admin verification workflow — the real state machine behind /admin/vendors:
 *   approve   → status active
 *   reject    → status rejected
 *   suspend   → status suspended
 *   reactivate→ status active
 *   verify    → verificationStatus verified
 *   unverify  → verificationStatus unverified
 * plus optional per-vendor commission override (basis points).
 * Every action appends to the verification audit log.
 */
export const POST = guard(async (req, { params }: Params) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("تصمیم فروشگاه (API)");
  const { user } = await requireAdminUser(req);
  const { vendorId } = await params;
  const input = validate(await readBody(req), {
    action: isEnum(["approve", "reject", "suspend", "reactivate", "verify", "unverify"]),
    note: isOptionalString(500),
    commissionRateBp: isOptionalInt(0, 10_000),
  });
  const db = getDb();

  const [vendor] = await db.select().from(vendors).where(eq(vendors.id, vendorId)).limit(1);
  if (!vendor) throw ApiError.notFound("فروشگاه یافت نشد");

  const map: Record<string, { status?: "pending" | "active" | "suspended" | "rejected"; verification?: "unverified" | "pending" | "verified"; log: "approved" | "rejected" | "suspended" | "reactivated" | "approved" | "changes_requested" }> = {
    approve: { status: "active", log: "approved" },
    reject: { status: "rejected", log: "rejected" },
    suspend: { status: "suspended", log: "suspended" },
    reactivate: { status: "active", log: "reactivated" },
    verify: { verification: "verified", log: "approved" },
    unverify: { verification: "unverified", log: "changes_requested" },
  };
  const patchPlan = map[input.action];

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (patchPlan.status) update.status = patchPlan.status;
  if (patchPlan.verification) update.verificationStatus = patchPlan.verification;
  if (input.commissionRateBp !== undefined) update.commissionRateBp = input.commissionRateBp;

  const [updated] = await db.update(vendors).set(update).where(eq(vendors.id, vendorId)).returning({
    id: vendors.id, status: vendors.status, verificationStatus: vendors.verificationStatus, commissionRateBp: vendors.commissionRateBp,
  });

  await db.insert(vendorVerificationLogs).values({
    vendorId,
    action: patchPlan.log,
    actorId: user.id,
    note: input.note ?? null,
  });

  return ok(updated);
});

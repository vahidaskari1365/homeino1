import { and, eq, ne } from "drizzle-orm";
import { getDb } from "@/db";
import { vendors, vendorMembers, vendorSettings, vendorPayoutSettings } from "@/db/schema";
import { requireUser } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import type { NextRequest } from "next/server";
import { slugify } from "@/lib/utils";

// ============================================================
// Vendor access guard — the REAL vendor authentication.
//
// Middleware only checks that a session cookie exists (UX gate); the
// security boundary is here: a valid Supabase session + an active
// vendor_members row. Every /api/vendor/* route starts with this.
// ============================================================

export interface VendorContext {
  userId: string;
  vendor: typeof vendors.$inferSelect;
  member: typeof vendorMembers.$inferSelect;
}

export async function requireVendorMember(req: NextRequest): Promise<VendorContext> {
  const { user } = await requireUser(req);
  const db = getDb();

  const rows = await db
    .select({ vendor: vendors, member: vendorMembers })
    .from(vendorMembers)
    .innerJoin(vendors, eq(vendors.id, vendorMembers.vendorId))
    .where(and(eq(vendorMembers.userId, user.id), ne(vendors.status, "rejected")))
    .limit(1);

  const ctx = rows[0];
  if (!ctx) throw ApiError.forbidden("حساب شما به هیچ فروشگاه فروشنده‌ای متصل نیست");
  if (ctx.vendor.status === "suspended") throw ApiError.forbidden("فروشگاه شما به‌صورت موقت تعلیق شده است");
  return { userId: user.id, vendor: ctx.vendor, member: ctx.member };
}

/** Owner/manager-only actions (pricing, store profile, payout requests). */
export function requireVendorManager(ctx: VendorContext): void {
  if (ctx.member.role !== "owner" && ctx.member.role !== "manager") {
    throw ApiError.forbidden("این عملیات فقط برای مدیر فروشگاه مجاز است");
  }
}

/**
 * Onboarding: creates vendors(status=pending) + owner membership + settings
 * rows for an authenticated user. Idempotent per user — a second call with an
 * existing membership returns the existing vendor (unless it was rejected, in
 * which case re-submission resets it to pending).
 */
export async function createVendorForUser(input: {
  userId: string;
  name: string;
  city?: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
}): Promise<{ vendorId: string; status: string; created: boolean }> {
  const db = getDb();

  const existing = await db
    .select({ vendor: vendors })
    .from(vendorMembers)
    .innerJoin(vendors, eq(vendors.id, vendorMembers.vendorId))
    .where(eq(vendorMembers.userId, input.userId))
    .limit(1);
  if (existing[0]) {
    const v = existing[0].vendor;
    if (v.status === "rejected") {
      await db.update(vendors).set({ status: "pending", updatedAt: new Date() }).where(eq(vendors.id, v.id));
      return { vendorId: v.id, status: "pending", created: false };
    }
    return { vendorId: v.id, status: v.status, created: false };
  }

  const baseSlug = slugify(input.name) || "vendor";
  const slug = await uniqueVendorSlug(db, baseSlug);

  return db.transaction(async (tx) => {
    const [vendor] = await tx
      .insert(vendors)
      .values({
        name: input.name,
        slug,
        status: "pending",
        verificationStatus: "pending",
        city: input.city || null,
        description: input.description || null,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
      })
      .returning({ id: vendors.id, status: vendors.status });

    await tx.insert(vendorMembers).values({
      vendorId: vendor.id,
      userId: input.userId,
      role: "owner",
    });
    await tx.insert(vendorSettings).values({ vendorId: vendor.id }).onConflictDoNothing();
    await tx.insert(vendorPayoutSettings).values({ vendorId: vendor.id }).onConflictDoNothing();

    return { vendorId: vendor.id, status: vendor.status, created: true };
  });
}

async function uniqueVendorSlug(db: ReturnType<typeof getDb>, base: string): Promise<string> {
  let candidate = base.slice(0, 140);
  for (let i = 0; i < 20; i++) {
    const [hit] = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.slug, candidate)).limit(1);
    if (!hit) return candidate;
    candidate = `${base.slice(0, 130)}-${i + 2}`;
  }
  return `${base.slice(0, 120)}-${Date.now().toString(36)}`;
}

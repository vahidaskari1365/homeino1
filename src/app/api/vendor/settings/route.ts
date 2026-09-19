import { ok, demoUnavailable } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isOptionalString } from "@/lib/api/validate";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { vendors, vendorSettings, vendorPayoutSettings } from "@/db/schema";
import { requireVendorMember, requireVendorManager } from "@/lib/api/vendorAuth";

export const runtime = "nodejs";

/** Update the vendor's own store profile + payout rails (شبا/کارت). */
export const PATCH = guard(async (req) => {
  if (!process.env.DATABASE_URL) return demoUnavailable("تنظیمات فروشگاه (API)");
  const ctx = await requireVendorMember(req);
  requireVendorManager(ctx);
  const input = validate(await readBody(req), {
    description: isOptionalString(2000),
    city: isOptionalString(80),
    contactEmail: isOptionalString(320),
    contactPhone: isOptionalString(32),
    shippingPolicy: isOptionalString(2000),
    returnPolicy: isOptionalString(2000),
    // payout rails
    accountHolderName: isOptionalString(140),
    cardNumber: isOptionalString(32),
    shaba: isOptionalString(32),
  });
  const db = getDb();

  const vendorPatch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.description !== undefined) vendorPatch.description = input.description;
  if (input.city !== undefined) vendorPatch.city = input.city;
  if (input.contactEmail !== undefined) vendorPatch.contactEmail = input.contactEmail;
  if (input.contactPhone !== undefined) vendorPatch.contactPhone = input.contactPhone;
  if (input.shippingPolicy !== undefined) vendorPatch.shippingPolicy = input.shippingPolicy;
  if (input.returnPolicy !== undefined) vendorPatch.returnPolicy = input.returnPolicy;
  await db.update(vendors).set(vendorPatch).where(eq(vendors.id, ctx.vendor.id));

  if (input.accountHolderName !== undefined || input.cardNumber !== undefined || input.shaba !== undefined) {
    const payoutPatch: Record<string, unknown> = { updatedAt: new Date() };
    if (input.accountHolderName !== undefined) payoutPatch.accountHolderName = input.accountHolderName;
    if (input.cardNumber !== undefined) payoutPatch.cardNumber = input.cardNumber;
    if (input.shaba !== undefined) payoutPatch.shaba = input.shaba;
    await db.insert(vendorPayoutSettings).values({ vendorId: ctx.vendor.id, ...payoutPatch }).onConflictDoUpdate({
      target: vendorPayoutSettings.vendorId,
      set: payoutPatch,
    });
  }

  await db.insert(vendorSettings).values({ vendorId: ctx.vendor.id }).onConflictDoNothing();
  return ok({ saved: true });
});

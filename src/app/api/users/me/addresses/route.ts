import {desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { userAddresses } from "@/db/schema";
import { requireUser } from "@/lib/api/auth";
import { ok } from "@/lib/api/response";
import { guard, readBody } from "@/lib/api/http";
import { validate, isOptionalBoolean, isOptionalString, isString } from "@/lib/api/validate";

export const runtime = "nodejs";

export const GET = guard(async (req) => {
  const { user } = await requireUser(req);
  const rows = await getDb()
    .select()
    .from(userAddresses)
    .where(eq(userAddresses.userId, user.id))
    .orderBy(desc(userAddresses.isDefault));
  return ok(rows);
});

export const POST = guard(async (req) => {
  const { user } = await requireUser(req);
  const body = await readBody(req);
  const input = validate(body, {
    title: isOptionalString(60),
    recipientName: isOptionalString(120),
    phone: isOptionalString(32),
    province: isOptionalString(60),
    city: isOptionalString(60),
    address: isString(500),
    postalCode: isOptionalString(20),
    isDefault: isOptionalBoolean,
  });

  const db = getDb();
  if (input.isDefault) {
    await db.update(userAddresses).set({ isDefault: false }).where(eq(userAddresses.userId, user.id));
  }
  const [addr] = await db
    .insert(userAddresses)
    .values({
      userId: user.id,
      title: input.title ?? null,
      recipientName: input.recipientName ?? null,
      phone: input.phone ?? null,
      province: input.province ?? null,
      city: input.city ?? null,
      address: input.address,
      postalCode: input.postalCode ?? null,
      isDefault: input.isDefault ?? false,
    })
    .returning();
  return ok(addr, { status: 201 });
});
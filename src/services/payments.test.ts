import { describe, expect, it, vi } from "vitest";
import { DevPaymentProvider, resetPaymentGateway, paymentGateway } from "./payments";
import { fulfillPaymentEvent } from "./paymentFulfillment";
import { createHmac } from "node:crypto";

process.env.PAYMENTS_WEBHOOK_SECRET = "test-secret";
process.env.DATABASE_URL = "";

const sign = (raw: string) => createHmac("sha256", "test-secret").update(raw).digest("hex");

describe("DevPaymentProvider.parseWebhook (HMAC over RAW bytes, fail-closed)", () => {
  it("verifies a signature computed over the exact raw body", async () => {
    const gw = new DevPaymentProvider();
    const raw = JSON.stringify({
      providerPaymentId: "dev_1",
      eventType: "payment.succeeded",
      amount: 10,
      metadata: { kind: "credits", userId: "u1", credits: 50 },
    });
    const event = await gw.parseWebhook(raw, sign(raw));
    expect(event.eventType).toBe("payment.succeeded");
    expect(event.metadata).toMatchObject({ kind: "credits" });
  });

  it("rejects a signature computed over a re-serialization (different bytes)", async () => {
    const gw = new DevPaymentProvider();
    const raw = '{"providerPaymentId":"dev_1","eventType":"payment.succeeded"}';
    // same JSON, different byte layout (spaces, key order)
    const tampered = '{ "eventType" : "payment.succeeded", "providerPaymentId" : "dev_1" }';
    await expect(gw.parseWebhook(raw, sign(tampered))).rejects.toThrow("invalid webhook signature");
  });

  it("rejects missing or wrong signatures", async () => {
    const gw = new DevPaymentProvider();
    const raw = '{"providerPaymentId":"dev_1","eventType":"payment.succeeded"}';
    await expect(gw.parseWebhook(raw)).rejects.toThrow("missing webhook signature");
    await expect(gw.parseWebhook(raw, "deadbeef")).rejects.toThrow("invalid webhook signature");
  });

  it("FAILS CLOSED when PAYMENTS_WEBHOOK_SECRET is not configured", async () => {
    const gw = new DevPaymentProvider();
    const prev = process.env.PAYMENTS_WEBHOOK_SECRET;
    delete process.env.PAYMENTS_WEBHOOK_SECRET;
    try {
      const raw = '{"providerPaymentId":"dev_1","eventType":"payment.succeeded"}';
      await expect(gw.parseWebhook(raw, sign(raw))).rejects.toThrow("PAYMENTS_WEBHOOK_SECRET");
    } finally {
      process.env.PAYMENTS_WEBHOOK_SECRET = prev;
    }
  });
});

describe("DevPaymentProvider intent issuance (per-user, single-use)", () => {
  it("consumeIntent proves ownership + metadata, consumes once", async () => {
    const gw = new DevPaymentProvider();
    const { paymentId } = await gw.createIntent({
      amount: 500_000, currency: "IRR", orderId: "credits-x",
      metadata: { kind: "credits", userId: "u1", credits: 120 },
    });
    // wrong user → null
    expect(gw.consumeIntent(paymentId, { userId: "attacker", kind: "credits" })).toBeNull();
    // right user → metadata, and single-use
    const meta = gw.consumeIntent(paymentId, { userId: "u1", kind: "credits" });
    expect(meta).toMatchObject({ credits: 120 });
    expect(gw.consumeIntent(paymentId, { userId: "u1", kind: "credits" })).toBeNull();
  });

  it("dev gateway is refused in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    resetPaymentGateway();
    expect(() => paymentGateway()).toThrow();
    vi.unstubAllEnvs();
    resetPaymentGateway();
  });
});

describe("fulfillPaymentEvent (validation branches — no DB)", () => {
  const base = {
    provider: "dev",
    providerPaymentId: "dev_x",
    amount: 10,
    currency: "IRR",
    raw: {},
  };

  it("refuses payment.failed", async () => {
    const res = await fulfillPaymentEvent({ ...base, eventType: "payment.failed" });
    expect(res).toEqual({ ok: false, reason: "payment_failed" });
  });

  it("refunds and orders need metadata", async () => {
    const res = await fulfillPaymentEvent({ ...base, eventType: "refund.succeeded" });
    expect(res).toEqual({ ok: false, reason: "missing_order" });
    const res2 = await fulfillPaymentEvent({ ...base, eventType: "payment.succeeded" });
    expect(res2).toEqual({ ok: false, reason: "unknown_event_kind" });
  });

  it("rejects credit metadata without a positive integer amount", async () => {
    const res = await fulfillPaymentEvent({
      ...base,
      eventType: "payment.succeeded",
      metadata: { kind: "credits", userId: "u1", credits: 0 },
    });
    expect(res).toEqual({ ok: false, reason: "invalid_credit_metadata" });
  });
});

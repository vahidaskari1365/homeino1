/**
 * Payment provider abstraction. The frontend and order/credit services never
 * name a concrete gateway — they talk to `paymentGateway` (a PaymentProvider).
 * Stripe keys are server-side only (STRIPE_SECRET_KEY), never NEXT_PUBLIC_.
 */

export interface PaymentIntentInput {
  amount: number; // in base currency unit (Toman)
  currency: string;
  orderId: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

export type PaymentStatus = "succeeded" | "pending" | "failed";

export interface PaymentResult {
  provider: string;
  paymentId: string;
  status: PaymentStatus;
  clientSecret?: string; // for client-side confirmation (e.g. Stripe)
  paymentUrl?: string; // for redirect gateways
}

export interface PaymentWebhookEvent {
  provider: string;
  providerPaymentId: string;
  eventType: "payment.succeeded" | "payment.failed" | "refund.succeeded";
  amount: number;
  currency: string;
  metadata?: Record<string, unknown>;
  raw: unknown;
}

export interface PaymentProvider {
  readonly name: string;
  createIntent(input: PaymentIntentInput): Promise<PaymentResult>;
  /** Verify over the RAW request body (exact bytes the sender signed). */
  parseWebhook(rawBody: string, signature?: string): Promise<PaymentWebhookEvent>;
}

export class StripeProvider implements PaymentProvider {
  readonly name = "stripe";
  private secretKey: string;

  constructor() {
    this.secretKey = process.env.STRIPE_SECRET_KEY ?? "";
    if (!this.secretKey) {
      throw new Error("STRIPE_SECRET_KEY is required for Stripe provider");
    }
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentResult> {
    const res = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.secretKey}`,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        amount: String(input.amount),
        currency: input.currency.toLowerCase(),
        "metadata[order_id]": input.orderId,
        description: input.description ?? "",
      }).toString(),
    });
    const body = (await res.json()) as {
      id?: string;
      client_secret?: string;
      status?: string;
      error?: { message?: string };
    };
    if (!res.ok || !body.id) {
      throw new Error(`Stripe createIntent failed: ${body.error?.message ?? res.status}`);
    }
    const status: PaymentStatus = body.status === "succeeded" ? "succeeded" : "pending";
    return {
      provider: this.name,
      paymentId: body.id,
      status,
      clientSecret: body.client_secret,
    };
  }

  /** Real Stripe signature verification (no SDK needed):
   *  `Stripe-Signature: t=<ts>,v1=<hmac_sha256(ts + "." + rawBody)>` with a
   *  5-minute replay window. Requires STRIPE_WEBHOOK_SECRET — fail-closed. */
  async parseWebhook(rawBody: string, signature?: string): Promise<PaymentWebhookEvent> {
    const whSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!whSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
    if (!signature) throw new Error("missing webhook signature");
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const parts = signature.split(",").reduce<Record<string, string>>((acc, part) => {
      const [k, v] = part.split("=");
      if (k && v) acc[k.trim()] = v.trim();
      return acc;
    }, {});
    const ts = parts["t"];
    const v1 = parts["v1"];
    if (!ts || !v1) throw new Error("invalid Stripe-Signature header");
    if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) {
      throw new Error("webhook timestamp outside replay window");
    }
    const expected = createHmac("sha256", whSecret).update(`${ts}.${rawBody}`).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(v1);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("invalid webhook signature");
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error("invalid webhook payload");
    }
    const evt = body as {
      type?: string;
      data?: { object?: { id?: string; amount?: number; currency?: string; metadata?: Record<string, unknown>; refund?: { payment_intent?: string } } };
    };
    const obj = evt.data?.object ?? {};
    const map: Record<string, PaymentWebhookEvent["eventType"]> = {
      "payment_intent.succeeded": "payment.succeeded",
      "payment_intent.payment_failed": "payment.failed",
      "charge.refunded": "refund.succeeded",
    };
    const eventType = map[evt.type ?? ""];
    if (!eventType) throw new Error(`unhandled stripe event: ${evt.type}`);
    return {
      provider: this.name,
      providerPaymentId: obj.id ?? "unknown",
      eventType,
      amount: obj.amount ?? 0,
      currency: (obj.currency ?? "irr").toUpperCase(),
      metadata: obj.metadata,
      raw: body,
    };
  }
}

/** Development provider — no real money moves. Clearly labelled, never in prod.
 *  Intents are tracked so the confirm route can prove a paymentId was really
 *  issued by the server (clients can never mint credits with fake ids). */
export class DevPaymentProvider implements PaymentProvider {
  readonly name = "dev";
  /** paymentId → { userId, credits, orderId, metadata, issuedAt } (TTL pruned) */
  private static intents = new Map<
    string,
    { metadata: Record<string, unknown>; issuedAt: number }
  >();
  private static TTL_MS = 30 * 60 * 1000;

  createIntent(input: PaymentIntentInput): Promise<PaymentResult> {
    const paymentId = `dev_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
    // prune stale intents (cheap, on every intent)
    for (const [k, v] of DevPaymentProvider.intents) {
      if (Date.now() - v.issuedAt > DevPaymentProvider.TTL_MS) DevPaymentProvider.intents.delete(k);
    }
    DevPaymentProvider.intents.set(paymentId, {
      metadata: input.metadata ?? {},
      issuedAt: Date.now(),
    });
    return Promise.resolve({
      provider: this.name,
      paymentId,
      status: "succeeded",
    });
  }

  /** Proves a paymentId exists AND carries the expected metadata (per user).
   *  Returns the stored metadata on success (single-use) — callers fulfill
   *  from SERVER-ISSUED values, never client echoes. */
  consumeIntent(
    paymentId: string,
    expectedMetadata: Record<string, unknown>,
  ): Record<string, unknown> | null {
    const entry = DevPaymentProvider.intents.get(paymentId);
    if (!entry) return null;
    for (const [k, v] of Object.entries(expectedMetadata)) {
      if (entry.metadata[k] !== v) return null;
    }
    DevPaymentProvider.intents.delete(paymentId); // single-use
    return entry.metadata;
  }

  /** Proves a paymentId exists AND carries the expected metadata (per user). */
  wasIssued(paymentId: string, expectedMetadata: Record<string, unknown>): boolean {
    const entry = DevPaymentProvider.intents.get(paymentId);
    if (!entry) return false;
    for (const [k, v] of Object.entries(expectedMetadata)) {
      if (entry.metadata[k] !== v) return false;
    }
    return true;
  }

  /** Dev webhooks are HMAC-signed with PAYMENTS_WEBHOOK_SECRET (raw body bytes).
   *  FAIL-CLOSED: without an explicitly configured secret nothing verifies —
   *  a publicly-known default would let anyone mint credits. */
  async parseWebhook(rawBody: string, signature?: string): Promise<PaymentWebhookEvent> {
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET;
    if (!secret) throw new Error("PAYMENTS_WEBHOOK_SECRET is not configured");
    if (!signature) throw new Error("missing webhook signature");
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    // Verify over the EXACT raw bytes the sender signed — never a
    // re-serialization (whitespace/key order would falsify the signature).
    const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("invalid webhook signature");
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      throw new Error("invalid dev webhook payload");
    }
    const payload = body as {
      providerPaymentId?: string;
      eventType?: PaymentWebhookEvent["eventType"];
      amount?: number;
      currency?: string;
      metadata?: Record<string, unknown>;
    };
    if (!payload.providerPaymentId || !payload.eventType) {
      throw new Error("invalid dev webhook payload");
    }
    return {
      provider: this.name,
      providerPaymentId: payload.providerPaymentId,
      eventType: payload.eventType,
      amount: payload.amount ?? 0,
      currency: payload.currency ?? "IRR",
      metadata: payload.metadata,
      raw: body,
    };
  }
}

let gateway: PaymentProvider | null = null;

export function paymentGateway(): PaymentProvider {
  if (gateway) return gateway;
  if (process.env.STRIPE_SECRET_KEY) {
    gateway = new StripeProvider();
    return gateway;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "STRIPE_SECRET_KEY is required in production. Refusing to use DevPaymentProvider (fake succeeded payments).",
    );
  }
  gateway = new DevPaymentProvider();
  return gateway;
}

/** Test hook for isolated unit tests. */
export function resetPaymentGateway(): void {
  gateway = null;
}

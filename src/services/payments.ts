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
  parseWebhook(body: unknown, signature?: string): Promise<PaymentWebhookEvent>;
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

  async parseWebhook(_body: unknown, _signature?: string): Promise<PaymentWebhookEvent> {
    // In production verify the Stripe-Signature header with the webhook secret.
    throw new Error("Stripe webhook signing not configured");
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

  /** Proves a paymentId exists AND carries the expected metadata (per user). */
  wasIssued(paymentId: string, expectedMetadata: Record<string, unknown>): boolean {
    const entry = DevPaymentProvider.intents.get(paymentId);
    if (!entry) return false;
    DevPaymentProvider.intents.delete(paymentId); // single-use
    for (const [k, v] of Object.entries(expectedMetadata)) {
      if (entry.metadata[k] !== v) return false;
    }
    return true;
  }

  /** Dev webhooks are HMAC-signed with PAYMENTS_WEBHOOK_SECRET. */
  async parseWebhook(body: unknown, signature?: string): Promise<PaymentWebhookEvent> {
    const secret = process.env.PAYMENTS_WEBHOOK_SECRET ?? "homeino-dev-webhook-secret";
    if (!signature) throw new Error("missing webhook signature");
    const { createHmac, timingSafeEqual } = await import("node:crypto");
    const expected = createHmac("sha256", secret).update(JSON.stringify(body)).digest("hex");
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new Error("invalid webhook signature");
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

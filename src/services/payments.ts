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

/** Development provider — no real money moves. Clearly labelled, never in prod. */
export class DevPaymentProvider implements PaymentProvider {
  readonly name = "dev";
  createIntent(input: PaymentIntentInput): Promise<PaymentResult> {
    const paymentId = `dev_${Math.random().toString(36).slice(2, 10)}`;
    return Promise.resolve({
      provider: this.name,
      paymentId,
      status: "succeeded",
    });
  }
  async parseWebhook(): Promise<PaymentWebhookEvent> {
    throw new Error("dev provider has no webhooks");
  }
}

let gateway: PaymentProvider | null = null;

export function paymentGateway(): PaymentProvider {
  if (gateway) return gateway;
  gateway = process.env.STRIPE_SECRET_KEY ? new StripeProvider() : new DevPaymentProvider();
  return gateway;
}

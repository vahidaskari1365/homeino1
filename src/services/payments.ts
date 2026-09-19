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

/**
 * Zarinpal (درگاه ایرانی) — v4 REST, no SDK.
 *
 * Money boundary: callers pass IRR (×10 Toman) like Stripe; Zarinpal v4 bills
 * in TOMAN, so the provider divides by 10 internally. Verification happens on
 * the redirect callback (GET ?Authority=…&Status=OK) — the callback carries an
 * HMAC-signed metadata blob (stateless → works on serverless, nothing can be
 * forged without PAYMENTS_WEBHOOK_SECRET), and the actual verify.json call
 * re-checks amount+authority against Zarinpal itself. Verification IS the auth.
 */
export class ZarinpalProvider implements PaymentProvider {
  readonly name = "zarinpal";
  private merchantId: string;
  private signingSecret: string;
  private sandbox: boolean;

  constructor() {
    this.merchantId = process.env.ZARINPAL_MERCHANT_ID ?? "";
    this.signingSecret = process.env.PAYMENTS_WEBHOOK_SECRET ?? "";
    this.sandbox = process.env.ZARINPAL_SANDBOX === "1";
    if (!this.merchantId) {
      throw new Error("ZARINPAL_MERCHANT_ID is required for Zarinpal provider");
    }
    if (!this.signingSecret) {
      throw new Error("PAYMENTS_WEBHOOK_SECRET is required for Zarinpal callback signing");
    }
  }

  private base(): string {
    return this.sandbox ? "https://sandbox.zarinpal.com" : "https://payment.zarinpal.com";
  }

  private static origin(): string {
    return (
      process.env.NEXT_PUBLIC_SITE_URL ??
      process.env.APP_ORIGIN ??
      "https://homeino.vercel.app"
    ).replace(/\/+$/, "");
  }

  private async sign(payload: string): Promise<string> {
    const { createHmac } = await import("node:crypto");
    return createHmac("sha256", this.signingSecret).update(payload).digest("base64url");
  }

  async createIntent(input: PaymentIntentInput): Promise<PaymentResult> {
    const amountToman = Math.round(input.amount / 10);
    if (amountToman < 1000) throw new Error("Zarinpal minimum amount is 1000 Toman");

    const meta = { ...input.metadata, amountToman };
    const encoded = Buffer.from(JSON.stringify(meta), "utf8").toString("base64url");
    const sig = await this.sign(encoded);
    const callbackUrl = `${ZarinpalProvider.origin()}/api/payments/zarinpal/callback?d=${encoded}&s=${sig}`;

    const res = await fetch(`${this.base()}/pg/v4/payment/request.json`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        merchant_id: this.merchantId,
        amount: amountToman,
        description: input.description ?? "پرداخت هومینو",
        callback_url: callbackUrl,
        metadata: input.orderId ? { order_id: input.orderId } : undefined,
      }),
    });
    const body = (await res.json()) as {
      data?: { code?: number; authority?: string; message?: string };
      errors?: unknown;
    };
    const authority = body.data?.authority;
    if (!res.ok || body.data?.code !== 100 || !authority) {
      throw new Error(`Zarinpal request failed: ${body.data?.message ?? res.status}`);
    }
    return {
      provider: this.name,
      paymentId: authority,
      status: "pending",
      paymentUrl: `${this.base()}/pg/StartPay/${authority}`,
    };
  }

  /** Server-side verify — the single source of truth for «this payment really happened». */
  async verify(authority: string, amountToman: number): Promise<{ ok: boolean; alreadyVerified: boolean; refId?: number }> {
    const res = await fetch(`${this.base()}/pg/v4/payment/verify.json`, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ merchant_id: this.merchantId, amount: amountToman, authority }),
    });
    const body = (await res.json()) as { data?: { code?: number; ref_id?: number } };
    const code = body.data?.code;
    if (code === 100) return { ok: true, alreadyVerified: false, refId: body.data?.ref_id };
    if (code === 101) return { ok: true, alreadyVerified: true, refId: body.data?.ref_id };
    return { ok: false, alreadyVerified: false };
  }

  /**
   * POST-compat path (server-to-server integrations). The body must carry the
   * SAME signed blob the redirect uses; Zarinpal itself has no signed webhook,
   * so the HMAC + a successful verify.json are what make this fail-closed.
   */
  async parseWebhook(rawBody: string, signature?: string): Promise<PaymentWebhookEvent> {
    let payload: { d?: string; s?: string; authority?: string };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw new Error("invalid webhook payload");
    }
    if (!payload.d || !payload.s || !payload.authority || signature !== payload.s) {
      throw new Error("missing webhook signature");
    }
    if ((await this.sign(payload.d)) !== payload.s) throw new Error("invalid webhook signature");
    const meta = JSON.parse(Buffer.from(payload.d, "base64url").toString("utf8")) as Record<string, unknown> & { amountToman?: number };
    if (!meta.amountToman) throw new Error("invalid webhook payload");
    const verified = await this.verify(payload.authority, meta.amountToman);
    if (!verified.ok) throw new Error("zarinpal verification failed");
    return {
      provider: this.name,
      providerPaymentId: payload.authority,
      eventType: "payment.succeeded",
      amount: meta.amountToman * 10,
      currency: "IRR",
      metadata: meta,
      raw: payload,
    };
  }

  /** Decodes + authenticates the callback blob (no Zarinpal roundtrip here —
   *  the callback route calls verify() itself with the DB-stored amount). */
  async decodeCallback(d: string, s: string): Promise<Record<string, unknown> | null> {
    if ((await this.sign(d)) !== s) return null;
    try {
      return JSON.parse(Buffer.from(d, "base64url").toString("utf8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

let gateway: PaymentProvider | null = null;

export function paymentGateway(): PaymentProvider {
  if (gateway) return gateway;
  // Iranian rail first (WORKING-CONTEXT decision: Zarinpal is the primary
  // local gateway), then Stripe (international), then dev-only fallback.
  if (process.env.ZARINPAL_MERCHANT_ID) {
    gateway = new ZarinpalProvider();
    return gateway;
  }
  if (process.env.STRIPE_SECRET_KEY) {
    gateway = new StripeProvider();
    return gateway;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "ZARINPAL_MERCHANT_ID or STRIPE_SECRET_KEY is required in production. Refusing to use DevPaymentProvider (fake succeeded payments).",
    );
  }
  gateway = new DevPaymentProvider();
  return gateway;
}

/** Test hook for isolated unit tests. */
export function resetPaymentGateway(): void {
  gateway = null;
}

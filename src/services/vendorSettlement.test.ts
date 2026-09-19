import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  commissionBpFor,
  commissionFor,
  DEFAULT_COMMISSION_BP,
  tehranMonthStartUtc,
} from "./vendorSettlement";
import { ZarinpalProvider, paymentGateway, resetPaymentGateway } from "./payments";
import { createHmac } from "node:crypto";

process.env.PAYMENTS_WEBHOOK_SECRET = "test-secret";

describe("tehranMonthStartUtc — ماه جاری به وقت تهران (Task 59)", () => {
  it("اولین لحظهٔ ماه میلادی جاریِ تهران را برمی‌گرداند (آفست ثابت +۳:۳۰)", () => {
    // ۱۵ سپتامبر ۲۰۲۶ ساعت ۰۸:۰۰ UTC = ۱۱:۳۰ تهران → ماه: سپتامبر
    const now = new Date("2026-09-15T08:00:00Z");
    const start = tehranMonthStartUtc(now);
    expect(start.toISOString()).toBe("2026-08-31T20:30:00.000Z");
  });

  it("نیمه‌شب مرزی: ۰۱:۰۰ تهرانِ روز اول ماه → خودِ ماه", () => {
    // ۱ اکتبر ۰۰:۳۰ UTC = ۰۴:۰۰ تهرانِ ۱ اکتبر
    const now = new Date("2026-10-01T00:30:00Z");
    const start = tehranMonthStartUtc(now);
    expect(start.toISOString()).toBe("2026-09-30T20:30:00.000Z");
  });

  it("روز ۳۱ مرزی: ۲۰:۰۰ UTCِ ۳۱ اوت = ۲۳:۳۰ تهرانِ ۳۱ اوت → ماه اوت", () => {
    const now = new Date("2026-08-31T20:00:00Z");
    const start = tehranMonthStartUtc(now);
    expect(start.toISOString()).toBe("2026-07-31T20:30:00.000Z");
  });
});

describe("vendorSettlement commission math (pure)", () => {
  it("uses the platform default when the vendor has no override", () => {
    expect(commissionBpFor(null)).toBe(DEFAULT_COMMISSION_BP);
    expect(commissionBpFor(undefined)).toBe(DEFAULT_COMMISSION_BP);
  });

  it("clamps out-of-range overrides to the platform default", () => {
    expect(commissionBpFor(-1)).toBe(DEFAULT_COMMISSION_BP);
    expect(commissionBpFor(10_001)).toBe(DEFAULT_COMMISSION_BP);
  });

  it("honors a valid per-vendor override (300bp = 3%)", () => {
    expect(commissionBpFor(300)).toBe(300);
  });

  it("computes commission and net consistently (net = gross - commission)", () => {
    const { commissionToman, netToman } = commissionFor(10_000_000, 800);
    expect(commissionToman).toBe(800_000);
    expect(netToman).toBe(9_200_000);
  });

  it("rounds commission half-up and never goes negative", () => {
    // 3.5 Toman commission on 44 Toman @ 8% → rounds to 4
    expect(commissionFor(44, 800).commissionToman).toBe(4);
    expect(commissionFor(0, 800).commissionToman).toBe(0);
    expect(commissionFor(1_000, 0).netToman).toBe(1_000);
  });
});

describe("ZarinpalProvider (callback HMAC fail-closed)", () => {
  beforeEach(() => {
    process.env.ZARINPAL_MERCHANT_ID = "test-merchant";
    process.env.ZARINPAL_SANDBOX = "1";
    process.env.PAYMENTS_WEBHOOK_SECRET = "test-secret";
    resetPaymentGateway();
  });
  afterEach(() => {
    delete process.env.ZARINPAL_MERCHANT_ID;
    delete process.env.ZARINPAL_SANDBOX;
    resetPaymentGateway();
  });

  it("gateway prefers zarinpal when configured, then stripe, then dev in tests", () => {
    expect(paymentGateway().name).toBe("zarinpal");
    delete process.env.ZARINPAL_MERCHANT_ID;
    resetPaymentGateway();
    // no stripe key in tests → dev provider
    expect(paymentGateway().name).toBe("dev");
  });

  it("decodeCallback accepts its own signed blob", async () => {
    const p = new ZarinpalProvider();
    const meta = { kind: "order", orderId: "o1", amountToman: 1_500_000 };
    const encoded = Buffer.from(JSON.stringify(meta), "utf8").toString("base64url");
    const sig = await createHmac("sha256", "test-secret").update(encoded).digest("base64url");
    expect(await p.decodeCallback(encoded, sig)).toMatchObject({ kind: "order" });
  });

  it("decodeCallback REJECTS a tampered blob or forged signature", async () => {
    const p = new ZarinpalProvider();
    const meta = { kind: "order", amountToman: 1_500_000 };
    const encoded = Buffer.from(JSON.stringify(meta), "utf8").toString("base64url");
    const sig = await createHmac("sha256", "test-secret").update(encoded).digest("base64url");

    // tampered payload, original signature
    const tampered = Buffer.from(JSON.stringify({ ...meta, amountToman: 1 }), "utf8").toString("base64url");
    expect(await p.decodeCallback(tampered, sig)).toBeNull();
    // forged signature
    expect(await p.decodeCallback(encoded, "forged-signature")).toBeNull();
  });

  it("createIntent converts IRR to Toman and signs the callback (mocked fetch)", async () => {
    const p = new ZarinpalProvider();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { code: 100, authority: "A0001" } }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await p.createIntent({
      amount: 15_000_000, // IRR (= 1,500,000 Toman)
      currency: "IRR",
      orderId: "order-1",
      description: "test",
      metadata: { kind: "order", orderId: "order-1" },
    });

    expect(result.provider).toBe("zarinpal");
    expect(result.status).toBe("pending");
    expect(result.paymentUrl).toContain("/pg/StartPay/A0001");

    const body = JSON.parse(fetchMock.mock.calls[0][1].body) as { amount: number; callback_url: string };
    expect(body.amount).toBe(1_500_000); // IRR → Toman boundary
    const url = new URL(body.callback_url);
    const d = url.searchParams.get("d")!;
    const s = url.searchParams.get("s")!;
    expect(await p.decodeCallback(d, s)).toMatchObject({ kind: "order", amountToman: 1_500_000 });
    vi.unstubAllGlobals();
  });

  it("createIntent refuses a request below the gateway minimum", async () => {
    const p = new ZarinpalProvider();
    await expect(
      p.createIntent({ amount: 9_000, currency: "IRR", orderId: "o" }), // 900 Toman < 1000
    ).rejects.toThrow("minimum amount");
  });
});

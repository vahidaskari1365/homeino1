// ============================================================
// Task 59 — آداپتور SMS: نرمال‌سازی شماره، پروایدر کاوه‌نگار (fetch موک)،
// گیت env (fail-closed: بدون کلید هیچ ارسالی وجود ندارد).
// ============================================================
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  KavenegarProvider,
  normalizeIranMobile,
  getSmsProvider,
} from "./sms";

describe("normalizeIranMobile — همهٔ قالب‌های رایج", () => {
  it("قالب‌های بین‌المللی و داخلی → ۰۹xxxxxxxxx", () => {
    expect(normalizeIranMobile("09123456789")).toBe("09123456789");
    expect(normalizeIranMobile("+989123456789")).toBe("09123456789");
    expect(normalizeIranMobile("00989123456789")).toBe("09123456789");
    expect(normalizeIranMobile("989123456789")).toBe("09123456789");
    expect(normalizeIranMobile("9123456789")).toBe("09123456789");
  });

  it("ارقام فارسی/عربی + فاصله و خط تیره", () => {
    expect(normalizeIranMobile("۰۹۱۲ ۳۴۵-۶۷۸۹")).toBe("09123456789");
    expect(normalizeIranMobile("٠٩١٢٣٤٥٦٧٨٩")).toBe("09123456789");
  });

  it("غیرموبایل/ناقص → null (fail-closed)", () => {
    expect(normalizeIranMobile("02112345678")).toBeNull(); // ثابت
    expect(normalizeIranMobile("0912345")).toBeNull(); // ناقص
    expect(normalizeIranMobile("")).toBeNull();
    expect(normalizeIranMobile(null)).toBeNull();
    expect(normalizeIranMobile(undefined)).toBeNull();
  });
});

function kavenegarResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

describe("KavenegarProvider — REST بدون SDK", () => {
  it("پاسخ ۲۰۰ + return.status=200 → ok با messageid", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      kavenegarResponse(200, { return: { status: 200, message: "تأیید", entries: [{ messageid: 12345 }] } }),
    );
    const provider = new KavenegarProvider("test-key", undefined, fetchMock as unknown as typeof fetch);
    const result = await provider.send("09123456789", "هومینو: فروش جدید!");
    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("12345");
    // receptor نرمال‌شده در URL آمده باشد
    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toContain("receptor=09123456789");
    expect(url).toContain(encodeURIComponent("test-key"));
  });

  it("خطای پروایدر → ok=false با پیام (هیچ throwی)", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      kavenegarResponse(200, { return: { status: 418, message: "insufficient credit" } }),
    );
    const provider = new KavenegarProvider("test-key", undefined, fetchMock as unknown as typeof fetch);
    const result = await provider.send("09123456789", "متن");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("418");
  });

  it("شبکهٔ مرده → ok=false (fail-closed)", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    const provider = new KavenegarProvider("test-key", undefined, fetchMock as unknown as typeof fetch);
    const result = await provider.send("09123456789", "متن");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("ECONNREFUSED");
  });

  it("شمارهٔ نامعتبر قبل از fetch رد می‌شود", async () => {
    const fetchMock = vi.fn();
    const provider = new KavenegarProvider("test-key", undefined, fetchMock as unknown as typeof fetch);
    const result = await provider.send("021-12345678", "متن");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("invalid_receptor");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("getSmsProvider — گیت env", () => {
  const ENV_KEYS = ["SMS_PROVIDER", "KAVENEGAR_API_KEY", "KAVENEGAR_SENDER"] as const;

  afterEach(() => {
    for (const k of ENV_KEYS) delete process.env[k];
  });

  it("بدون کلید → null (اعلان فقط درون‌سایتی — هیچ ارسال فیک)", () => {
    expect(getSmsProvider()).toBeNull();
  });

  it("با کلید کاوه‌نگار → پروایدر فعال (مسیر صفر-کدِ مالک)", () => {
    process.env.KAVENEGAR_API_KEY = "real-key";
    const provider = getSmsProvider();
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe("kavenegar");
  });

  it("پروایدر ناشناخته → null (fail-closed)", () => {
    process.env.SMS_PROVIDER = "twilio";
    process.env.KAVENEGAR_API_KEY = "key";
    expect(getSmsProvider()).toBeNull();
  });
});

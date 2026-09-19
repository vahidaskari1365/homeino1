import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * تست هندلر POST /api/vendor/uploads — قرارداد کامل روت با گیت‌های واقعی:
 *   • استانداردسازی «واقعی» (sharp) اجرا می‌شود — فقط ذخیره‌سازی موک است
 *   • 401 بدون نشست، 403 بدون نقش مدیر، 400 با ورودی غلط، 201 موفق
 * گیت دیتابیس (DATABASE_URL) هم مثل پروداکشن فعّال می‌شود.
 */

process.env.DATABASE_URL = "postgres://test:test@localhost:5432/test";

const authState = vi.hoisted(() => ({ authorized: true, role: "owner" }));

vi.mock("@/lib/api/vendorAuth", async () => {
  const { ApiError } = await import("@/lib/api/errors");
  return {
    requireVendorMember: vi.fn(async () => {
      if (!authState.authorized) throw ApiError.unauthorized("برای این کار ابتدا وارد حساب شوید");
      return { userId: "user-1", vendor: { id: "vendor-1" }, member: { role: authState.role, permissions: [] } };
    }),
    requireVendorManager: vi.fn((ctx: { member: { role: string } }) => {
      if (ctx.member.role !== "owner" && ctx.member.role !== "manager") throw ApiError.forbidden();
    }),
  };
});

vi.mock("@/db", () => ({
  // rate-limit با شکست DB به لایهٔ حافظه می‌رود — بدون هیچ اتصال واقعی
  getDb: () => {
    throw new Error("no db in test");
  },
}));

const persistMock = vi.hoisted(() => vi.fn());
vi.mock("@/services/media/productImageAgent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/media/productImageAgent")>();
  return { ...actual, persistProductImage: persistMock };
});
persistMock.mockResolvedValue({ url: "https://cdn.example.com/product-images/fake.webp", storage: "r2", key: "k" });

import { POST } from "./route";
import { ApiError } from "@/lib/api/errors";
import sharp from "sharp";

type HandlerReq = Parameters<typeof POST>[0];

function makeRequest(form: FormData | null): HandlerReq {
  if (!form) {
    return new Request("http://localhost/api/vendor/uploads", { method: "POST" }) as unknown as HandlerReq;
  }
  return new Request("http://localhost/api/vendor/uploads", { method: "POST", body: form }) as unknown as HandlerReq;
}

async function jpegFile(width = 1600, height = 1000, name = "photo.jpg"): Promise<File> {
  const buf = await sharp({ create: { width, height, channels: 3, background: { r: 90, g: 140, b: 220 } } })
    .jpeg({ quality: 90 })
    .toBuffer();
  return new File([buf], name, { type: "image/jpeg" });
}

beforeEach(() => {
  authState.authorized = true;
  authState.role = "owner";
  persistMock.mockClear();
  persistMock.mockResolvedValue({ url: "https://cdn.example.com/product-images/fake.webp", storage: "r2", key: "k" });
});

describe("POST /api/vendor/uploads", () => {
  it("آپلود موفق: استانداردسازی واقعی + ذخیره‌سازی + گزارش کامل (201)", async () => {
    const form = new FormData();
    form.append("file", await jpegFile());
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(201);

    const body = (await res.json()) as { ok: boolean; data: Record<string, unknown> };
    expect(body.ok).toBe(true);
    expect(body.data.url).toContain("https://");
    expect(body.data.storage).toBe("r2");
    expect(body.data.width).toBe(1200);
    expect(body.data.height).toBe(1200);

    const report = body.data.report as {
      output: { format: string };
      actions: string[];
    };
    expect(report.output.format).toBe("webp");
    expect(report.actions).toContain("square-pad");

    // بافر رسیده به لایهٔ ذخیره‌سازی باید WebP واقعی باشد (RIFF/WEBP)
    expect(persistMock).toHaveBeenCalledTimes(1);
    const persistedBytes = persistMock.mock.calls[0][0] as Buffer;
    expect(Buffer.isBuffer(persistedBytes)).toBe(true);
    expect(persistedBytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
    const opts = persistMock.mock.calls[0][1] as { vendorId: string };
    expect(opts.vendorId).toBe("vendor-1");
  });

  it("بدون نشست معتبر: 401 صادقانه", async () => {
    authState.authorized = false;
    const form = new FormData();
    form.append("file", await jpegFile());
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("عضو بدون نقش مدیر: 403", async () => {
    authState.role = "staff";
    const form = new FormData();
    form.append("file", await jpegFile());
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(403);
    expect(persistMock).not.toHaveBeenCalled();
  });

  it("بدون فایل: 400", async () => {
    const form = new FormData();
    form.append("unrelated", "x");
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("فایل غیرتصویری با MIME جعلی: 400 (بواسید بایت‌ها)", async () => {
    const form = new FormData();
    form.append("file", new File([Buffer.from("definitely not an image")], "evil.jpg", { type: "image/jpeg" }));
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error?: { message?: string } };
    expect(body.error?.message).toContain("تصویر");
  });

  it("فایل بزرگ‌تر از سقف: 400 قبل از استانداردسازی", async () => {
    const form = new FormData();
    form.append("file", new File([Buffer.alloc(5 * 1024 * 1024)], "big.jpg", { type: "image/jpeg" }));
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(400);
  });

  it("شکست ذخیره‌سازی: خطای صادقانه — هرگز URL فیک", async () => {
    persistMock.mockRejectedValue(new ApiError("PROVIDER_ERROR", "ذخیره‌سازی تصویر موقتاً در دسترس نیست", 503));
    const form = new FormData();
    form.append("file", await jpegFile());
    const res = await POST(makeRequest(form), { params: Promise.resolve({}) });
    expect(res.status).toBe(503);
    const body = (await res.json()) as { error?: { code?: string; message?: string } };
    expect(body.error?.code).toBe("PROVIDER_ERROR");
    expect(body.error?.message).toContain("ذخیره‌سازی");
  });
});

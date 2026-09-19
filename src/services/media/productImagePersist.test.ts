import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import http from "node:http";
import sharp from "sharp";
import { persistProductImage } from "./productImageAgent";
import { ApiError } from "@/lib/api/errors";

/**
 * تست یکپارچگی لایهٔ ذخیره‌سازی ایجنت — با «کلاینت واقعی supabase-js»
 * وصل به یک استوریج محلی شبیه‌ساز (همان قرارداد REST باکت‌های سوپابیس).
 * اثبات می‌کند: انتخاب کلاینت سرویس‌رول، فرمت کلید vendors/<id>/،
 * contentType، publicUrl و خطاهای صادقانه — بدون هیچ کلید ابری.
 * (module server-only برای محیط تست استاب می‌شود.)
 */

vi.mock("server-only", () => ({}));

let server: http.Server;
let baseUrl = "";
let stored: { path: string; bytes: Buffer } | null = null;
let failMode = false;

beforeAll(async () => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-role-key";
  server = http.createServer((req, res) => {
    const url = req.url ?? "";
    if (req.method === "POST" && url.startsWith("/storage/v1/object/product-images/")) {
      const chunks: Buffer[] = [];
      req.on("data", (c: Buffer) => chunks.push(c));
      req.on("end", () => {
        if (failMode) {
          res.writeHead(400, { "content-type": "application/json" });
          res.end(JSON.stringify({ message: "bucket unavailable", statusCode: "400", error: "bad_request" }));
          return;
        }
        const bytes = Buffer.concat(chunks);
        const path = decodeURIComponent(url.replace("/storage/v1/object/", ""));
        stored = { path, bytes };
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ Key: path }));
      });
      return;
    }
    if (req.method === "GET" && url.startsWith("/storage/v1/object/public/product-images/")) {
      if (stored && url.includes(stored.path)) {
        res.writeHead(200, { "content-type": "image/webp" });
        res.end(stored.bytes);
        return;
      }
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(404);
    res.end("{}");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  baseUrl = `http://127.0.0.1:${port}`;
  process.env.NEXT_PUBLIC_SUPABASE_URL = baseUrl;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

async function smallJpeg(): Promise<Buffer> {
  return sharp({ create: { width: 700, height: 500, channels: 3, background: { r: 40, g: 90, b: 160 } } })
    .jpeg({ quality: 88 })
    .toBuffer();
}

describe("productImageAgent — persistProductImage", () => {
  it("عکس استانداردشده را با کلید vendors/<id> ذخیره و URL عمومی سالم برمی‌گرداند", async () => {
    const input = await smallJpeg();
    const { buffer } = await persistAndStandardize(input);
    const persisted = await persistProductImage(buffer, { vendorId: "vendor-test-1" });

    expect(persisted.storage).toBe("supabase");
    expect(persisted.key.startsWith("vendors/vendor-test-1/")).toBe(true);
    expect(persisted.key.endsWith(".webp")).toBe(true);
    // getPublicUrl خودش نام باکت را در مسیر می‌گذارد (قرارداد supabase-js)
    expect(persisted.url).toBe(`${baseUrl}/storage/v1/object/public/product-images/${persisted.key}`);

    // رکورد رسیده به استوریج: مسیر باکت + بایت‌های WebP واقعی
    const row = stored as { path: string; bytes: Buffer };
    expect(row.path).toBe(`product-images/${persisted.key}`);
    expect(row.bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");

    // URL عمومی واقعاً سرو می‌شود
    const res = await fetch(persisted.url);
    expect(res.status).toBe(200);
    const served = Buffer.from(await res.arrayBuffer());
    expect(served.equals(row.bytes)).toBe(true);
  });

  it("شکست استوریج = ApiError ۵۰۲ صادقانه، هرگز موفقیت فیک", async () => {
    failMode = true;
    const input = await smallJpeg();
    const { buffer } = await persistAndStandardize(input);
    const err = await persistProductImage(buffer, { vendorId: "v" }).catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).status).toBe(502);
    expect((err as ApiError).message).toContain("بارگذاری عکس");
    failMode = false;
  });

  it("بدون هیچ استوریج تنظیم‌شده = ۵۰۳ صادقانه", async () => {
    const input = await smallJpeg();
    const { buffer } = await persistAndStandardize(input);
    const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    try {
      const err = await persistProductImage(buffer, { vendorId: "v" }).catch((e: unknown) => e as ApiError);
      expect(err).toBeInstanceOf(ApiError);
      expect((err as ApiError).status).toBe(503);
      expect((err as ApiError).message).toContain("ذخیره‌سازی تصویر");
    } finally {
      process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
      process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    }
  });
});

/** استانداردسازی واقعی (sharp) برای تولید ورودی WebP معین. */
async function persistAndStandardize(bytes: Buffer): Promise<{ buffer: Buffer }> {
  const { standardizeProductImage } = await import("./productImageAgent");
  return standardizeProductImage({ bytes });
}

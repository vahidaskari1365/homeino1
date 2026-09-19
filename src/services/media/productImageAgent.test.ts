import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PRODUCT_IMAGE_STANDARD, standardizeProductImage } from "./productImageAgent";
import { ApiError } from "@/lib/api/errors";

/**
 * تست ایجنت استانداردسازی تصویر محصول — همه با بافر واقعی sharp.
 * هر سناریو یک واقعیت تولیدی (نه فیکسچر استاتیک) می‌سازد و خروجی
 * پایپ‌لاین را پیکسل‌به‌پیکسل و متادیتا-به-متادیتا راستی‌آزمایی می‌کند.
 */

const SIZE = PRODUCT_IMAGE_STANDARD.size;

async function jpegOf(
  width: number,
  height: number,
  color = { r: 200, g: 120, b: 80 },
  quality = 92,
): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: color } })
    .jpeg({ quality })
    .toBuffer();
}

async function transparentPngOf(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 4, background: { r: 200, g: 120, b: 80, alpha: 0 } },
  })
    .png()
    .toBuffer();
}

async function metadataOf(buf: Buffer) {
  return sharp(buf).metadata();
}

async function centerPixel(buf: Buffer): Promise<[number, number, number]> {
  const meta = await metadataOf(buf);
  const w = meta.width ?? SIZE;
  const h = meta.height ?? SIZE;
  const raw = await sharp(buf)
    .extract({ left: Math.floor(w / 2), top: Math.floor(h / 2), width: 1, height: 1 })
    .raw()
    .toBuffer();
  return [raw[0], raw[1], raw[2]];
}

describe("productImageAgent — standardizeProductImage", () => {
  it("عکس بزرگ افقی را به مربع کامل ۱۲۰۰×۱۲۰۰ WebP استاندارد می‌کند", async () => {
    const input = await jpegOf(2400, 1600);
    const { buffer, report } = await standardizeProductImage({ bytes: input });

    expect(report.original).toMatchObject({ format: "jpeg", width: 2400, height: 1600 });
    expect(report.output).toMatchObject({ format: "webp", width: SIZE, height: SIZE });
    expect(report.actions).toContain("resized");
    expect(report.actions).toContain("square-pad");
    expect(report.actions).toContain("metadata-strip");
    expect(report.output.bytes).toBeLessThan(input.length);

    const meta = await metadataOf(buffer);
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(SIZE);
    expect(meta.height).toBe(SIZE);
    expect(meta.channels).toBe(3); // آلفا ندارد
    // امضای RIFF/WebP
    expect(buffer.subarray(0, 4).toString("ascii")).toBe("RIFF");
    expect(buffer.subarray(8, 12).toString("ascii")).toBe("WEBP");
  });

  it("PNG شفاف را روی سفید تخت می‌کند — پیکسل مرکز واقعاً سفید است", async () => {
    const input = await transparentPngOf(800, 800);
    const { buffer, report } = await standardizeProductImage({ bytes: input });

    expect(report.actions).toContain("alpha-flatten");
    expect(report.actions).toContain("square-pad");
    const meta = await metadataOf(buffer);
    expect(meta.channels).toBe(3);
    expect([...(await centerPixel(buffer))]).toEqual([255, 255, 255]);
  });

  it("جهت EXIF را اعمال می‌کند و ابعاد مؤثر را درست گزارش می‌دهد", async () => {
    // orientation 6 = عکس باید ۹۰ درجه بچرخد؛ عرض/ارتفاع مؤثر جابه‌جا می‌شود
    const input = await sharp({ create: { width: 1600, height: 1200, channels: 3, background: { r: 10, g: 180, b: 90 } } })
      .withMetadata({ orientation: 6 })
      .jpeg({ quality: 90 })
      .toBuffer();

    const { buffer, report } = await standardizeProductImage({ bytes: input });

    expect(report.original).toMatchObject({ width: 1200, height: 1600 }); // مؤثر، نه ذخیره‌شده
    expect(report.actions).toContain("exif-rotate");
    const meta = await metadataOf(buffer);
    expect(meta.width).toBe(SIZE);
    expect(meta.height).toBe(SIZE);
  });

  it("عکس کوچک‌تر از حد مجاز را با پیام فارسی رد می‌کند", async () => {
    const input = await jpegOf(100, 90);
    await expect(standardizeProductImage({ bytes: input })).rejects.toMatchObject({
      code: "INVALID_INPUT",
      status: 400,
    });
  });

  it("فایل غیرتصویری (MIME جعلی) را از روی بایت‌ها رد می‌کند", async () => {
    const fake = Buffer.concat([Buffer.from("%PDF-1.4 fake pdf bytes"), Buffer.alloc(512, 1)]);
    await expect(standardizeProductImage({ bytes: fake })).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
  });

  it("حجم بالای سقف را قبل از هر پردازشی رد می‌کند", async () => {
    const big = Buffer.alloc(PRODUCT_IMAGE_STANDARD.maxInputBytes + 1);
    const err = await standardizeProductImage({ bytes: big }).catch((e: unknown) => e as ApiError);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).message).toContain("مگابایت");
  });

  it("عکس مربعِ استاندارد را تغییر اندازه نمی‌دهد — فقط فشرده و متادیتا-پاک", async () => {
    const input = await jpegOf(SIZE, SIZE);
    const { buffer, report } = await standardizeProductImage({ bytes: input });

    expect(report.actions).not.toContain("resized");
    expect(report.actions).not.toContain("square-pad");
    expect(report.actions).toContain("recompress");
    expect(report.output).toMatchObject({ width: SIZE, height: SIZE });
    const meta = await metadataOf(buffer);
    expect(meta.width).toBe(SIZE);
    expect(meta.height).toBe(SIZE);
  });

  it("نسبت نامتعارف و رزولوشن پایین را صادقانه هشدار می‌دهد", async () => {
    const input = await jpegOf(3000, 500);
    const { report } = await standardizeProductImage({ bytes: input });

    expect(report.warnings).toContain("extreme-aspect");
    expect(report.warnings).toContain("low-resolution");
    expect(report.output).toMatchObject({ width: SIZE, height: SIZE });
  });

  it("هرگز بزرگ‌نمایی نمی‌کند — عکس کوچکِ مجاز فقط پد مربع می‌گیرد", async () => {
    const input = await jpegOf(400, 300);
    const { buffer, report } = await standardizeProductImage({ bytes: input });

    expect(report.actions).not.toContain("resized");
    expect(report.actions).toContain("square-pad");
    expect(report.warnings).toContain("low-resolution");
    // محتوا بدون بزرگ‌نمایی ۴۰۰×۳۰۰ وسط بوم ۱۲۰۰ است — گوشه بالا-چپ سفید
    const corner = await sharp(buffer)
      .extract({ left: 10, top: 10, width: 1, height: 1 })
      .raw()
      .toBuffer();
    expect([corner[0], corner[1], corner[2]]).toEqual([255, 255, 255]);
  });
});

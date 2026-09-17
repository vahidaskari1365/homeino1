import { describe, it, expect } from "vitest";
import {
  md5Buf,
  findConflict,
  registerCover,
  probeImageDims,
  looksLikeNonPhoto,
} from "./cover-pipeline.mjs";

describe("cover-pipeline — رجیستری ضدتکرار کاور (Task 43)", () => {
  const emptyReg = () => ({ byMd5: {}, byPath: {}, byUrl: {} });

  it("md5Buf خروجی پایدار دارد", () => {
    expect(md5Buf(Buffer.from("homeino"))).toBe(md5Buf(Buffer.from("homeino")));
    expect(md5Buf(Buffer.from("a"))).not.toBe(md5Buf(Buffer.from("b")));
  });

  it("بایت تکراری برای بریف دیگر ممنوع است", () => {
    const reg = emptyReg();
    registerCover({ md5: "abc123", publicPath: "/images/trends/src/a.jpg", url: "https://x/a.jpg", slug: "brief-a" }, reg);
    const dup = findConflict({ buf: Buffer.from("x"), url: "https://y/b.jpg", selfSlug: "brief-b" }, reg);
    // بایت «x» هنوز ثبت نشده — نباید تداخل بدهد
    expect(dup).toBeNull();
    // اما همان md5 ثبت‌شده تداخل می‌دهد
    const reg2 = emptyReg();
    const buf = Buffer.from("same-bytes");
    registerCover({ md5: md5Buf(buf), slug: "brief-a" }, reg2);
    expect(findConflict({ buf, selfSlug: "brief-b" }, reg2)).toBe(`md5-dup:brief-a`);
  });

  it("بریفِ خودش تداخل حساب نمی‌شود", () => {
    const reg = emptyReg();
    const buf = Buffer.from("self");
    registerCover({ md5: md5Buf(buf), publicPath: "/images/trends/src/self.jpg", url: "https://x/self", slug: "brief-a" }, reg);
    expect(findConflict({ buf, publicPath: "/images/trends/src/self.jpg", url: "https://x/self", selfSlug: "brief-a" }, reg)).toBeNull();
  });

  it("مسیر و URL تکراری هم گرفته می‌شود", () => {
    const reg = emptyReg();
    registerCover({ publicPath: "/images/trends/src/a.jpg", url: "https://x/a.jpg", slug: "brief-a" }, reg);
    expect(findConflict({ publicPath: "/images/trends/src/a.jpg", selfSlug: "brief-b" }, reg)).toBe("path-dup:brief-a");
    expect(findConflict({ url: "https://x/a.jpg", selfSlug: "brief-c" }, reg)).toBe("url-dup:brief-a");
  });

  it("probeImageDims ابعاد PNG را می‌خواند", () => {
    const png = Buffer.alloc(24);
    png[0] = 0x89; png[1] = 0x50; // امضای PNG
    png.writeUInt32BE(1152, 16);
    png.writeUInt32BE(864, 20);
    expect(probeImageDims(png)).toEqual({ w: 1152, h: 864 });
  });

  it("gatedims از عکس ریز رد می‌شود (در downloadCoverImage) — اینجا فقط گیت URL", () => {
    expect(looksLikeNonPhoto("https://site.com/logo.png")).toBe(true);
    expect(looksLikeNonPhoto("https://site.com/collage-banner.jpg")).toBe(true);
    expect(looksLikeNonPhoto("https://site.com/living-room-photo.jpg")).toBe(false);
  });
});

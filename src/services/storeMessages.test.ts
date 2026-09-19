import { describe, expect, it } from "vitest";
import { groupVendorThreads, normalizeMessageBody } from "./storeMessages";

// Task 60 — گفتگوی مشتری و فروشنده: کمک‌تابع‌های pure
// (نرمال‌سازی بدنهٔ پیام + گروه‌بندی رشته‌های فروشنده با شمارش خوانده‌نشده)

describe("normalizeMessageBody — نرمال‌سازی پیام", () => {
  it("فاصله‌های اضافی را جمع می‌کند و trim می‌کند", () => {
    expect(normalizeMessageBody("  سلام   این یک  تست است  ")).toBe("سلام این یک تست است");
  });

  it("بدنهٔ غیر رشته‌ای → رشتهٔ خالی (نامعتبر)", () => {
    expect(normalizeMessageBody(undefined)).toBe("");
    expect(normalizeMessageBody(null)).toBe("");
    expect(normalizeMessageBody(42)).toBe("");
    expect(normalizeMessageBody({ body: "x" })).toBe("");
  });

  it("به سقف ۲۰۰۰ نویسه می‌بُرد", () => {
    const long = "ا".repeat(2500);
    expect(normalizeMessageBody(long)).toHaveLength(2000);
  });

  it("پیام فقط-فاصله → خالی (route خطای «متن پیام خالی است» می‌دهد)", () => {
    expect(normalizeMessageBody("     ")).toBe("");
  });

  it("خط جدید و تب هم به یک فاصله تبدیل می‌شود (پیامک‌پسند)", () => {
    expect(normalizeMessageBody("سلام\n\nموجود\tاست؟")).toBe("سلام موجود است؟");
  });
});

describe("groupVendorThreads — رشته‌های گفتگوی فروشنده", () => {
  const meta = new Map([
    ["c1", { name: "سارا محمدی", email: "sara@example.com" }],
    ["c2", { name: "", email: "amir@example.com" }],
  ]);

  it("هر مشتری یک رشته؛ جدیدترین رشته اول", () => {
    const rows = [
      { customerId: "c1", body: "سلام", senderRole: "customer", readAt: null, createdAt: new Date("2026-09-19T10:00:00Z") },
      { customerId: "c2", body: "موجود است؟", senderRole: "customer", readAt: null, createdAt: new Date("2026-09-19T11:00:00Z") },
    ];
    const threads = groupVendorThreads(rows, meta);
    expect(threads).toHaveLength(2);
    expect(threads[0].customerId).toBe("c2"); // ۱۱:۰۰ جدیدتر از ۱۰:۰۰
    expect(threads[0].lastBody).toBe("موجود است؟");
  });

  it("خوانده‌نشده = پیام مشتریِ با readAt خالی — پاسخ فروشنده شمرده نمی‌شود", () => {
    const rows = [
      { customerId: "c1", body: "سلام", senderRole: "customer", readAt: null, createdAt: new Date("2026-09-19T10:00:00Z") },
      { customerId: "c1", body: "بله؟", senderRole: "vendor", readAt: null, createdAt: new Date("2026-09-19T10:05:00Z") },
      { customerId: "c1", body: "قیمت؟", senderRole: "customer", readAt: null, createdAt: new Date("2026-09-19T10:06:00Z") },
    ];
    const [thread] = groupVendorThreads(rows, meta);
    expect(thread.unread).toBe(2); // دو پیام مشتری خوانده‌نشده
  });

  it("پیام خوانده‌شدهٔ مشتری در unread نمی‌آید", () => {
    const rows = [
      { customerId: "c1", body: "سلام", senderRole: "customer", readAt: new Date("2026-09-19T10:30:00Z"), createdAt: new Date("2026-09-19T10:00:00Z") },
    ];
    const [thread] = groupVendorThreads(rows, meta);
    expect(thread.unread).toBe(0);
  });

  it("آخرین پیام رشته، جدیدترین پیام است — حتی اگر پاسخ فروشنده باشد (پیشوند «شما:» سمت UI)", () => {
    // قرارداد: rows جدیدترین‌اول (همان orderBy desc در SQL)
    const rows = [
      { customerId: "c1", body: "پاسخ فروشگاه", senderRole: "vendor", readAt: null, createdAt: new Date("2026-09-19T10:20:00Z") },
      { customerId: "c1", body: "سلام", senderRole: "customer", readAt: null, createdAt: new Date("2026-09-19T10:00:00Z") },
    ];
    const [thread] = groupVendorThreads(rows, meta);
    expect(thread.lastSenderRole).toBe("vendor");
    expect(thread.lastBody).toBe("پاسخ فروشگاه");
    expect(thread.lastAt).toBe("2026-09-19T10:20:00.000Z");
  });

  it("مشتری بدون name → «مشتری هومینو» و ایمیل همیشه می‌آید", () => {
    const rows = [
      { customerId: "c2", body: "درود", senderRole: "customer", readAt: null, createdAt: new Date("2026-09-19T09:00:00Z") },
    ];
    const [thread] = groupVendorThreads(rows, meta);
    expect(thread.customerName).toBe("مشتری هومینو");
    expect(thread.customerEmail).toBe("amir@example.com");
  });

  it("(senderRole غیرمنتظره به‌عنوان مشتری می‌آید — fail-closed برای badge)", () => {
    const rows = [
      { customerId: "c1", body: "؟؟", senderRole: "unknown", readAt: null, createdAt: new Date("2026-09-19T10:00:00Z") },
    ];
    const [thread] = groupVendorThreads(rows, meta);
    expect(thread.lastSenderRole).toBe("customer");
    expect(thread.unread).toBe(1);
  });
});

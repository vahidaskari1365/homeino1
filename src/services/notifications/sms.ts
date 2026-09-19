// ============================================================
// HOMEINO — SMS dispatcher (Task 59)
//
// مالک هنوز پنل پیامک نگرفته؛ معماری از امروز SMS-ready است:
// وقتی پنل خریداری شد، فقط این envها در Vercel ست می‌شوند و ارسال
// بدون هیچ تغییر کدی فعال می‌شود:
//
//   SMS_PROVIDER=kavenegar        (فعلاً فقط کاوه‌نگار — پرکارترین پنل ایران)
//   KAVENEGAR_API_KEY=...         (از پنل کاوه‌نگار → تنظیمات → API Key)
//   KAVENEGAR_SENDER=...          (اختیاری — خط ارسال؛ خالی = خط پیش‌فرض پنل)
//
// بدون کلید: getSmsProvider() → null و همه‌چیزِ پیامک «skipped» ثبت
// می‌شود — اعلان درون‌سایتی همیشه کار می‌کند و هیچ‌چیز فیک نمی‌شود.
//
// طراحی: پروایدر pure و fail-closed است؛ هیچ SDK خارجی (صفر وابستگی).
// ============================================================

export interface SmsSendResult {
  ok: boolean;
  /** شناسهٔ پیامک سمت پروایدر (وقتی برگرداند) */
  providerMessageId?: string;
  error?: string;
}

export interface SmsProvider {
  /** نام پروایدر — برای لاگ و ledger */
  readonly name: string;
  send(to: string, text: string): Promise<SmsSendResult>;
}

/**
 * نرمال‌سازی شمارهٔ موبایل ایران به قالب ۰۹xxxxxxxxx:
 *  +989123456789 | 00989123456789 | 989123456789 | 9123456789 → 09123456789
 * ارقام فارسی/عربی هم لاتین می‌شوند. غیرموبایل/ناقص → null.
 * (pure — تست‌شده)
 */
export function normalizeIranMobile(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  // فارسی/عربی → لاتین
  s = s
    .replace(/[\u06F0-\u06F9]/g, (c) => String(c.charCodeAt(0) - 0x06f0))
    .replace(/[\u0660-\u0669]/g, (c) => String(c.charCodeAt(0) - 0x0660));
  s = s.replace(/[\s\-()]/g, "").replace(/^\+|^00/, "");
  if (s.startsWith("98")) s = s.slice(2);
  // هر دو مسیر (98-presfix و 9-بدون‌صفر) به 09xx می‌رسند
  if (s.startsWith("9") && s.length === 10) s = `0${s}`;
  return /^09\d{9}$/.test(s) ? s : null;
}

/** کاوه‌نگار — REST v1 بدون SDK. ارسال یونیکد فارسی ساپورت می‌شود. */
export class KavenegarProvider implements SmsProvider {
  readonly name = "kavenegar";

  constructor(
    private readonly apiKey: string,
    private readonly sender?: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async send(to: string, text: string): Promise<SmsSendResult> {
    const receptor = normalizeIranMobile(to);
    if (!receptor) return { ok: false, error: "invalid_receptor" };
    if (!text.trim()) return { ok: false, error: "empty_message" };

    const params = new URLSearchParams({ receptor, message: text.slice(0, 600) });
    if (this.sender) params.set("sender", this.sender);

    try {
      const res = await this.fetchImpl(
        `https://api.kavenegar.com/v1/${encodeURIComponent(this.apiKey)}/sms/send.json?${params.toString()}`,
        { method: "GET", signal: AbortSignal.timeout(10_000) },
      );
      const data = (await res.json().catch(() => null)) as
        | { return?: { status?: number; message?: string; entries?: { messageid?: number }[] } }
        | null;
      // کاوه‌نگار: 200 HTTP + return.status=200 یعنی در صف ارسال رفت
      if (res.ok && data?.return?.status === 200) {
        return { ok: true, providerMessageId: data.return?.entries?.[0]?.messageid?.toString() };
      }
      return {
        ok: false,
        error: `kavenegar_status_${data?.return?.status ?? res.status}: ${data?.return?.message ?? "unknown"}`,
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

/**
 * پروایدر فعلی از env — بدون کلید، null (و اعلان‌ها فقط درون‌سایتی می‌مانند).
 * فعال‌سازی آیندهٔ مالک = فقط ست‌کردن env در Vercel. (fail-closed)
 */
export function getSmsProvider(): SmsProvider | null {
  const provider = (process.env.SMS_PROVIDER ?? "kavenegar").toLowerCase();
  if (provider !== "kavenegar") return null;
  const apiKey = process.env.KAVENEGAR_API_KEY;
  if (!apiKey) return null;
  return new KavenegarProvider(apiKey, process.env.KAVENEGAR_SENDER || undefined);
}

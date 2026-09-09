# بازبینی امنیتی پیش از ریلیز (اقتباس از مهارت security-review در ECC v2.2.1)

قبل از هر ریلیز بزرگ و قبل از باز کردن ثبت‌نام غرفه، این ۲۰ بند را برو.

## احراز هویت و دسترسی
- [ ] همه APIهای نوشتن (`POST/PUT/DELETE`) گارد `requireUser`/نقش دارند (`src/lib/api/auth.ts`)
- [ ] RLS سوپابیس فعال و migrationهای `supabase/migrations/*rls*` اعمال شده
- [ ] پنل ادمین فقط با نقش admin (نه فقط پنهان‌بودن لینک)
- [ ] vendor فقط به کالاهای غرفه خودش دسترسی دارد (ownership check در هر route)

## ورودی و خروجی
- [ ] هر route اعتبارسنجی schema دارد (`src/lib/api/validate.ts`) — payload ≤ 15MB برای آپلود عکس
- [ ] پرامت کاربر sanitize شده (`sanitizeUserPrompt` در `roomState.ts`) — تزریق پرامت مسدود
- [ ] خطاها با `toPublicAiError` — stack trace و نام provider هرگز به کلاینت نمی‌رود

## Secret و کلید
- [ ] `git log -p` و grep برای الگوهای کلید (sk_, ghp_, AIza, xpl_) — هرگز در تاریخ ریپو
- [ ] فایل‌های server-only (`engineConfig`, `provider`) import مستقیم در کلاینت ندارند
- [ ] rate limit فعال روی `/api/ai` و auth (`src/lib/api/rateLimit.ts`)

## آپلود و تصویر
- [ ] نوع/ابعاد فایل آپلودی چک می‌شود؛ path traversal در نام فایل ممکن نیست
- [ ] URL تصویر کاربر قبل از fetch (proxy) فقط http/https و به مقصد مجاز — SSRF بسته

## پرداخت (وقتی فعال شد)
- [ ] مبلغ از سمت سرور محاسبه شود، هرگز از کلاینت
- [ ] webhook با تأیید امضا (`src/services/payments.ts`)
- [ ] تسویه غرفه idempotent باشد (دوبار زدن = یک پرداخت)

## زیرساخت ایجنت
- [ ] ایجنت‌های Actions فقط `contents: write` حداقلی دارند (بدون `issues: write` مگر watchdog)
- [ ] `npx ecc-agentshield scan` (ورک‌فلو هفتگی) بدون یافته بحرانی

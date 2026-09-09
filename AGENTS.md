# AGENTS.md — قرارداد ایجنت‌های هومینو

> هر ایجنت/سشنی که روی این ریپو کار می‌کند (سندباکس، Claude Code، Codex، Cursor، اکشن‌های گیت‌هاب)
> باید این قرارداد را بخواند و رعایت کند. الهام‌گرفته از الگوی AGENTS.md در ECC (github.com/affaan-m/ECC).

## مأموریت

هومینو (`homeino.ir` — در حال راه‌اندازی): مارکت‌پلیس فارسی دکوراسیون و چیدمان خانه —
استودیوی هوش مصنوعی چیدمان + مارکت‌پلیس چند-غرفه + مجله و الهامِ تولیدشده با ایجنت.

## استک و ساختار

- **Next.js 16 + React 19 + TypeScript**، Tailwind 4، Supabase (migrations در `supabase/`)، Drizzle schema، Vitest
- `src/app/` مسیرها و API · `src/services/` منطق (ai, agents, automation, payments…) · `src/db/` schema · `scripts/` ابزار و ایجنت‌های روزانه · `.github/workflows/` اتومیشن
- داده ثابت فارسی: `src/data/` · محتوای مجله: `src/content/trends/trends.json` · پین‌های الهام: `src/data/inspirations.generated.json`

## کامندهای معتبر (قبل از هر پوش اجرا شود)

```bash
npx next build        # باید سبز شود
npx vitest run        # همه تست‌ها باید پاس شوند
# سلامت: GET /api/health
```

## قواعد سخت (شکستن آن‌ها ممنوع)

1. **Secret هرگز در ریپو نمی‌آید** — فقط GitHub Secrets (`LLM_KEYS_JSON`, `GITHUB_TOKEN`…) یا env هاست. توکن شخصی فقط در سندباکس (`homeino-pipeline/.env`).
2. **فایل‌های server-only** (`src/lib/supabase/server`, `engineConfig`, `provider.ts`) هرگز به باندل کلاینت راه پیدا نکنند.
3. **محتوای فارسی اورجینال** — بازنویسی، نه کپی؛ لحن گرم و حرفه‌ای؛ بدون تملق.
4. **کاهش صادقانه (honest degradation)** — اگر موتور AI واقعی در دسترس نیست، نتیجه باید `preview/mock` علامت بخورد؛ هرگز موفقیت جعلی.
5. **قرارداد ایجنت‌های روزانه را نشکن** — اسکریپت‌های `scripts/magazine-daily.mjs` و `scripts/inspiration-daily.mjs` سقف روزانه + dedupe + لاگ `src/data/agent-runs` دارند؛ `watchdog-daily` روی تازگی محتوا آلارم می‌دهد.
6. کامیت‌ها conventional: `feat|fix|agents|studio|magazine(scope): خلاصه` — متن کامیت انگلیسی یا فارسی، ولی توصیفی.
7. قبل از تغییر بزرگ، `WORKING-CONTEXT.md` را بخوان و بعد از کار، آن را به‌روز کن.

## زنجیره موتور تصویر (تصویرسازی/استیجینگ)

ترتیب رزولوشن در `src/services/ai/provider.ts`:
Gemini (`GEMINI_API_KEY`) → Z-Engine (`ZAI_API_BASE_URL`+`ZAI_API_KEY` یا `.z-ai-config`) → OpenAI-compat → FreeLLMAPI → **Pollinations فقط برای تولید** (کلید-کمتر) → **Mock** (پیش‌نمایش صادقانه).
ویرایش/استیجینگ (`edit|inpaint`) فقط با موتور واقعی انجام می‌شود — تشخیص وضعیت زنده: `GET /api/ai/status`.

## افزودن ایجنت روزانه جدید

بازیاب تولید ایجنت در `docs/agent-playbooks/new-daily-agent.md` — الگوی اثبات‌شده
(زمان‌بندی + نوبت جبرانی، concurrency، dedupe، استخر، لاگ اجرا، کامیت-اگر-تغییر، ثبت در watchdog).

## چک‌لیست‌های تخصصی

`docs/agent-skills/` — seo · ai-regression-testing · security-review · react-performance · frontend-a11y · e2e-critical-flows.
منشأ: مهارت‌های منتخب ECC v2.2.1 (MIT) اقتباس‌شده برای هومینو.

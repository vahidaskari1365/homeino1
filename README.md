# Homeino

پلتفرم جامع خانه و دکوراسیون و بازارگاه چندفروشگاهی — با قابلیت طراحی اختیاری مبتنی بر هوش مصنوعی، ساخته‌شده با Next.js.

> Homeino یک «وب‌سایت AI» نیست؛ هسته محصول، کشف، مقایسه و خرید از فروشگاه‌های مختلف است و AI یکی از قابلیت‌های مکمل آن محسوب می‌شود.

## امکانات

- فروشگاه کامل: محصولات، دسته‌بندی‌ها، استایل‌ها، فروشگاه‌ها (vendors) و اجناس دست‌دوم
- طراحی داخلی با هوش مصنوعی (AI) با سیستم اعتبار (credits)
- پنل کاربری: حساب، سفارش‌ها، طراحی‌ها، اعتبارها، پروفایل و تنظیمات
- پنل فروشنده: فروشگاه، محصولات، سفارش‌ها و آنالیتیکس
- پنل مدیریت: کاربران، فروشندگان، محصولات، سفارش‌ها و تنظیمات AI
- سبد خرید، مقایسه، علاقه‌مندی‌ها و پرداخت
- مجله، پروژه‌ها و الهام‌بخشی (inspiration)

## تکنولوژی‌ها

- [Next.js](https://nextjs.org) (App Router) — React 19
- [Tailwind CSS](https://tailwindcss.com) v4
- [Drizzle ORM](https://orm.drizzle.team) + PostgreSQL
- [Zustand](https://zustand.docs.pmnd.rs) — state management
- [Framer Motion](https://motion.dev) — انیمیشن‌ها
- [Lucide](https://lucide.dev) — آیکون‌ها

## شروع کار

```bash
npm install
npm run dev
```

سایت روی `http://localhost:3000` بالا می‌آید.

## اسکریپت‌ها

| دستور | توضیح |
| --- | --- |
| `npm run dev` | اجرای محیط توسعه |
| `npm run build` | بیلد تولید |
| `npm run start` | اجرای بیلد تولید |
| `npm run lint` | بررسی کد با ESLint |
| `npm run typecheck` | بررسی تایپ‌ها با TypeScript |
| `npx drizzle-kit push` | اعمال اسکیمای دیتابیس |

## ساختار پروژه

```
src/
├── app/          # صفحات و route handlerها (App Router)
├── components/   # کامپوننت‌های UI
├── config/       # تنظیمات پلتفرم
├── data/         # داده‌های نمونه (mock)
├── db/           # اتصال دیتابیس و اسکیما (Drizzle)
├── lib/          # ابزارها و auth
├── services/     # سرویس‌های AI و اعتبارها
├── stores/       # state مدیریت با Zustand
└── types/        # تایپ‌های مشترک
```

## متغیرهای محیطی

| متغیر | توضیح |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | آدرس canonical سایت (برای metadata/sitemap/robots/JSON-LD). fallback: `https://homeino.ir` |
| `NEXT_PUBLIC_API_BASE_URL` | (اختیاری) prefix برای `apiClient` — اگر خالی باشد از route handlerهای Next استفاده می‌شود |
| `DATABASE_URL` | آدرس اتصال PostgreSQL (اختیاری برای اجرا؛ فقط برای health check و درخواست‌های دیتابیس لازم است) |
| `GEMINI_API_KEY` | (اختیاری، فقط server) فعال‌سازی provider Gemini برای AI |
| `LLM_API_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` | (اختیاری، فقط server) هر endpoint سازگار با OpenAI برای LLM Service |
| `ORALI_API_BASE_URL` / `ORALI_API_KEY` | (اختیاری، فقط server) موتور واقعی ویرایش تصویر Orali |

اتصال دیتابیس به‌صورت lazy انجام می‌شود، بنابراین بدون `DATABASE_URL` هم برنامه بیلد و اجرا می‌شود.

## اتصال به Supabase

پروژه آماده‌ی اتصال مستقیم به Supabase است (Auth + Storage + PostgreSQL):

1. فایل `.env` را از روی `.env.example` بسازید و مقادیر پروژه‌ی Supabase خود را وارد کنید:

   ```bash
   SUPABASE_URL="https://<project-ref>.supabase.co"
   SUPABASE_ANON_KEY="eyJ..."
   SUPABASE_SERVICE_ROLE_KEY="eyJ..."
   NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
   NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..."
   DATABASE_URL="postgres://postgres.<project-ref>:<password>@aws-1-eu-west-1.pooler.supabase.com:5432/postgres?sslmode=require"
   ```

2. نصب وابستگی‌ها و ساخت جدول‌ها در Supabase (مایگریشن):

   ```bash
   npm install
   npm run db:migrate
   ```

   این دستور فایل‌های `supabase/migrations/*.sql` را به‌ترتیب و به‌صورت idempotent روی دیتابیس Supabase اعمال می‌کند (جدول‌ها، تریگر همگام‌سازی `auth.users`، RLS، باکت‌های Storage و داده‌های seed).

3. اجرای سایت:

   ```bash
   npm run dev
   ```

با تنظیم `DATABASE_URL`، لایه‌ی Repository به‌صورت خودکار از داده‌ی واقعی دیتابیس (از طریق `catalogService`) استفاده می‌کند و Auth هم به Supabase Auth متصل است.

## آمادگی برای اتصال Backend

Frontend این پروژه کاملاً محصولِ آماده لانچ است — با یک لایه Repository (در `src/repositories/`) که تنها اتصال UI به داده‌ی زیرین است. برای مهاجرت به Supabase یا هر backend دیگر فقط پیاده‌سازی repositoryها را عوض کنید. جزئیات کامل در `docs/PRODUCTION_READY.md`.

## استقرار روی Vercel

1. پروژه را به GitHub پوش کنید و از Vercel import کنید.
2. (اختیاری) اگر دیتابیس PostgreSQL دارید، `DATABASE_URL` را در **Project Settings → Environment Variables** تنظیم کنید.
3. Deploy کنید. ساختمان پروژه به‌صورت خودکار تشخیص داده می‌شود.
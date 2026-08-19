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
| `DATABASE_URL` | آدرس اتصال PostgreSQL (اختیاری برای اجرا؛ فقط برای health check و درخواست‌های دیتابیس لازم است) |

اتصال دیتابیس به‌صورت lazy انجام می‌شود، بنابراین بدون `DATABASE_URL` هم برنامه بیلد و اجرا می‌شود.

## استقرار روی Vercel

1. پروژه را به GitHub پوش کنید و از Vercel import کنید.
2. (اختیاری) اگر دیتابیس PostgreSQL دارید، `DATABASE_URL` را در **Project Settings → Environment Variables** تنظیم کنید.
3. Deploy کنید. ساختمان پروژه به‌صورت خودکار تشخیص داده می‌شود.
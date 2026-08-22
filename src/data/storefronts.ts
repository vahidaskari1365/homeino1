import type { StorefrontProfile, StoreReview } from "@/types";

// Frontend fixture contract for future vendor-profile and store-review APIs.
// Claims are read only from this data layer; components never manufacture them.
const baseProfiles: Record<string, Omit<StorefrontProfile, "storeId">> = {
  st1: { joinedAt: "۱۳۹۹", fulfilledOrders: 3840, responseRate: 97, responseTime: "کمتر از ۲ ساعت", dispatchTime: "۱ تا ۲ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "مبلمان حجیم با هماهنگی قبلی و بیمه حمل ارسال می‌شود.", returnDays: 7, returnNote: "کالای استفاده‌نشده با بسته‌بندی سالم تا ۷ روز قابل بازگشت است.", authenticityNote: "هویت و اطلاعات کارگاه توسط Homeino بررسی شده است." },
  st2: { joinedAt: "۱۴۰۲", fulfilledOrders: 1180, responseRate: 94, responseTime: "کمتر از ۴ ساعت", dispatchTime: "۱ تا ۳ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "کالاهای شکستنی با بسته‌بندی محافظ ارسال می‌شوند.", returnDays: 7, returnNote: "بازگشت کالای سالم و استفاده‌نشده تا ۷ روز پذیرفته می‌شود.", authenticityNote: "هویت و نشانی فروشگاه توسط Homeino بررسی شده است." },
  st3: { joinedAt: "۱۴۰۰", fulfilledOrders: 2710, responseRate: 98, responseTime: "کمتر از ۱ ساعت", dispatchTime: "۱ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "ارسال استاندارد و اکسپرس برای بیشتر محصولات فعال است.", returnDays: 7, returnNote: "در صورت نصب‌نشدن کالا، بازگشت تا ۷ روز امکان‌پذیر است.", authenticityNote: "هویت، نشانی و سابقه فروشگاه توسط Homeino بررسی شده است." },
  st4: { joinedAt: "۱۳۹۸", fulfilledOrders: 1950, responseRate: 93, responseTime: "همان روز کاری", dispatchTime: "۲ تا ۴ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "فرش‌ها به‌صورت رول‌شده و بیمه‌شده ارسال می‌شوند.", returnDays: 7, returnNote: "محصول بدون استفاده و آسیب تا ۷ روز قابل بازگشت است.", authenticityNote: "هویت و نشانی فروشگاه توسط Homeino بررسی شده است." },
  st5: { joinedAt: "۱۴۰۳", fulfilledOrders: 620, responseRate: 91, responseTime: "همان روز کاری", dispatchTime: "۲ تا ۳ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "سفارش‌های پارچه سفارشی زمان آماده‌سازی جداگانه دارند.", returnDays: 7, returnNote: "کالای غیرسفارشی و استفاده‌نشده تا ۷ روز قابل بازگشت است.", authenticityNote: "مدارک تأیید فروشگاه هنوز در حال تکمیل است." },
  st6: { joinedAt: "۱۴۰۰", fulfilledOrders: 2230, responseRate: 96, responseTime: "کمتر از ۳ ساعت", dispatchTime: "۱ تا ۲ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "محصولات سرامیکی با پوشش شکستنی ارسال می‌شوند.", returnDays: 7, returnNote: "آسیب حمل را تا ۲۴ ساعت همراه تصویر گزارش کنید.", authenticityNote: "هویت و کارگاه تولید توسط Homeino بررسی شده است." },
  st7: { joinedAt: "۱۳۹۹", fulfilledOrders: 1680, responseRate: 95, responseTime: "کمتر از ۳ ساعت", dispatchTime: "۲ تا ۵ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "زمان دقیق ارسال محصولات حجیم پیش از نهایی‌کردن سفارش اعلام می‌شود.", returnDays: 7, returnNote: "محصولات استاندارد تا ۷ روز و پیش از مونتاژ قابل بازگشت‌اند.", authenticityNote: "هویت و نشانی فروشگاه توسط Homeino بررسی شده است." },
  st8: { joinedAt: "۱۴۰۳", fulfilledOrders: 430, responseRate: 89, responseTime: "همان روز کاری", dispatchTime: "۲ تا ۴ روز کاری", shippingCoverage: "تهران و شهرهای منتخب", shippingNote: "پوشش ارسال هر محصول در صفحه همان محصول نمایش داده می‌شود.", returnDays: 7, returnNote: "کالای مونتاژنشده تا ۷ روز قابل بازگشت است.", authenticityNote: "مدارک تأیید فروشگاه هنوز در حال تکمیل است." },
  st9: { joinedAt: "۱۴۰۲", fulfilledOrders: 510, responseRate: 90, responseTime: "همان روز کاری", dispatchTime: "۲ تا ۵ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "هزینه حمل محصولات فضای باز بر اساس مقصد محاسبه می‌شود.", returnDays: 7, returnNote: "کالای استفاده‌نشده تا ۷ روز قابل بازگشت است.", authenticityNote: "مدارک تأیید فروشگاه هنوز در حال تکمیل است." },
  st10: { joinedAt: "۱۳۹۸", fulfilledOrders: 2960, responseRate: 98, responseTime: "کمتر از ۲ ساعت", dispatchTime: "۱ تا ۳ روز کاری", shippingCoverage: "ارسال به سراسر ایران", shippingNote: "سفارش‌های خاص با بسته‌بندی و بیمه حمل ارسال می‌شوند.", returnDays: 7, returnNote: "شرایط بازگشت کالای سفارشی پیش از خرید به‌طور جداگانه اعلام می‌شود.", authenticityNote: "هویت، نشانی و سابقه فروشگاه توسط Homeino بررسی شده است." },
};

export const storefrontProfiles: StorefrontProfile[] = Object.entries(baseProfiles).map(([storeId, profile]) => ({ storeId, ...profile }));

export const getStorefrontProfile = (storeId: string) =>
  storefrontProfiles.find((profile) => profile.storeId === storeId);

const reviewTemplates = [
  { author: "سارا محمدی", rating: 5, date: "۱۲ مرداد ۱۴۰۳", comment: "بسته‌بندی دقیق بود و فروشگاه قبل از ارسال، زمان تحویل را هماهنگ کرد." },
  { author: "امیرحسین رضایی", rating: 4, date: "۲۹ تیر ۱۴۰۳", comment: "محصول مطابق توضیحات رسید. پاسخ‌گویی فروشگاه هم شفاف و محترمانه بود." },
  { author: "ندا کیانی", rating: 5, date: "۱۸ تیر ۱۴۰۳", comment: "کیفیت محصول و روند پیگیری سفارش رضایت‌بخش بود. دوباره خرید می‌کنم." },
];

export const storeReviews: StoreReview[] = Object.keys(baseProfiles).flatMap((storeId) =>
  reviewTemplates.map((review, index) => ({
    id: `${storeId}-review-${index + 1}`,
    storeId,
    ...review,
    verifiedPurchase: true,
  })),
);

export const reviewsForStore = (storeId: string) =>
  storeReviews.filter((review) => review.storeId === storeId);

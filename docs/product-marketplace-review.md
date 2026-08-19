# بازبینی محصول و Marketplace — Homeino

تاریخ: ۲۰۲۶-۰۸-۱۹

## جایگاه محصول

Homeino یک AI Website نیست. Homeino پلتفرم جامع خانه و دکوراسیون و یک Marketplace چندفروشگاهی است. ارزش اصلی آن کوتاه‌کردن فاصله بین «نمی‌دانم چه می‌خواهم» تا «انتخاب مطمئن و خرید» است. AI فقط یکی از ابزارهای اختیاری این مسیر است.

## تصمیم‌ها از منظر نقش‌ها

### Principal Product Manager

- معماری تجربه به پنج مسیر اصلی تقسیم شد: کشف، ارزیابی، ذخیره/برنامه‌ریزی، طراحی اختیاری و خرید.
- Hero و ناوبری از AI-first به Marketplace-first تغییر کردند.
- کالکشن شخصی با state پایدار، ساخت مجموعه و افزودن/حذف محصول اضافه شد.
- قرارداد Frontend فروشگاه شامل profile، review، shipping و policy از مدل پایه Store جدا شد تا بعداً مستقل به API فروشنده متصل شود.
- Cart اکنون `offerId` را نگه می‌دارد؛ بنابراین انتخاب فروشنده از PDP تا سبد حفظ می‌شود.

### Sales Director

- بلوک خرید PDP یک سلسله‌مراتب روشن دارد: قیمت، تخفیف، موجودی، فروشنده، اعتبار فروشگاه، امتیاز، نظر، ارسال، بازگشت و CTA.
- چند فروشنده با مبلغ نهایی (قیمت + ارسال)، زمان ارسال، امتیاز و موجودی مقایسه می‌شوند.
- CTA اصلی فقط «افزودن به سبد خرید» است؛ علاقه‌مندی، کالکشن و مقایسه به‌عنوان اقدام ثانویه جدا شده‌اند.
- سبد خرید بر اساس فروشگاه گروه‌بندی و هزینه/زمان مرسوله هر فروشگاه حفظ می‌شود.

### Marketing Director

- پیام اصلی برند از «طراحی AI» به «از ایده تا خرید، همه‌چیز برای خانه» تغییر کرد.
- دسته‌بندی، محصولات محبوب، فروشگاه‌ها، الهام، کالکشن و سبک‌ها قبل یا هم‌سطح AI دیده می‌شوند.
- وعده‌های غیرقابل اثبات خبرنامه و scarcity copy حذف شدند.
- عبارت‌های اعتماد فقط از لایه داده و تنظیمات خوانده می‌شوند، نه از متن‌های پراکنده کامپوننت‌ها.

### Growth Manager

- Discovery loop کامل‌تر شد: search، category، filters، sorting، popular، trending، similar، related و recently viewed.
- Retention loop با wishlist، follow store، recently viewed و collection تقویت شد.
- Cross-sell بر اساس نزدیکی سبک/دسته توضیح داده می‌شود و با تبلیغ پنهان اشتباه نمی‌شود.
- Mobile bottom navigation اکنون Search را در مرکز قرار می‌دهد، نه AI؛ این کار intent غالب کاربران Marketplace را اولویت می‌دهد.

### Consumer Psychology

- تایمر، کمیابی ساختگی، متن اضطراب‌آور و «فقط چند عدد باقی مانده!» حذف شد.
- موجودی به‌شکل factual نمایش داده می‌شود.
- «بهترین فروشنده» مبهم با «کمترین مبلغ نهایی» و توضیح معیار مرتب‌سازی جایگزین شد.
- وضعیت تأییدنشده فروشگاه پنهان نمی‌شود.
- AI با برچسب «اختیاری» و توضیح صادقانه قابلیت آینده نمایش داده می‌شود.
- خبرنامه در نسخه نمایشی وعده کد تخفیف یا اعتبار غیرواقعی نمی‌دهد.

## معماری Frontend فروشگاه

`Store` اطلاعات فهرستی را نگه می‌دارد. `StorefrontProfile` اطلاعات ویترین را برای API آینده مدل می‌کند:

- identity, logo, banner
- verification
- rating and reviews
- fulfilled orders and response rate
- products and categories
- dispatch and shipping coverage
- return and authenticity policy

داده فعلی fixture است و Backend فروشگاه ساخته نشده است.

## معیارهای پیشنهادی پس از اتصال Analytics

1. Search-to-product-view rate
2. Category-to-product-view rate
3. Product-view-to-compare rate
4. Product-view-to-add-to-cart rate به تفکیک seller/offer
5. Seller switch rate روی PDP
6. Wishlist-to-cart و Collection-to-cart rate
7. Store-page-to-product-view rate
8. PDP trust-section interaction و review open rate
9. Cart-to-checkout و checkout completion
10. AI adoption جدا از commerce conversion، نه به‌عنوان KPI اصلی Homeino

## رویدادهای پیشنهادی

- `search_opened`, `search_submitted`, `filter_applied`, `sort_changed`
- `product_viewed`, `seller_selected`, `compare_added`
- `wishlist_added`, `collection_created`, `collection_product_added`
- `store_viewed`, `store_followed`, `policy_viewed`
- `add_to_cart`, `checkout_started`, `purchase_completed`
- `ai_design_started`, `ai_design_completed`, `ai_product_match_opened`

## Backendهای عمداً خارج از محدوده

- onboarding و احراز فروشگاه
- inventory/price sync
- order routing و seller settlement
- review verification
- payment gateway و refund workflow
- newsletter delivery
- اتصال محصول واقعی به خروجی AI

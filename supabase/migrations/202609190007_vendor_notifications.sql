-- =====================================================================
-- Vendor notifications «مرکز اطلاع‌رسانی فروشنده» (Task 59 — درخواست مالک)
--
-- «جایی باشه که به فروشنده پیغام بره» — صندوق پیام درون‌سایتی هر فروشگاه
-- + دفترِ وضعیت ارسال SMS برای وقتی پنل پیامک مالک فعال شد:
--   • هر سطر = یک پیام برای فروشگاه (فروش جدید، تسویه، پکیج، پیام پلتفرم)
--   • sms_status مسیر پیامک را شفاف نگه می‌دارد:
--       pending  → در صف ارسال (پروایدر ست نیست → همان لحظه skipped می‌شود)
--       sent     → با موفقیت به پروایدر پیامک داده شد
--       failed   → پروایدر خطا داد (جزئیات در sms_error)
--       skipped  → پروایدر پیکربندی نشده (کلید env بعداً ست شود → sent)
--       no_phone → شمارهٔ موبایل معتبری برای فروشگاه پیدا نشد
-- طراحی صادقانه: هیچ پیام فیک ساخته نمی‌شود؛ ارسال SMS از داخل سرویس
-- سرور انجام می‌شود و شکستش هرگز جریان اصلی (پرداخت/تسویه) را نمی‌شکند.
--
-- RLS: member-read via is_vendor_member(); ALL writes go through the
-- server (owner role bypasses RLS) — authorization lives in the route
-- handlers (requireVendorMember).
-- =====================================================================

-- 1) notification inbox -------------------------------------------------
create table if not exists public.vendor_notifications (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  kind varchar(40) not null,                -- order_sold | payout | package | platform_message
  title varchar(200) not null,
  body text,
  link varchar(300),                        -- مسیر درون‌سایتی برای کلیک
  meta jsonb not null default '{}',
  read_at timestamptz,                      -- null = خوانده‌نشده
  sms_status varchar(20) not null default 'pending'
    check (sms_status in ('pending','sent','failed','skipped','no_phone')),
  sms_error text,
  sms_sent_at timestamptz,
  created_at timestamptz not null default now()
);
comment on table public.vendor_notifications is
  'صندوق پیام فروشنده (Task 59): اعلان خودکار فروش/تسویه/پکیج + پیام پلتفرم؛ وضعیت SMS per-row.';

create index if not exists vendor_notifications_vendor_idx
  on public.vendor_notifications using btree (vendor_id, created_at desc);
-- partial index برای شمارش خوانده‌نشده‌ها (سبک و همیشه hot)
create index if not exists vendor_notifications_unread_idx
  on public.vendor_notifications using btree (vendor_id, created_at desc)
  where read_at is null;

alter table public.vendor_notifications enable row level security;
create policy vendor_notifications_member_read on public.vendor_notifications for select
  to authenticated using (public.is_vendor_member(vendor_id));

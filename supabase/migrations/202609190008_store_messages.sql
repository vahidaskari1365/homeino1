-- =====================================================================
-- Store messages «گفتگوی مشتری و فروشنده» (Task 60 — درخواست مالک)
--
-- «اگر خواستید برای پیام «پیغام جدید» بین مشتری و فروشنده هم چیزی بگذار»
--   • هر سطر = یک پیام در رشتهٔ گفتگوی (فروشگاه، مشتری)
--   • پیام جدید مشتری → اعلان «پیام جدید از مشتری» در صندوق فروشنده
--     (vendor_notifications, kind=customer_message) + مسیر SMS همان مسیر
--     آمادهٔ Task 59 (کاوه‌نگار، فقط env).
--   • read_at سمت گیرنده ثبت می‌شود: شمارش خوانده‌نشدهٔ هر دو طرف صادقانه.
--
-- RLS: مشتری فقط رشتهٔ خودش را می‌خواند؛ عضو فروشنده با is_vendor_member
-- رشته‌های فروشگاه خودش را. همهٔ نوشتن‌ها از سرور (owner bypasses RLS) —
-- authorization در route handlers (requireUser / requireVendorMember).
-- =====================================================================

create table if not exists public.store_messages (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  sender_role varchar(10) not null check (sender_role in ('customer','vendor')),
  body text not null check (length(btrim(body)) between 1 and 2000),
  read_at timestamptz,                      -- null = گیرنده نخوانده
  created_at timestamptz not null default now()
);

comment on table public.store_messages is
  'گفتگوی مشتری و فروشنده (Task 60): پیام مستقیم از صفحهٔ فروشگاه؛ پیام جدید مشتری اعلان+SMS فروشنده می‌سازد.';

create index if not exists store_messages_thread_idx
  on public.store_messages using btree (vendor_id, customer_id, created_at);

-- خوانده‌نشدهٔ سمت فروشنده (badge + شمارش) — partial، سبک و همیشه hot
create index if not exists store_messages_vendor_unread_idx
  on public.store_messages using btree (vendor_id, customer_id)
  where read_at is null and sender_role = 'customer';

-- خوانده‌نشدهٔ سمت مشتری (badge آینده) — partial
create index if not exists store_messages_customer_unread_idx
  on public.store_messages using btree (customer_id, vendor_id)
  where read_at is null and sender_role = 'vendor';

alter table public.store_messages enable row level security;

create policy store_messages_customer_read on public.store_messages for select
  to authenticated using (customer_id = auth.uid());

create policy store_messages_vendor_read on public.store_messages for select
  to authenticated using (public.is_vendor_member(vendor_id));

-- =====================================================================
-- Vendor package «پکیج فروشنده» (Task 58 — درخواست مالک)
--
-- اشتراک ماهانهٔ ۲٬۲۸۰٬۰۰۰ تومان؛ در طول اعتبار، کارمزد مؤثر فروشِ
-- فروشنده از نرخ پایهٔ پلتفرم (۹٪) به ۵٪ کاهش می‌یابد.
--
-- طراحی: نرخ کمیسیون هرگز denormalize نمی‌شود — هنگام accrue هر ردیف
-- صورت‌حساب، «نرخ مؤثر» از روی اشتراکِ فعالِ همان لحظه محاسبه و snapshot
-- می‌شود؛ پس انقضا خودکار است و تاریخچه صادقانه می‌ماند.
--
-- RLS: member-read via is_vendor_member(); ALL writes go through the
-- server (owner role bypasses RLS) — authorization lives in the route
-- handlers (requireVendorMember / requireVendorManager).
-- =====================================================================

-- 0) enum (guarded — CREATE TYPE has no IF NOT EXISTS before PG 16) -----
do $$ begin
  create type public.vendor_subscription_status as enum ('active','cancelled');
exception when duplicate_object then null; end $$;

-- 1) subscriptions ledger — one row per successful package payment ------
create table if not exists public.vendor_subscriptions (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  package_slug varchar(60) not null default 'pro-monthly',
  price_toman integer not null check (price_toman >= 0),
  status vendor_subscription_status not null default 'active',
  provider varchar(40) not null,
  provider_payment_id varchar(120) not null,
  started_at timestamptz not null default now(),
  expires_at timestamptz not null,
  idempotency_key varchar(200) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.vendor_subscriptions is
  'پکیج فروشنده: هر سطر = یک پرداخت موفق. اشتراک فعال = نرخ مؤثر کمیسیون ۵٪ (Task 58).';

create unique index if not exists vendor_subscriptions_idempotency_unique
  on public.vendor_subscriptions using btree (idempotency_key);
create index if not exists vendor_subscriptions_vendor_idx
  on public.vendor_subscriptions using btree (vendor_id, expires_at);

alter table public.vendor_subscriptions enable row level security;
create policy vendor_subscriptions_member_read on public.vendor_subscriptions for select
  to authenticated using (public.is_vendor_member(vendor_id));

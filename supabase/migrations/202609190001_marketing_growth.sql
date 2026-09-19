-- =====================================================================
-- Marketing growth engine (Task 54 — محرک‌های روانی به سبک آمازون/تمو)
-- 1. coupons — campaign codes (percent off credit packages)
-- 2. coupon_redemptions — idempotent per (coupon, payment ref)
-- 3. credit_bonus_grants — expiring welcome gift credits (48h)
-- All three tables are SERVER-ONLY: RLS enabled with no client policies
-- (the app connects as the service/owner role which bypasses RLS).
-- =====================================================================

-- 1) coupons -----------------------------------------------------------
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  description text,
  percent_off integer not null default 0 check (percent_off between 1 and 100),
  pack_slug text,
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  max_redemptions integer,
  max_per_user integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_code_unique unique (code)
);
alter table public.coupons enable row level security;
-- no policies → anon/authenticated are denied; server role bypasses RLS.

-- 2) redemptions -------------------------------------------------------
create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null references public.coupons(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  payment_ref text not null,
  amount_off_irr integer not null default 0,
  created_at timestamptz not null default now(),
  constraint coupon_redemptions_unique unique (coupon_id, payment_ref)
);
create index if not exists coupon_redemptions_user_idx on public.coupon_redemptions (user_id);
create index if not exists coupon_redemptions_coupon_idx on public.coupon_redemptions (coupon_id);
alter table public.coupon_redemptions enable row level security;
-- no policies → server-side only.

-- 3) expiring bonus grants ---------------------------------------------
create table if not exists public.credit_bonus_grants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  transaction_id uuid not null references public.credit_transactions(id) on delete cascade,
  amount integer not null,
  expires_at timestamptz not null,
  expired_at timestamptz,
  expired_amount integer,
  created_at timestamptz not null default now(),
  constraint credit_bonus_grants_tx_unique unique (transaction_id)
);
create index if not exists credit_bonus_grants_open_idx
  on public.credit_bonus_grants (user_id) where expired_at is null;
alter table public.credit_bonus_grants enable row level security;
-- no policies → server-side only.

-- 4) seed the launch campaign (real 72h deadline from migration time) ---
insert into public.coupons (code, description, percent_off, pack_slug, ends_at, max_redemptions, max_per_user, is_active)
select 'LAUNCH20', 'کمپین راه‌اندازی هومینو — ۲۰٪ تخفیف خرید اعتبار', 20, null,
       now() + interval '72 hours', 50, 1, true
where not exists (select 1 from public.coupons where code = 'LAUNCH20');

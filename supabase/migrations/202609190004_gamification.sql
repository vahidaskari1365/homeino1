-- =====================================================================
-- Gamification (Task 56 — فاز ۳: چرخ شانس، استریک، رفرال، نشان‌ها)
-- سبک Temu اما صادقانه: هر جایزه از creditService واقعی می‌آید،
-- شانس‌ها واقعی و در config/promotions.ts منتشرشده است.
-- همهٔ جداول فقط سمت سرور: RLS بدون پالیسی کلاینت.
-- تاریخ‌ها (date) بر اساس Asia/Tehran در لایهٔ اپ محاسبه می‌شوند.
-- =====================================================================

-- چرخ شانس روزانه — یک چرخ در روز (unique pair = سقف روزانه) -------------
create table if not exists public.gamification_spins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  spin_date date not null,
  credits_awarded integer not null default 0 check (credits_awarded >= 0),
  reward_key varchar(40) not null default 'c3',
  created_at timestamptz not null default now()
);
alter table public.gamification_spins enable row level security;
create unique index if not exists gamification_spins_daily_unique
  on public.gamification_spins (user_id, spin_date);

-- ورود روزانه (استریک) ---------------------------------------------------
create table if not exists public.gamification_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  checkin_date date not null,
  streak_after integer not null default 1 check (streak_after >= 1),
  credits_awarded integer not null default 0 check (credits_awarded >= 0),
  created_at timestamptz not null default now()
);
alter table public.gamification_checkins enable row level security;
create unique index if not exists gamification_checkins_daily_unique
  on public.gamification_checkins (user_id, checkin_date);

create table if not exists public.gamification_streaks (
  user_id uuid primary key references public.users(id) on delete cascade,
  current_streak integer not null default 0,
  longest_streak integer not null default 0,
  last_checkin_date date,
  total_checkins integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.gamification_streaks enable row level security;

-- رفرال «بده بگیر» — کد پایدار + ردیف per referee (idempotent) -----------
create table if not exists public.referral_codes (
  user_id uuid primary key references public.users(id) on delete cascade,
  code varchar(16) not null,
  created_at timestamptz not null default now()
);
alter table public.referral_codes enable row level security;
create unique index if not exists referral_codes_code_unique on public.referral_codes (code);

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references public.users(id) on delete cascade,
  referee_user_id uuid not null references public.users(id) on delete cascade,
  code_used varchar(16) not null,
  status varchar(20) not null default 'pending' check (status in ('pending','credited')),
  inviter_credits integer not null default 0,
  invitee_credits integer not null default 0,
  credited_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);
alter table public.referrals enable row level security;
create unique index if not exists referrals_referee_unique on public.referrals (referee_user_id);
create index if not exists referrals_referrer_idx on public.referrals (referrer_user_id, status);

-- نشان‌ها -----------------------------------------------------------------
create table if not exists public.gamification_badges (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  badge_key varchar(40) not null,
  awarded_at timestamptz not null default now()
);
alter table public.gamification_badges enable row level security;
create unique index if not exists gamification_badges_unique on public.gamification_badges (user_id, badge_key);

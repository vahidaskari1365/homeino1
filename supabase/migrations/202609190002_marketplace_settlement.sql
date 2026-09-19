-- =====================================================================
-- Marketplace settlement (Task 55 — مارکت‌پلیس واقعی + تسویه + کمیسیون)
-- 1. vendors.commission_rate_bp — per-vendor commission snapshot source
-- 2. vendor_documents — KYC docs (national id, license, …)
-- 3. vendor_verification_logs — append-only verification audit trail
-- 4. vendor_earnings — per-order-item commission ledger (idempotent)
-- 5. vendor_payouts + vendor_payout_items — payout runs (requested → paid)
--
-- Money is integer Toman; the gateway converts to IRR (×10) at the edge.
-- RLS: member-read via is_vendor_member(); ALL writes go through the
-- server (owner role bypasses RLS) so authorization lives in route
-- handlers (requireVendorMember / requireAdminUser).
-- =====================================================================

-- 0) enums (guarded — CREATE TYPE has no IF NOT EXISTS before PG 16) -----
do $$ begin
  create type public.vendor_document_status as enum ('pending','approved','rejected');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.vendor_verification_action as enum
    ('submitted','approved','rejected','changes_requested','suspended','reactivated');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.vendor_earning_status as enum
    ('pending','available','settling','paid','reversed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.vendor_payout_status as enum ('requested','approved','paid','rejected');
exception when duplicate_object then null; end $$;

-- 1) per-vendor commission rate ---------------------------------------
alter table public.vendors add column if not exists commission_rate_bp integer;
-- NULL → platform default (config/platform.ts vendor.commissionRatePercent).
comment on column public.vendors.commission_rate_bp is
  'Commission in basis points (800 = 8%). NULL = platform default.';

-- 2) vendor KYC documents ----------------------------------------------
create table if not exists public.vendor_documents (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  kind varchar(60) not null,
  file_url text not null,
  file_name varchar(200),
  status vendor_document_status not null default 'pending',
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vendor_documents enable row level security;
create policy vendor_documents_member_read on public.vendor_documents for select
  to authenticated using (public.is_vendor_member(vendor_id));

-- 3) verification audit log --------------------------------------------
create table if not exists public.vendor_verification_logs (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  action vendor_verification_action not null,
  actor_id uuid references public.users(id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);
alter table public.vendor_verification_logs enable row level security;
create policy vendor_verification_logs_member_read on public.vendor_verification_logs for select
  to authenticated using (public.is_vendor_member(vendor_id));

-- 4) earnings ledger (one row per order item — idempotent) --------------
create table if not exists public.vendor_earnings (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  order_item_id uuid not null references public.order_items(id) on delete cascade,
  gross_toman integer not null check (gross_toman >= 0),
  commission_bp integer not null check (commission_bp between 0 and 10000),
  commission_toman integer not null check (commission_toman >= 0),
  net_toman integer not null check (net_toman >= 0),
  status vendor_earning_status not null default 'pending',
  available_at timestamptz,
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vendor_earnings_item_unique unique (order_item_id),
  constraint vendor_earnings_net_consistent check (net_toman = gross_toman - commission_toman)
);
alter table public.vendor_earnings enable row level security;
create policy vendor_earnings_member_read on public.vendor_earnings for select
  to authenticated using (public.is_vendor_member(vendor_id));
create index if not exists vendor_earnings_vendor_status_idx
  on public.vendor_earnings (vendor_id, status);

-- 5) payout runs --------------------------------------------------------
create table if not exists public.vendor_payouts (
  id uuid primary key default gen_random_uuid(),
  vendor_id uuid not null references public.vendors(id) on delete cascade,
  amount_toman integer not null check (amount_toman > 0),
  status vendor_payout_status not null default 'requested',
  method varchar(40) not null default 'manual',
  reference varchar(120),
  requested_by uuid references public.users(id) on delete set null,
  processed_by uuid references public.users(id) on delete set null,
  processed_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.vendor_payouts enable row level security;
create policy vendor_payouts_member_read on public.vendor_payouts for select
  to authenticated using (public.is_vendor_member(vendor_id));
create index if not exists vendor_payouts_vendor_idx
  on public.vendor_payouts (vendor_id, created_at);

create table if not exists public.vendor_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.vendor_payouts(id) on delete cascade,
  earning_id uuid not null references public.vendor_earnings(id) on delete cascade,
  amount_toman integer not null check (amount_toman > 0),
  constraint vendor_payout_items_earning_unique unique (earning_id)
);
alter table public.vendor_payout_items enable row level security;
create policy vendor_payout_items_member_read on public.vendor_payout_items for select
  to authenticated using (public.is_vendor_member(
    (select e.vendor_id from public.vendor_earnings e where e.id = earning_id)
  ));
create index if not exists vendor_payout_items_payout_idx
  on public.vendor_payout_items (payout_id);

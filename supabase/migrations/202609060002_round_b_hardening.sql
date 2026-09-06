-- Round B hardening (10/10 loop)
-- 1) carts: the deployed unique index was (user_id,status) — the 2nd converted
--    cart violated it and crashed checkout. Schema intent is ONE ACTIVE cart
--    per user → partial index.
drop index if exists "carts_active_user_unique";
create unique index "carts_active_user_unique" on "carts" ("user_id") where "status" = 'active';

-- 2) order_status_history.actor_id is uuid but system actors pass strings
--    like "payment:dev" → invalid uuid crash on every payment webhook.
alter table "order_status_history" alter column "actor_id" type text using "actor_id"::text;

-- 3) RLS: reviews insert must never create APPROVED / VERIFIED rows directly.
--    The service layer flips status after verified-purchase checks.
drop policy if exists reviews_insert_self on public.reviews;
create policy reviews_insert_self on public.reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and status = 'pending'
    and verified_purchase = false
  );

-- 4) money: amounts everywhere are TOMAN; the IRR label on orders made the
--    gateway charge 1/10th. Orders keep Toman amounts → label them IRT.
update "orders" set "currency" = 'IRT' where "currency" = 'IRR';

-- 5) shared rate-limit store (works across serverless instances). Clients
--    (anon + authenticated) get NO access — only the service connection.
create table if not exists "rate_limits" (
  "key" text primary key,
  "count" integer not null default 0,
  "window_start" timestamptz not null default now(),
  "updated_at" timestamptz not null default now()
);
alter table "rate_limits" enable row level security;
drop policy if exists rate_limits_no_client on public.rate_limits;
create policy rate_limits_no_client on public.rate_limits for all to anon, authenticated using (false) with check (false);

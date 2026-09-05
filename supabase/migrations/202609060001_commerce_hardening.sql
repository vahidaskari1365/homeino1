-- =====================================================================
-- Commerce & content hardening (round: 10/10 quality loop)
-- 1. pg_trgm + GIN indexes for case-insensitive product search
-- 2. newsletter_subscribers table (real lead capture)
-- 3. seed credit_packages (single server-side price list)
-- 4. seed ai_providers/ai_pricing (credits read from DB, not code)
-- =====================================================================

-- 1) trigram search ----------------------------------------------------
create extension if not exists pg_trgm;
drop index if exists products_title_trgm_idx on public.products;
drop index if exists products_description_trgm_idx on public.products;
drop index if exists products_brand_trgm_idx on public.products;
create index if not exists products_title_trgm_idx on public.products using gin (title gin_trgm_ops);
create index if not exists products_description_trgm_idx on public.products using gin (description gin_trgm_ops);
create index if not exists products_brand_trgm_idx on public.products using gin (brand gin_trgm_ops);

-- 2) newsletter subscribers -------------------------------------------
create table if not exists public.newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text,
  phone text,
  source text not null default 'footer',
  created_at timestamptz not null default now(),
  constraint newsletter_contact_required check (
    (email is not null and email ~* '^[^@]+@[^@]+\.[^@]+$')
    or (phone is not null and phone ~ '^09[0-9]{9}$')
  ),
  constraint newsletter_email_unique unique (email),
  constraint newsletter_phone_unique unique (phone)
);
alter table public.newsletter_subscribers enable row level security;
drop policy if exists newsletter_insert_anon on public.newsletter_subscribers;
create policy newsletter_insert_anon on public.newsletter_subscribers
  for insert to anon, authenticated with check (true);
-- no select/update/delete policies: leads are write-only for clients,
-- readable by the service role (admin) only.

-- 3) credit packages — THE single price list ---------------------------
insert into public.credit_packages (slug, name, credits, price, currency, is_active, sort_order)
values
  ('starter', 'بستهٔ شروع', 50, 1000000, 'IRR', true, 1),
  ('popular', 'بستهٔ محبوب', 120, 2200000, 'IRR', true, 2),
  ('pro', 'بستهٔ حرفه‌ای', 300, 5000000, 'IRR', true, 3)
on conflict (slug) do update
  set credits = excluded.credits,
      price = excluded.price,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = now();

-- 4) ai pricing — DB-backed credit costs -------------------------------
insert into public.ai_providers (id, name, type, is_active, config)
values ('00000000-0000-0000-0000-00000000d001', 'homeino-default', 'LLM', true,
        '{"note":"internal pricing anchor — no key stored"}'::jsonb)
on conflict (id) do nothing;

insert into public.ai_pricing (provider_id, action, unit, price, currency)
values
  ('00000000-0000-0000-0000-00000000d001', 'room-redesign',    'per_generation', 5, 'IRR'),
  ('00000000-0000-0000-0000-00000000d001', 'prompt-to-design', 'per_generation', 5, 'IRR'),
  ('00000000-0000-0000-0000-00000000d001', 'image-edit',       'per_generation', 3, 'IRR'),
  ('00000000-0000-0000-0000-00000000d001', 'product-in-room',  'per_generation', 4, 'IRR'),
  ('00000000-0000-0000-0000-00000000d001', 'decor-suggest',    'per_generation', 6, 'IRR'),
  ('00000000-0000-0000-0000-00000000d001', 'full-concept',     'per_generation', 8, 'IRR')
on conflict do nothing;

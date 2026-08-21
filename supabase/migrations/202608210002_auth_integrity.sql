-- Supabase Auth integration, integrity checks, automatic profile provisioning,
-- immutable credit ledger, and updated_at maintenance.

alter table public.users
  add constraint users_auth_user_fk foreign key (id) references auth.users(id) on delete cascade;
alter table public.categories
  add constraint categories_parent_fk foreign key (parent_id) references public.categories(id) on delete set null;
alter table public.product_styles
  add constraint product_styles_style_slug_fk foreign key (style_slug) references public.styles(slug) on delete cascade;

alter table public.products add constraint products_price_nonnegative check (price >= 0);
alter table public.products add constraint products_compare_price_nonnegative check (compare_at_price is null or compare_at_price >= 0);
alter table public.product_variants add constraint product_variants_price_delta_valid check (price_delta > -2147483648);
alter table public.inventory add constraint inventory_quantities_valid check (quantity >= 0 and reserved_quantity >= 0 and reserved_quantity <= quantity);
alter table public.cart_items add constraint cart_items_quantity_valid check (quantity between 1 and 99);
alter table public.order_items add constraint order_items_quantity_valid check (quantity > 0);
alter table public.reviews add constraint reviews_rating_valid check (rating between 1 and 5);
alter table public.credit_accounts add constraint credit_accounts_balance_nonnegative check (balance >= 0);
alter table public.credit_packages add constraint credit_packages_values_positive check (credits > 0 and price >= 0);
alter table public.credit_usage add constraint credit_usage_credits_positive check (credits > 0);
alter table public.style_colors add constraint style_colors_hex_valid check (hex ~ '^#[0-9A-Fa-f]{6}([0-9A-Fa-f]{2})?$');
alter table public.ai_design_overlays add constraint ai_design_overlays_scale_positive check (scale > 0);
alter table public.ai_generations add constraint ai_generations_duration_nonnegative check (duration_ms is null or duration_ms >= 0);

create unique index if not exists one_default_address_per_user
  on public.user_addresses(user_id) where is_default;
create unique index if not exists one_active_cart_per_user
  on public.carts(user_id) where status = 'active';
create unique index if not exists one_primary_product_image
  on public.product_images(product_id) where is_primary;
create unique index if not exists one_primary_product_category
  on public.product_categories(product_id) where is_primary;

create or replace function public.set_updated_at()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'users','profiles','user_addresses','vendors','vendor_settings','vendor_payout_settings',
    'categories','products','carts','orders','payments','refunds','reviews','collections',
    'inspirations','projects','magazine_articles','ai_designs','ai_providers','ai_models',
    'system_settings','user_preferences','vendor_profiles','styles','ai_design_rooms',
    'ai_design_overlays','ai_conversations','credit_packages'
  ] loop
    execute format('create trigger %I before update on public.%I for each row execute function public.set_updated_at()', 'set_' || t || '_updated_at', t);
  end loop;
end $$;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = '' as $$
begin
  insert into public.users (id, email, phone, role, status, email_verified_at)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@auth.local'),
    new.phone,
    'customer',
    'active',
    new.email_confirmed_at
  ) on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    email_verified_at = excluded.email_verified_at;

  insert into public.profiles (user_id, name)
  values (new.id, nullif(new.raw_user_meta_data ->> 'name', '')) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  insert into public.wishlists (user_id) values (new.id) on conflict do nothing;
  insert into public.carts (user_id, status) values (new.id, 'active') on conflict do nothing;
  insert into public.credit_accounts (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of email, phone, email_confirmed_at, raw_user_meta_data on auth.users
for each row execute function public.handle_new_auth_user();

-- Backfill users that existed in Supabase Auth before this migration.
insert into public.users (id, email, phone, role, status, email_verified_at)
select id, coalesce(email, id::text || '@auth.local'), phone, 'customer', 'active', email_confirmed_at
from auth.users on conflict (id) do nothing;
insert into public.profiles (user_id, name)
select id, nullif(raw_user_meta_data ->> 'name', '') from auth.users on conflict do nothing;
insert into public.user_preferences (user_id) select id from auth.users on conflict do nothing;
insert into public.wishlists (user_id) select id from auth.users on conflict do nothing;
insert into public.carts (user_id, status) select id, 'active' from auth.users on conflict do nothing;
insert into public.credit_accounts (user_id) select id from auth.users on conflict do nothing;

create or replace function public.prevent_credit_transaction_mutation()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'credit_transactions is an immutable ledger';
end;
$$;
create trigger credit_transactions_immutable
before update or delete on public.credit_transactions
for each row execute function public.prevent_credit_transaction_mutation();

create or replace function public.is_vendor_member(target_vendor uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.vendor_members vm
    where vm.vendor_id = target_vendor and vm.user_id = auth.uid()
  );
$$;
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'admin');
$$;

-- Row-level security. Unlisted operations remain denied to anon/authenticated;
-- trusted backend work uses the Supabase service role.

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Public, published marketplace/editorial reads.
drop policy if exists public_read_active_vendors on public.vendors;
drop policy if exists public_read_active_vendors on public.vendors;
create policy public_read_active_vendors on public.vendors for select using (status = 'active');
drop policy if exists public_read_categories on public.categories;
drop policy if exists public_read_categories on public.categories;
create policy public_read_categories on public.categories for select using (is_active);
drop policy if exists public_read_styles on public.styles;
drop policy if exists public_read_styles on public.styles;
create policy public_read_styles on public.styles for select using (is_published);
drop policy if exists public_read_style_features on public.style_features;
create policy public_read_style_features on public.style_features for select using (exists (select 1 from public.styles s where s.id = style_id and s.is_published));
drop policy if exists public_read_style_materials on public.style_materials;
create policy public_read_style_materials on public.style_materials for select using (exists (select 1 from public.styles s where s.id = style_id and s.is_published));
drop policy if exists public_read_style_colors on public.style_colors;
create policy public_read_style_colors on public.style_colors for select using (exists (select 1 from public.styles s where s.id = style_id and s.is_published));
drop policy if exists public_read_active_products on public.products;
drop policy if exists public_read_active_products on public.products;
create policy public_read_active_products on public.products for select using (status in ('active','out_of_stock') and deleted_at is null);
drop policy if exists public_read_product_images on public.product_images;
drop policy if exists public_read_product_images on public.product_images;
create policy public_read_product_images on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
drop policy if exists public_read_product_variants on public.product_variants;
drop policy if exists public_read_product_variants on public.product_variants;
create policy public_read_product_variants on public.product_variants for select using (is_active and exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
drop policy if exists public_read_product_attributes on public.product_attributes;
drop policy if exists public_read_product_attributes on public.product_attributes;
create policy public_read_product_attributes on public.product_attributes for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
drop policy if exists public_read_product_categories on public.product_categories;
drop policy if exists public_read_product_categories on public.product_categories;
create policy public_read_product_categories on public.product_categories for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
drop policy if exists public_read_product_styles on public.product_styles;
drop policy if exists public_read_product_styles on public.product_styles;
create policy public_read_product_styles on public.product_styles for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
drop policy if exists public_read_materials on public.materials;
drop policy if exists public_read_materials on public.materials;
create policy public_read_materials on public.materials for select using (true);
drop policy if exists public_read_product_materials on public.product_materials;
drop policy if exists public_read_product_materials on public.product_materials;
create policy public_read_product_materials on public.product_materials for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
drop policy if exists public_read_inspirations on public.inspirations;
drop policy if exists public_read_inspirations on public.inspirations;
create policy public_read_inspirations on public.inspirations for select using (status = 'published');
drop policy if exists public_read_inspiration_images on public.inspiration_images;
drop policy if exists public_read_inspiration_images on public.inspiration_images;
create policy public_read_inspiration_images on public.inspiration_images for select using (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'));
drop policy if exists public_read_inspiration_styles on public.inspiration_styles;
drop policy if exists public_read_inspiration_styles on public.inspiration_styles;
create policy public_read_inspiration_styles on public.inspiration_styles for select using (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'));
drop policy if exists public_read_inspiration_products on public.inspiration_products;
drop policy if exists public_read_inspiration_products on public.inspiration_products;
create policy public_read_inspiration_products on public.inspiration_products for select using (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'));
drop policy if exists public_read_public_collections on public.collections;
drop policy if exists public_read_public_collections on public.collections;
create policy public_read_public_collections on public.collections for select using (is_public or user_id = auth.uid());
drop policy if exists public_read_collection_products on public.collection_products;
drop policy if exists public_read_collection_products on public.collection_products;
create policy public_read_collection_products on public.collection_products for select using (exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.user_id = auth.uid())));
drop policy if exists public_read_published_projects on public.projects;
drop policy if exists public_read_published_projects on public.projects;
create policy public_read_published_projects on public.projects for select using (status = 'published');
drop policy if exists public_read_published_articles on public.magazine_articles;
drop policy if exists public_read_published_articles on public.magazine_articles;
create policy public_read_published_articles on public.magazine_articles for select using (status = 'published');
drop policy if exists public_read_approved_reviews on public.reviews;
drop policy if exists public_read_approved_reviews on public.reviews;
create policy public_read_approved_reviews on public.reviews for select using (status = 'approved');
drop policy if exists public_read_credit_packages on public.credit_packages;
drop policy if exists public_read_credit_packages on public.credit_packages;
create policy public_read_credit_packages on public.credit_packages for select using (is_active);

-- User-owned root records.
drop policy if exists users_read_self on public.users;
create policy users_read_self on public.users for select to authenticated using (id = auth.uid());
drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated using (user_id = auth.uid());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists preferences_self_all on public.user_preferences;
create policy preferences_self_all on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists addresses_self_all on public.user_addresses;
create policy addresses_self_all on public.user_addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists wishlists_self_all on public.wishlists;
create policy wishlists_self_all on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists wishlist_items_self_all on public.wishlist_items;
create policy wishlist_items_self_all on public.wishlist_items for all to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));
drop policy if exists carts_self_all on public.carts;
create policy carts_self_all on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists cart_items_self_all on public.cart_items;
create policy cart_items_self_all on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
drop policy if exists orders_read_self on public.orders;
create policy orders_read_self on public.orders for select to authenticated using (user_id = auth.uid());
drop policy if exists order_items_read_self on public.order_items;
create policy order_items_read_self on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
drop policy if exists order_history_read_self on public.order_status_history;
create policy order_history_read_self on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
drop policy if exists payments_read_self on public.payments;
create policy payments_read_self on public.payments for select to authenticated using (user_id = auth.uid());
drop policy if exists payment_transactions_read_self on public.payment_transactions;
create policy payment_transactions_read_self on public.payment_transactions for select to authenticated using (exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid()));
drop policy if exists refunds_read_self on public.refunds;
create policy refunds_read_self on public.refunds for select to authenticated using (
  exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid())
  or exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid())
);
drop policy if exists collections_owner_all on public.collections;
create policy collections_owner_all on public.collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists collection_products_owner_all on public.collection_products;
create policy collection_products_owner_all on public.collection_products for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
drop policy if exists reviews_insert_self on public.reviews;
create policy reviews_insert_self on public.reviews for insert to authenticated with check (user_id = auth.uid());
drop policy if exists reviews_update_pending_self on public.reviews;
create policy reviews_update_pending_self on public.reviews for update to authenticated using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid() and status = 'pending');

-- AI data is private to its owner.
drop policy if exists ai_assets_owner_all on public.ai_assets;
create policy ai_assets_owner_all on public.ai_assets for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists ai_designs_owner_all on public.ai_designs;
create policy ai_designs_owner_all on public.ai_designs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_generations_owner_read on public.ai_generations;
create policy ai_generations_owner_read on public.ai_generations for select to authenticated using (user_id = auth.uid());
drop policy if exists ai_generation_inputs_owner_read on public.ai_generation_inputs;
create policy ai_generation_inputs_owner_read on public.ai_generation_inputs for select to authenticated using (exists (select 1 from public.ai_generations g where g.id = generation_id and g.user_id = auth.uid()));
drop policy if exists ai_generation_outputs_owner_read on public.ai_generation_outputs;
create policy ai_generation_outputs_owner_read on public.ai_generation_outputs for select to authenticated using (exists (select 1 from public.ai_generations g where g.id = generation_id and g.user_id = auth.uid()));
drop policy if exists ai_generation_assets_owner_read on public.ai_generation_assets;
create policy ai_generation_assets_owner_read on public.ai_generation_assets for select to authenticated using (owner_id = auth.uid());
drop policy if exists ai_design_rooms_owner_all on public.ai_design_rooms;
create policy ai_design_rooms_owner_all on public.ai_design_rooms for all to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) with check (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
drop policy if exists ai_design_products_owner_all on public.ai_design_products;
create policy ai_design_products_owner_all on public.ai_design_products for all to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) with check (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
drop policy if exists ai_design_overlays_owner_all on public.ai_design_overlays;
create policy ai_design_overlays_owner_all on public.ai_design_overlays for all to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) with check (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
drop policy if exists ai_design_history_owner_read on public.ai_design_history;
create policy ai_design_history_owner_read on public.ai_design_history for select to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
drop policy if exists ai_conversations_owner_all on public.ai_conversations;
create policy ai_conversations_owner_all on public.ai_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists ai_messages_owner_all on public.ai_messages;
create policy ai_messages_owner_all on public.ai_messages for all to authenticated using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())) with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
drop policy if exists ai_usage_owner_read on public.ai_usage_logs;
create policy ai_usage_owner_read on public.ai_usage_logs for select to authenticated using (user_id = auth.uid());
drop policy if exists credit_accounts_owner_read on public.credit_accounts;
create policy credit_accounts_owner_read on public.credit_accounts for select to authenticated using (user_id = auth.uid());
drop policy if exists credit_transactions_owner_read on public.credit_transactions;
create policy credit_transactions_owner_read on public.credit_transactions for select to authenticated using (user_id = auth.uid());
drop policy if exists credit_usage_owner_read on public.credit_usage;
create policy credit_usage_owner_read on public.credit_usage for select to authenticated using (account_user_id = auth.uid());
drop policy if exists notifications_owner_all on public.notifications;
create policy notifications_owner_all on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vendor members control their own storefront rows; product children inherit ownership.
drop policy if exists vendors_member_update on public.vendors;
create policy vendors_member_update on public.vendors for update to authenticated using (public.is_vendor_member(id)) with check (public.is_vendor_member(id));
drop policy if exists vendor_profiles_member_all on public.vendor_profiles;
create policy vendor_profiles_member_all on public.vendor_profiles for all to authenticated using (public.is_vendor_member(vendor_id)) with check (public.is_vendor_member(vendor_id));
drop policy if exists vendor_settings_member_all on public.vendor_settings;
create policy vendor_settings_member_all on public.vendor_settings for all to authenticated using (public.is_vendor_member(vendor_id)) with check (public.is_vendor_member(vendor_id));
drop policy if exists vendor_members_member_read on public.vendor_members;
create policy vendor_members_member_read on public.vendor_members for select to authenticated using (public.is_vendor_member(vendor_id));
drop policy if exists products_vendor_all on public.products;
create policy products_vendor_all on public.products for all to authenticated using (public.is_vendor_member(vendor_id)) with check (public.is_vendor_member(vendor_id));
drop policy if exists product_images_vendor_all on public.product_images;
create policy product_images_vendor_all on public.product_images for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id)));
drop policy if exists product_variants_vendor_all on public.product_variants;
create policy product_variants_vendor_all on public.product_variants for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id)));
drop policy if exists inventory_vendor_all on public.inventory;
create policy inventory_vendor_all on public.inventory for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id)));

-- Storage buckets. Public catalog imagery is readable by everyone; user/AI
-- imagery is private and paths must begin with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('vendor-images','vendor-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('inspiration-images','inspiration-images',true,15728640,array['image/jpeg','image/png','image/webp','image/avif']),
  ('room-images','room-images',false,20971520,array['image/jpeg','image/png','image/webp']),
  ('ai-generations','ai-generations',false,20971520,array['image/jpeg','image/png','image/webp']),
  ('ai-assets','ai-assets',false,20971520,array['image/jpeg','image/png','image/webp','application/json'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_public_catalog_read on storage.objects;
create policy storage_public_catalog_read on storage.objects for select using (bucket_id in ('avatars','product-images','vendor-images','inspiration-images'));
drop policy if exists storage_user_private_read on storage.objects;
create policy storage_user_private_read on storage.objects for select to authenticated using (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists storage_user_private_insert on storage.objects;
create policy storage_user_private_insert on storage.objects for insert to authenticated with check (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists storage_user_private_update on storage.objects;
create policy storage_user_private_update on storage.objects for update to authenticated using (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text) with check ((storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists storage_user_private_delete on storage.objects;
create policy storage_user_private_delete on storage.objects for delete to authenticated using (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists storage_avatar_owner_insert on storage.objects;
create policy storage_avatar_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists storage_avatar_owner_update on storage.objects;
create policy storage_avatar_owner_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check ((storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists storage_avatar_owner_delete on storage.objects;
create policy storage_avatar_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
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
create policy if not exists public_read_active_vendors on public.vendors for select using (status = 'active');
create policy if not exists public_read_categories on public.categories for select using (is_active);
create policy if not exists public_read_styles on public.styles for select using (is_published);
create policy public_read_style_features on public.style_features for select using (exists (select 1 from public.styles s where s.id = style_id and s.is_published));
create policy public_read_style_materials on public.style_materials for select using (exists (select 1 from public.styles s where s.id = style_id and s.is_published));
create policy public_read_style_colors on public.style_colors for select using (exists (select 1 from public.styles s where s.id = style_id and s.is_published));
create policy if not exists public_read_active_products on public.products for select using (status in ('active','out_of_stock') and deleted_at is null);
create policy if not exists public_read_product_images on public.product_images for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
create policy if not exists public_read_product_variants on public.product_variants for select using (is_active and exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
create policy if not exists public_read_product_attributes on public.product_attributes for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
create policy if not exists public_read_product_categories on public.product_categories for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
create policy if not exists public_read_product_styles on public.product_styles for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
create policy if not exists public_read_materials on public.materials for select using (true);
create policy if not exists public_read_product_materials on public.product_materials for select using (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null));
create policy if not exists public_read_inspirations on public.inspirations for select using (status = 'published');
create policy if not exists public_read_inspiration_images on public.inspiration_images for select using (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'));
create policy if not exists public_read_inspiration_styles on public.inspiration_styles for select using (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'));
create policy if not exists public_read_inspiration_products on public.inspiration_products for select using (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'));
create policy if not exists public_read_public_collections on public.collections for select using (is_public or user_id = auth.uid());
create policy if not exists public_read_collection_products on public.collection_products for select using (exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.user_id = auth.uid())));
create policy if not exists public_read_published_projects on public.projects for select using (status = 'published');
create policy if not exists public_read_published_articles on public.magazine_articles for select using (status = 'published');
create policy if not exists public_read_approved_reviews on public.reviews for select using (status = 'approved');
create policy if not exists public_read_credit_packages on public.credit_packages for select using (is_active);

-- User-owned root records.
create policy users_read_self on public.users for select to authenticated using (id = auth.uid());
create policy profiles_read_self on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_update_self on public.profiles for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy preferences_self_all on public.user_preferences for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy addresses_self_all on public.user_addresses for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlists_self_all on public.wishlists for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy wishlist_items_self_all on public.wishlist_items for all to authenticated
  using (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()));
create policy carts_self_all on public.carts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy cart_items_self_all on public.cart_items for all to authenticated
  using (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()));
create policy orders_read_self on public.orders for select to authenticated using (user_id = auth.uid());
create policy order_items_read_self on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy order_history_read_self on public.order_status_history for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy payments_read_self on public.payments for select to authenticated using (user_id = auth.uid());
create policy payment_transactions_read_self on public.payment_transactions for select to authenticated using (exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid()));
create policy refunds_read_self on public.refunds for select to authenticated using (user_id = auth.uid());
create policy collections_owner_all on public.collections for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy collection_products_owner_all on public.collection_products for all to authenticated
  using (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))
  with check (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()));
create policy reviews_insert_self on public.reviews for insert to authenticated with check (user_id = auth.uid());
create policy reviews_update_pending_self on public.reviews for update to authenticated using (user_id = auth.uid() and status = 'pending') with check (user_id = auth.uid() and status = 'pending');

-- AI data is private to its owner.
create policy ai_assets_owner_all on public.ai_assets for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy ai_designs_owner_all on public.ai_designs for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_generations_owner_read on public.ai_generations for select to authenticated using (user_id = auth.uid());
create policy ai_generation_inputs_owner_read on public.ai_generation_inputs for select to authenticated using (exists (select 1 from public.ai_generations g where g.id = generation_id and g.user_id = auth.uid()));
create policy ai_generation_outputs_owner_read on public.ai_generation_outputs for select to authenticated using (exists (select 1 from public.ai_generations g where g.id = generation_id and g.user_id = auth.uid()));
create policy ai_generation_assets_owner_read on public.ai_generation_assets for select to authenticated using (owner_id = auth.uid());
create policy ai_design_rooms_owner_all on public.ai_design_rooms for all to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) with check (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
create policy ai_design_products_owner_all on public.ai_design_products for all to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) with check (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
create policy ai_design_overlays_owner_all on public.ai_design_overlays for all to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) with check (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
create policy ai_design_history_owner_read on public.ai_design_history for select to authenticated using (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()));
create policy ai_conversations_owner_all on public.ai_conversations for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy ai_messages_owner_all on public.ai_messages for all to authenticated using (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())) with check (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()));
create policy ai_usage_owner_read on public.ai_usage_logs for select to authenticated using (user_id = auth.uid());
create policy credit_accounts_owner_read on public.credit_accounts for select to authenticated using (user_id = auth.uid());
create policy credit_transactions_owner_read on public.credit_transactions for select to authenticated using (user_id = auth.uid());
create policy credit_usage_owner_read on public.credit_usage for select to authenticated using (account_user_id = auth.uid());
create policy notifications_owner_all on public.notifications for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Vendor members control their own storefront rows; product children inherit ownership.
create policy vendors_member_update on public.vendors for update to authenticated using (public.is_vendor_member(id)) with check (public.is_vendor_member(id));
create policy vendor_profiles_member_all on public.vendor_profiles for all to authenticated using (public.is_vendor_member(vendor_id)) with check (public.is_vendor_member(vendor_id));
create policy vendor_settings_member_all on public.vendor_settings for all to authenticated using (public.is_vendor_member(vendor_id)) with check (public.is_vendor_member(vendor_id));
create policy vendor_members_member_read on public.vendor_members for select to authenticated using (public.is_vendor_member(vendor_id));
create policy products_vendor_all on public.products for all to authenticated using (public.is_vendor_member(vendor_id)) with check (public.is_vendor_member(vendor_id));
create policy product_images_vendor_all on public.product_images for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id)));
create policy product_variants_vendor_all on public.product_variants for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id)));
create policy inventory_vendor_all on public.inventory for all to authenticated using (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) with check (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id)));

-- Storage buckets. Public catalog imagery is readable by everyone; user/AI
-- imagery is private and paths must begin with the authenticated user's UUID.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('avatars','avatars',true,5242880,array['image/jpeg','image/png','image/webp']),
  ('product-images','product-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('vendor-images','vendor-images',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']),
  ('inspiration-images','inspiration-images',true,15728640,array['image/jpeg','image/png','image/webp','image/avif']),
  ('room-images','room-images',false,20971520,array['image/jpeg','image/png','image/webp']),
  ('ai-generations','ai-generations',false,20971520,array['image/jpeg','imagepng','image/webp']),
  ('ai-assets','ai-assets',false,20971520,array['image/jpeg','imagepng','image/webp','application/json'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy storage_public_catalog_read on storage.objects for select using (bucket_id in ('avatars','product-images','vendor-images','inspiration-images'));
create policy storage_user_private_read on storage.objects for select to authenticated using (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_user_private_insert on storage.objects for insert to authenticated with check (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_user_private_update on storage.objects for update to authenticated using (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text) with check ((storage.foldername(name))[1] = auth.uid()::text);
create policy storage_user_private_delete on storage.objects for delete to authenticated using (bucket_id in ('room-images','ai-generations','ai-assets') and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatar_owner_insert on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatar_owner_update on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text) with check ((storage.foldername(name))[1] = auth.uid()::text);
create policy storage_avatar_owner_delete on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
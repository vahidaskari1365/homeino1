const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  
  const policies = [
    // From section: Public reads
    { name: 'public_read_style_features', sql: "CREATE POLICY public_read_style_features ON public.style_features FOR SELECT USING (exists (select 1 from public.styles s where s.id = style_id and s.is_published))" },
    { name: 'public_read_style_materials', sql: "CREATE POLICY public_read_style_materials ON public.style_materials FOR SELECT USING (exists (select 1 from public.styles s where s.id = style_id and s.is_published))" },
    { name: 'public_read_style_colors', sql: "CREATE POLICY public_read_style_colors ON public.style_colors FOR SELECT USING (exists (select 1 from public.styles s where s.id = style_id and s.is_published))" },
    { name: 'public_read_product_images', sql: "CREATE POLICY public_read_product_images ON public.product_images FOR SELECT USING (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
    { name: 'public_read_product_variants', sql: "CREATE POLICY public_read_product_variants ON public.product_variants FOR SELECT USING (is_active and exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
    { name: 'public_read_product_attributes', sql: "CREATE POLICY public_read_product_attributes ON public.product_attributes FOR SELECT USING (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
    { name: 'public_read_product_categories', sql: "CREATE POLICY public_read_product_categories ON public.product_categories FOR SELECT USING (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
    { name: 'public_read_product_styles', sql: "CREATE POLICY public_read_product_styles ON public.product_styles FOR SELECT USING (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
    { name: 'public_read_materials', sql: "CREATE POLICY public_read_materials ON public.materials FOR SELECT USING (true)" },
    { name: 'public_read_product_materials', sql: "CREATE POLICY public_read_product_materials ON public.product_materials FOR SELECT USING (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
    { name: 'public_read_inspirations', sql: "CREATE POLICY public_read_inspirations ON public.inspirations FOR SELECT USING (status = 'published')" },
    { name: 'public_read_inspiration_images', sql: "CREATE POLICY public_read_inspiration_images ON public.inspiration_images FOR SELECT USING (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'))" },
    { name: 'public_read_inspiration_styles', sql: "CREATE POLICY public_read_inspiration_styles ON public.inspiration_styles FOR SELECT USING (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'))" },
    { name: 'public_read_inspiration_products', sql: "CREATE POLICY public_read_inspiration_products ON public.inspiration_products FOR SELECT USING (exists (select 1 from public.inspirations i where i.id = inspiration_id and i.status = 'published'))" },
    { name: 'public_read_public_collections', sql: "CREATE POLICY public_read_public_collections ON public.collections FOR SELECT USING (is_public or user_id = auth.uid())" },
    { name: 'public_read_collection_products', sql: "CREATE POLICY public_read_collection_products ON public.collection_products FOR SELECT USING (exists (select 1 from public.collections c where c.id = collection_id and (c.is_public or c.user_id = auth.uid()))" },
    { name: 'public_read_published_projects', sql: "CREATE POLICY public_read_published_projects ON public.projects FOR SELECT USING (status = 'published')" },
    { name: 'public_read_published_articles', sql: "CREATE POLICY public_read_published_articles ON public.magazine_articles FOR SELECT USING (status = 'published')" },
    { name: 'public_read_approved_reviews', sql: "CREATE POLICY public_read_approved_reviews ON public.reviews FOR SELECT USING (status = 'approved')" },
    { name: 'public_read_credit_packages', sql: "CREATE POLICY public_read_credit_packages ON public.credit_packages FOR SELECT USING (is_active)" },
    
    // From section: User-owned root records
    { name: 'users_read_self', sql: "CREATE POLICY users_read_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid())" },
    { name: 'profiles_read_self', sql: "CREATE POLICY profiles_read_self ON public.profiles FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'profiles_update_self', sql: "CREATE POLICY profiles_update_self ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'preferences_self_all', sql: "CREATE POLICY preferences_self_all ON public.user_preferences FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'addresses_self_all', sql: "CREATE POLICY addresses_self_all ON public.user_addresses FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'wishlists_self_all', sql: "CREATE POLICY wishlists_self_all ON public.wishlists FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'wishlist_items_self_all', sql: "CREATE POLICY wishlist_items_self_all ON public.wishlist_items FOR ALL TO authenticated USING (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.wishlists w where w.id = wishlist_id and w.user_id = auth.uid()))" },
    { name: 'carts_self_all', sql: "CREATE POLICY carts_self_all ON public.carts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'cart_items_self_all', sql: "CREATE POLICY cart_items_self_all ON public.cart_items FOR ALL TO authenticated USING (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.carts c where c.id = cart_id and c.user_id = auth.uid()))" },
    { name: 'orders_read_self', sql: "CREATE POLICY orders_read_self ON public.orders FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'order_items_read_self', sql: "CREATE POLICY order_items_read_self ON public.order_items FOR SELECT TO authenticated USING (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()))" },
    { name: 'order_history_read_self', sql: "CREATE POLICY order_history_read_self ON public.order_status_history FOR SELECT TO authenticated USING (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()))" },
    { name: 'payments_read_self', sql: "CREATE POLICY payments_read_self ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'payment_transactions_read_self', sql: "CREATE POLICY payment_transactions_read_self ON public.payment_transactions FOR SELECT TO authenticated USING (exists (select 1 from public.payments p where p.id = payment_id and p.user_id = auth.uid()))" },
    { name: 'refunds_read_self', sql: "CREATE POLICY refunds_read_self ON public.refunds FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'collections_owner_all', sql: "CREATE POLICY collections_owner_all ON public.collections FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'collection_products_owner_all', sql: "CREATE POLICY collection_products_owner_all ON public.collection_products FOR ALL TO authenticated USING (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid()))" },
    { name: 'reviews_insert_self', sql: "CREATE POLICY reviews_insert_self ON public.reviews FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid())" },
    { name: 'reviews_update_pending_self', sql: "CREATE POLICY reviews_update_pending_self ON public.reviews FOR UPDATE TO authenticated USING (user_id = auth.uid() and status = 'pending') WITH CHECK (user_id = auth.uid() and status = 'pending')" },
    
    // From section: AI data is private to its owner
    { name: 'ai_assets_owner_all', sql: "CREATE POLICY ai_assets_owner_all ON public.ai_assets FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())" },
    { name: 'ai_designs_owner_all', sql: "CREATE POLICY ai_designs_owner_all ON public.ai_designs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'ai_generations_owner_read', sql: "CREATE POLICY ai_generations_owner_read ON public.ai_generations FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'ai_generation_inputs_owner_read', sql: "CREATE POLICY ai_generation_inputs_owner_read ON public.ai_generation_inputs FOR SELECT TO authenticated USING (exists (select 1 from public.ai_generations g where g.id = generation_id and g.user_id = auth.uid()))" },
    { name: 'ai_generation_outputs_owner_read', sql: "CREATE POLICY ai_generation_outputs_owner_read ON public.ai_generation_outputs FOR SELECT TO authenticated USING (exists (select 1 from public.ai_generations g where g.id = generation_id and g.user_id = auth.uid()))" },
    { name: 'ai_generation_assets_owner_read', sql: "CREATE POLICY ai_generation_assets_owner_read ON public.ai_generation_assets FOR SELECT TO authenticated USING (owner_id = auth.uid())" },
    { name: 'ai_design_rooms_owner_all', sql: "CREATE POLICY ai_design_rooms_owner_all ON public.ai_design_rooms FOR ALL TO authenticated USING (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()))" },
    { name: 'ai_design_products_owner_all', sql: "CREATE POLICY ai_design_products_owner_all ON public.ai_design_products FOR ALL TO authenticated USING (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()))" },
    { name: 'ai_design_overlays_owner_all', sql: "CREATE POLICY ai_design_overlays_owner_all ON public.ai_design_overlays FOR ALL TO authenticated USING (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()))" },
    { name: 'ai_design_history_owner_read', sql: "CREATE POLICY ai_design_history_owner_read ON public.ai_design_history FOR SELECT TO authenticated USING (exists (select 1 from public.ai_designs d where d.id = design_id and d.user_id = auth.uid()))" },
    { name: 'ai_conversations_owner_all', sql: "CREATE POLICY ai_conversations_owner_all ON public.ai_conversations FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    { name: 'ai_messages_owner_all', sql: "CREATE POLICY ai_messages_owner_all ON public.ai_messages FOR ALL TO authenticated USING (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid())) WITH CHECK (exists (select 1 from public.ai_conversations c where c.id = conversation_id and c.user_id = auth.uid()))" },
    { name: 'ai_usage_owner_read', sql: "CREATE POLICY ai_usage_owner_read ON public.ai_usage_logs FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'credit_accounts_owner_read', sql: "CREATE POLICY credit_accounts_owner_read ON public.credit_accounts FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'credit_transactions_owner_read', sql: "CREATE POLICY credit_transactions_owner_read ON public.credit_transactions FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { name: 'credit_usage_owner_read', sql: "CREATE POLICY credit_usage_owner_read ON public.credit_usage FOR SELECT TO authenticated USING (account_user_id = auth.uid())" },
    { name: 'notifications_owner_all', sql: "CREATE POLICY notifications_owner_all ON public.notifications FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())" },
    
    // From section: Vendor members
    { name: 'vendors_member_update', sql: "CREATE POLICY vendors_member_update ON public.vendors FOR UPDATE TO authenticated USING (public.is_vendor_member(id)) WITH CHECK (public.is_vendor_member(id))" },
    { name: 'vendor_profiles_member_all', sql: "CREATE POLICY vendor_profiles_member_all ON public.vendor_profiles FOR ALL TO authenticated USING (public.is_vendor_member(vendor_id)) WITH CHECK (public.is_vendor_member(vendor_id))" },
    { name: 'vendor_settings_member_all', sql: "CREATE POLICY vendor_settings_member_all ON public.vendor_settings FOR ALL TO authenticated USING (public.is_vendor_member(vendor_id)) WITH CHECK (public.is_vendor_member(vendor_id))" },
    { name: 'vendor_members_member_read', sql: "CREATE POLICY vendor_members_member_read ON public.vendor_members FOR SELECT TO authenticated USING (public.is_vendor_member(vendor_id))" },
    { name: 'products_vendor_all', sql: "CREATE POLICY products_vendor_all ON public.products FOR ALL TO authenticated USING (public.is_vendor_member(vendor_id)) WITH CHECK (public.is_vendor_member(vendor_id))" },
    { name: 'product_images_vendor_all', sql: "CREATE POLICY product_images_vendor_all ON public.product_images FOR ALL TO authenticated USING (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) WITH CHECK (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))" },
    { name: 'product_variants_vendor_all', sql: "CREATE POLICY product_variants_vendor_all ON public.product_variants FOR ALL TO authenticated USING (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) WITH CHECK (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))" },
    { name: 'inventory_vendor_all', sql: "CREATE POLICY inventory_vendor_all ON public.inventory FOR ALL TO authenticated USING (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))) WITH CHECK (exists (select 1 from public.products p where p.id = product_id and public.is_vendor_member(p.vendor_id))" },
  ];
  
  for (const pol of policies) {
    try {
      await c.query(pol.sql);
      console.log(`OK: ${pol.name}`);
    } catch (e) {
      console.log(`FAIL: ${pol.name} - ${e.message}`);
    }
  }
  
  await c.query('ROLLBACK');
  await c.end();
}

main();
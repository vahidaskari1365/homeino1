-- =====================================================================
-- Credit pack «mini» (Task 58 — درخواست مالک)
-- بستهٔ ورود ۲۲٬۵۰۰ تومانی (۱۰ اعتبار = ۲ طراحی کامل استودیو).
--
-- قرارداد قیمت: credit_packages تنها منبع حقیقت است (IRR ×۱۰ تومان)؛
-- PACKS در /api/credits/purchase و CREDIT_CONFIG.buyPackages آینهٔ همین
-- سطرند. Upsert idempotent — اجرای مجدد مهاجرت امن است.
-- =====================================================================

insert into public.credit_packages (slug, name, credits, price, currency, is_active, sort_order)
values ('mini', 'بستهٔ شروع سبک', 10, 225000, 'IRR', true, 0)
on conflict (slug) do update
  set credits = excluded.credits,
      price = excluded.price,
      is_active = excluded.is_active,
      sort_order = excluded.sort_order,
      updated_at = now();

-- Idempotent development/catalog seed. Uses stable UUIDs and live Pexels CDN
-- assets already used by the Homeino frontend.

insert into public.categories (id, slug, name, name_en, description, icon, image, sort_order, depth, path, is_active) values
('10000000-0000-4000-8000-000000000001','furniture','مبلمان','Furniture','مبل، کاناپه، صندلی و میز برای خانه','Sofa','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800',1,0,'/',true),
('10000000-0000-4000-8000-000000000002','decor','دکوراسیون','Decor','اکسسوری و دکور برای روح بخشیدن به فضا','Frame','https://images.pexels.com/photos/38908537/pexels-photo-38908537.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900',2,0,'/',true),
('10000000-0000-4000-8000-000000000003','lighting','نورپردازی','Lighting','چراغ و نورهای دکوراتیو','Lamp','https://images.pexels.com/photos/38986381/pexels-photo-38986381.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900',3,0,'/',true),
('10000000-0000-4000-8000-000000000011','sofa','کاناپه','Sofa',null,'Sofa',null,1,1,'/10000000-0000-4000-8000-000000000001/',true),
('10000000-0000-4000-8000-000000000012','vase','گلدان','Vase',null,'Flower2',null,1,1,'/10000000-0000-4000-8000-000000000002/',true),
('10000000-0000-4000-8000-000000000013','table-lamp','چراغ رومیزی','Table lamp',null,'LampDesk',null,1,1,'/10000000-0000-4000-8000-000000000003/',true)
on conflict (id) do update set name=excluded.name, image=excluded.image, is_active=excluded.is_active;
update public.categories set parent_id='10000000-0000-4000-8000-000000000001' where id='10000000-0000-4000-8000-000000000011';
update public.categories set parent_id='10000000-0000-4000-8000-000000000002' where id='10000000-0000-4000-8000-000000000012';
update public.categories set parent_id='10000000-0000-4000-8000-000000000003' where id='10000000-0000-4000-8000-000000000013';

insert into public.styles (id,slug,name,name_en,tagline,short_description,description,image,image_alt,suitable_rooms,is_published) values
('20000000-0000-4000-8000-000000000001','modern','مدرن','Modern','خطوط تمیز، فرم‌هایsimple',null,'سبک مدرن بر عملکرد، خطوط روشن و حذف تزئینات غیرضروری تکیه دارد.','https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','نشیمن مدرن', '["نشاءن","فضای کار"]'::jsonb,true),
('20000000-0000-4000-8000-000000000002','minimal','مینیمال','Minimal','کمتر، اما بهتر','فضایی سنجیده و آرام','مینیمالیسم انتخاب آگاهانه، ذخیره‌سازی پنهان و کیفیت اجرای جزئیات است.','https://images.pexels.com/photos/12277220/pexels-photo-12277220.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','فضای مینیمال روشن','["اتاق خواب","فضای کار"]'::jsonb,true),
('20000000-0000-4000-8000-000000000003','scandinavian','اسکاندیناوی','Scandinavian','سادگی روشن و گرمای طبیعی','چوب روشن، نور و بافت نرم','اسکاندیناوی سادگی کاربردی را با گرمای طبیعی و حس خانگی همراه می‌کند.','https://images.pexels.com/photos/20390760/pexels-photo-20390760.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','فضای اسکاندیناوی','["نشاءن","اتاق خواب"]'::jsonb,true)
on conflict (id) do update set name=excluded.name,image=excluded.image,is_published=true;
insert into public.style_features (style_id,feature,position) values
('20000000-0000-4000-8000-000000000001','خطوط مستقیم و هندسی',1),
('20000000-0000-4000-8000-000000000002','فضای خالی هدفمند',1),
('20000000-0000-4000-8000-000000000003','نور طبیعی و چوب روشن',1)
on conflict do nothing;
insert into public.style_colors (id,style_id,name,hex,position) values
('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','ذغالی','#303332',1),
('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','سفید شیری','#F7F4EC',1),
('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','بژ روشن','#DDD3C3',1)
on conflict (id) do nothing;

insert into public.vendors (id,name,slug,logo,cover,description,status,verification_status,rating,reviews_count,sales_count,followers_count,since_year,city,badges,shipping_policy,return_policy,response_time) values
('30000000-0000-4000-8000-000000000001','نور مبلمان','noor-mobl','ن','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','طراحی و تولید مبلمان مدرن','active','verified',4.80,1240,3840,5210,1398,'تهران','["پرفروش","ارسال سریع"]'::jsonb,'ارسال به سراسر کشور','۷ روز بازگشت','زیر ۲ ساعت'),
('30000000-0000-4000-8000-000000000002','چاپان دکور','chapan-decor','چ','https://images.pexels.com/photos/38908537/pexels-photo-38908537.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','اکسسوری مینیمال و دست‌ساز','active','verified',4.70,632,1180,2140,1401,'اصفهان','["بسته‌بندی امن"]'::jsonb,'ارسال ایمن','۷ روز بازگشت','زیر ۶ ساعت'),
('30000000-0000-4000-8000-000000000003','لوامینا','lumina-light','ل','https://images.pexels.com/photos/38986381/pexels-photo-38986381.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','نورپردازی دکوراتیو','active','verified',4.90,988,2960,3980,1397,'تهران','["گارانتی اصالت"]'::jsonb,'ارسال بیمه‌شده','۷ روز بازگشت','زیر ۳ ساعت')
on conflict (id) do update set name=excluded.name,status='active',verification_status='verified';
insert into public.vendor_profiles (vendor_id,legal_name,fulfilled_orders,response_rate) values
('30000000-0000-4000-8000-000000000001','نور مبلمان',3840,96),
('30000000-0000-4000-8000-000000000002','چاپان دکور',1180,92),
('30000000-0000-4000-8000-000000000003','لوامینا',2960,98)
on conflict (vendor_id) do nothing;
insert into public.vendor_settings (vendor_id,currency,dispatch_time,shipping_coverage) values
('30000000-0000-4000-8000-000000000001','IRR','۳ تا ۷ روز','سراسر ایران'),
('30000000-0000-4000-8000-000000000002','IRR','۲ تا ۵ روز','سراسر ایران'),
('30000000-0000-4000-8000-000000000003','IRR','۱ تا ۳ روز','سراسر ایران')
on conflict (vendor_id) do nothing;

insert into public.products (id,vendor_id,title,slug,description,short_description,price,compare_at_price,currency,brand,sku,material,color,status,style_slugs,tags,rating,reviews_count,sales_count,published_at) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','کاناپه هلیم ۳ نفره','sofa-helia','کاناپه راحت با پارچه مقاوم و پایه چوبی','کاناپه مدرن سه نفره',48500000,62000000,'IRR','نور مبلمان','NM-HL-3','چوب و پارچه','کرم','active','["modern","scandinavian"]'::jsonb,'["پرفروش","مبلمان"]'::jsonb,48,142,443,now()),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','گلدان سرامیکی دست‌ساز','ceramic-vase','گلدان سرامیکی با لعاب مات','اکسسوری دست‌ساز',1850000,null,'IRR','چاپان دکور','CD-VS-1','سرامیک','کرم','active','["minimal"]'::jsonb,'["دست‌ساز","دکور"]'::jsonb,47,58,210,now()),
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','چراغ رومیزی آوا','table-lamp-ava','چراغ رومیزی با نور گرم و بدنه فلزی','نور گرم برای فضای دن',4200000,null,'IRR','لوامینا','LL-AVA-1','فلز','طلایی','active','["modern","minimal"]'::jsonb,'["نور","رومیزی"]'::jsonb,49,81,305,now())
on conflict (id) do update set title=excluded.title,price=excluded.price,status='active';
insert into public.product_images (id,product_id,url,alt,position,is_primary) values
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','کاناپه هلیم',0,true),
('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','https://images.pexels.com/photos/38908537/pexels-photo-38908537.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','گلدان سرامیکی',0,true),
('41000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','https://images.pexels.com/photos/38986381/pexels-photo-38986381.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','چراغ رومیزی',0,true)
on conflict (id) do nothing;
insert into public.product_categories (product_id,category_id,is_primary) values
('40000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000011',true),
('40000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000012',true),
('40000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000013',true)
on conflict do nothing;
insert into public.product_styles (product_id,style_slug) values
('40000000-0000-4000-8000-000000000001','modern'),('40000000-0000-4000-8000-000000000001','scandinavian'),
('40000000-0000-4000-8000-000000000002','minimal'),('40000000-0000-4000-8000-000000000003','modern')
on conflict do nothing;
insert into public.inventory (id,product_id,quantity,reserved_quantity) values
('42000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',12,0),
('42000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002',30,0),
('42000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003',24,0)
on conflict (id) do update set quantity=excluded.quantity;

insert into public.inspirations (id,slug,title,image,style_slug,room,tags,description,product_ids,status,created_at) values
('50000000-0000-4000-8000-000000000001','warm-earthy-living','پذیرایی گرم و خاکی','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','modern','پذیرایی','["گرم","خاکی","نور"]'::jsonb,'پالت گرم برای یک نشیمن آرام','["40000000-0000-4000-8000-000000000001"]'::jsonb,'published',now()),
('50000000-0000-4000-8000-000000000002','minimal-study','گوشه مطالعه مینیمال','https://images.pexels.com/photos/38986383/pexels-photo-38986383.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','minimal','فضای کار','["مطالعه","نور"]'::jsonb,'فضایی ساده برای تمرکز','["40000000-0000-4000-8000-000000000003"]'::jsonb,'published',now()),
('50000000-0000-4000-8000-000000000003','scandinavian-calm','آرامش اسکاندیناوی','https://images.pexels.com/photos/2082093/pexels-photo-2082093.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','scandinavian','اتاق خواب','["آرام","چوب"]'::jsonb,'بافت طبیعی و نور نرم','[]'::jsonb,'published',now())
on conflict (id) do update set title=excluded.title,status='published';
insert into public.inspiration_images (id,inspiration_id,url,alt,position) values
('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','پذیرایی گرم و خاکی',0),
('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','https://images.pexels.com/photos/38986383/pexels-photo-38986383.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','گوشه مطالعه مینیمال',0),
('51000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','https://images.pexels.com/photos/2082093/pexels-photo-2082093.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','آرامش اسکاندیناوی',0)
on conflict (id) do nothing;
insert into public.inspiration_styles (inspiration_id,style_id) values
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002'),
('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003') on conflict do nothing;
insert into public.inspiration_products (inspiration_id,product_id,position) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',0),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',0) on conflict do nothing;

insert into public.collections (id,user_id,slug,title,subtitle,image,description,is_public) values
('60000000-0000-4000-8000-000000000001',null,'warm-living','نشیمن گرم','انتخاب‌های خاکی و آرام','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','مجموعه منتخب هومینو',true),
('60000000-0000-4000-8000-000000000002',null,'minimal-home','خانه مینیمال','سادگی کاربردی','https://images.pexels.com/photos/12277220/pexels-photo-12277220.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','مجموعه منتخب هومینو',true)
on conflict (id) do update set title=excluded.title,is_public=true;
insert into public.collection_products (collection_id,product_id) values
('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'),
('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003'),
('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002') on conflict do nothing;
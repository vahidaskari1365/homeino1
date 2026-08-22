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
('20000000-0000-4000-8000-000000000001','modern','مدرن','Modern','Lines clean, simple forms and efficiency',null,'Modern style focusing on functionality, clean lines and removal of unnecessary ornamentation.','https://images.pexels.com/photos/1571460/pexels-photo-1571460.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Modern living', '["Living Room","Home Office"]'::jsonb,true),
('20000000-0000-4000-8000-000000000002','minimal','مینیمال','Minimal','Less is more, but better',null,'Minimalism conscious choice, hidden storage and quality execution of detail.','https://images.pexels.com/photos/12277220/pexels-photo-12277220.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Bright minimalist living', '["Bedroom","Home Office"]'::jsonb,true),
('20000000-0000-4000-8000-000000000003','scandinavian','اسکاندیناوی','Scandinavian','Light wood and natural warmth',null,'Scandinavian practical simplicity accompanied by natural warmth and feeling of home.','https://images.pexels.com/photos/20390760/pexels-photo-20390760.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Scandinavian living', '["Bedroom"]'::jsonb,true)
on conflict (id) do update set name=excluded.name,image=excluded.image,is_published=true;
insert into public.style_features (style_id,feature,position) values
('20000000-0000-4000-8000-000000000001','Direct lines and geometry',1),
('20000000-0000-4000-8000-000000000002','Targeted empty space',1),
('20000000-0000-4000-8000-000000000003','Natural light and light wood',1)
on conflict do nothing;
insert into public.style_colors (id,style_id,name,hex,position) values
('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','Charcoal','#303332',1),
('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002','Off-white','#F7F4EC',1),
('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003','Light beige','#DDD3C3',1)
on conflict (id) do nothing;

insert into public.vendors (id,name,slug,logo,cover,description,status,verification_status,rating,reviews_count,sales_count,followers_count,since_year,city,badges,shipping_policy,return_policy,response_time) values
('30000000-0000-4000-8000-000000000001','Noor Mobil','noor-mobl','N','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Design and production of modern furniture','active','verified',4.80,1240,3840,5210,1398,'Tehran',['Best Seller','Fast delivery']::jsonb,'Shipping across the country','7 day return','Under 2 hours'),
('30000000-0000-4000-8000-000000000002','Chapan Decor','chapan-decor','چ','https://images.pexels.com/photos/38908537/pexels-photo-38908537.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','Minimalist and handmade accessories','active','verified',4.70,632,1180,2140,1401,'Isfahan',['Secure packaging']::jsonb,'Safe delivery','7 day return','Under 6 hours'),
('30000000-0000-4000-8000-000000000003','Lumina Light','lumina-light','ل','https://images.pexels.com/photos/38986381/pexels-photo-38986381.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','Decorative lighting','active','verified',4.90,988,2960,3980,1397,'Tehran',['Authenticity guarantee']::jsonb,'Insured delivery','7 day return','Under 3 hours')
on conflict (id) do update set name=excluded.name,status='active',verification_status='verified';
insert into public.vendor_profiles (vendor_id,legal_name,fulfilled_orders,response_rate) values
('30000000-0000-4000-8000-000000000001','Noor Mobil',3840,96),
('30000000-0000-4000-8000-000000000002','Chapan Decor',1180,92),
('30000000-0000-4000-8000-000000000003','Lumina Light',2960,98)
on conflict (vendor_id) do nothing;
insert into public.vendor_settings (vendor_id,currency,dispatch_time,shipping_coverage) values
('30000000-0000-4000-8000-000000000001','IRR','3 to 7 days','All over Iran'),
('30000000-0000-4000-8000-000000000002','IRR','2 to 5 days','All over Iran'),
('30000000-0000-4000-8000-000000000003','IRR','1 to 3 days','All over Iran')
on conflict (vendor_id) do nothing;

insert into public.products (id,vendor_id,title,slug,description,short_description,price,compare_at_price,currency,brand,sku,material,color,status,style_slugs,tags,rating,reviews_count,sales_count,published_at) values
('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','3-Seater Leather Sofa','sofa-helia','Comfortable sofa with leather cover and wooden base','Modern three-seater sofa',48500000,62000000,'IRR','Noor Mobil','NM-HL-3','Wood and leather','Beige','active',['modern','scandinavian']::jsonb,['Best Seller','Furniture']::jsonb,48,142,443,now()),
('40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000002','Handmade Ceramic Vase','ceramic-vase','Handmade ceramic with mat glaze','Handmade accessory',1850000,null,'IRR','Chapan Decor','CD-VS-1','Ceramic','Beige','active',['minimal']::jsonb,['Handmade','Decor']::jsonb,47,58,210,now()),
('40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000003','Modern Table Lamp','table-lamp-ava','Table lamp with warm light and metal body','Warm light for dining space',4200000,null,'IRR','Lumina Light','LL-AVA-1','Metal','Gold','active',['modern','minimal']::jsonb,['Light','Room']::jsonb,49,81,305,now())
on conflict (id) do update set title=excluded.title,price=excluded.price,status='active';
insert into public.product_images (id,product_id,url,alt,position,is_primary) values
('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','3-Seater Leather Sofa',0,true),
('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','https://images.pexels.com/photos/38908537/pexels-photo-38908537.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','Handmade Ceramic Vase',0,true),
('41000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','https://images.pexels.com/photos/38986381/pexels-photo-38986381.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','Modern Table Lamp',0,true)
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
('50000000-0000-4000-8000-000000000001','warm-earthy-living','Warm and earthy living','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','modern','Living area',['Warm','Earthy','Light']::jsonb,['40000000-0000-4000-8000-000000000001']::jsonb,'published',now()),
('50000000-0000-4000-8000-000000000002','minimal-study','Minimalist study space','https://images.pexels.com/photos/38986383/pexels-photo-38986383.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','minimal','Study area',['Study','Light']::jsonb,['40000000-0000-4000-8000-000000000003']::jsonb,'published',now()),
('50000000-0000-4000-8000-000000000003','scandinavian-calm','Scandinavian calm','https://images.pexels.com/photos/2082093/pexels-photo-2082093.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','scandinavian','Bedroom',['Calm','Wood']::jsonb,'[]'::jsonb,'published',now())
on conflict (id) do update set title=excluded.title,status='published';
insert into public.inspiration_images (id,inspiration_id,url,alt,position) values
('51000000-0000-4000-8000-000000000001','50000000-0000-4000-8000-000000000001','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Warm and earthy living',0),
('51000000-0000-4000-8000-000000000002','50000000-0000-4000-8000-000000000002','https://images.pexels.com/photos/38986383/pexels-photo-38986383.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=900&h=900','Minimalist study space',0),
('51000000-0000-4000-8000-000000000003','50000000-0000-4000-8000-000000000003','https://images.pexels.com/photos/2082093/pexels-photo-2082093.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Scandinavian calm',0)
on conflict (id) do nothing;
insert into public.inspiration_styles (inspiration_id,style_id) values
('50000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001'),
('50000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000002'),
('50000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000003') on conflict do nothing;
insert into public.inspiration_products (inspiration_id,product_id,position) values
('50000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001',0),
('50000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000003',0) on conflict do nothing;

insert into public.collections (id,user_id,slug,title,subtitle,image,description,is_public) values
('60000000-0000-4000-8000-000000000001',null,'warm-living','Warm living','Selection of earthy and calm','https://images.pexels.com/photos/8089172/pexels-photo-8089172.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Homeino selected collection',true),
('60000000-0000-4000-8000-000000000002',null,'minimal-home','Minimal home','Practical simplicity','https://images.pexels.com/photos/12277220/pexels-photo-12277220.jpeg?auto=compress&cs=tinysrgb&fit=crop&w=1200&h=800','Homeino selected collection',true)
on conflict (id) do update set title=excluded.title,is_public=true;
insert into public.collection_products (collection_id,product_id) values
('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001'),
('60000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000003'),
('60000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002') on conflict do nothing;
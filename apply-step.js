const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  
  // Get all tables
  const tables = await c.query("select tablename from pg_tables where schemaname = 'public'");
  const tableNames = tables.rows.map(r => r.tablename);
  console.log('Tables to enable RLS on:', tableNames.length);
  
  // Enable RLS on each table
  for (const table of tableNames) {
    try {
      await c.query(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      // console.log(`Enabled RLS on ${table}`);
    } catch (e) {
      console.log(`Error enabling RLS on ${table}:`, e.message);
    }
  }
  
  // Create key policies
  const policies = [
    { table: 'vendors', pol: 'public_read_active_vendors', sql: "FOR SELECT USING (status = 'active')" },
    { table: 'categories', pol: 'public_read_categories', sql: "FOR SELECT USING (is_active)" },
    { table: 'users', pol: 'users_read_self', sql: "FOR SELECT TO authenticated USING (id = auth.uid())" },
    { table: 'profiles', pol: 'profiles_read_self', sql: "FOR SELECT TO authenticated USING (user_id = auth.uid())" },
    { table: 'styles', pol: 'public_read_styles', sql: "FOR SELECT USING (is_published)" },
    { table: 'product_images', pol: 'public_read_product_images', sql: "FOR SELECT USING (exists (select 1 from public.products p where p.id = product_id and p.status in ('active','out_of_stock') and p.deleted_at is null))" },
  ];
  
  for (const pol of policies) {
    try {
      await c.query(`CREATE POLICY ${pol.pol} ON public.${pol.table} ${pol.sql}`);
      console.log(`Created policy ${pol.pol} on ${pol.table}`);
    } catch (e) {
      console.log(`Error creating policy ${pol.pol} on ${pol.table}:`, e.message);
    }
  }
  
  await c.query('COMMIT');
  console.log('Success');
  await c.end();
}

main();
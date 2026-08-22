const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  
  // Try creating policy with IF NOT EXISTS
  try {
    await c.query("CREATE POLICY IF NOT EXISTS public_read_active_vendors on public.vendors for select using (status = 'active')");
    console.log('Success');
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await c.end();
}

main();
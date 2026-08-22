const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  
  // Drop existing policy
  await c.query('DROP POLICY IF EXISTS users_read_self ON public.users');
  console.log('Dropped users_read_self policy');
  
  // Try creating it again
  await c.query("CREATE POLICY users_read_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid())");
  console.log('Created users_read_self policy');
  
  await c.end();
}

main();
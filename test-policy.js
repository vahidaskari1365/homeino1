const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  
  // Try creating a policy with IF NOT EXISTS
  try {
    await c.query("CREATE POLICY IF NOT EXISTS test_policy ON public.users FOR SELECT TO authenticated USING (id = auth.uid())");
    console.log('Policy created successfully');
  } catch (e) {
    console.log('Error:', e.message);
  }
  
  await c.query('ROLLBACK');
  await c.end();
}

main();
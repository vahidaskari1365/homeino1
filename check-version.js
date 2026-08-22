const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  
  // Check PostgreSQL version
  const r = await c.query('SELECT version()');
  console.log('PostgreSQL version:', r.rows[0].version);
  
  // Try creating policy with IF NOT EXISTS
  try {
    await c.query("CREATE POLICY IF NOT EXISTS users_read_self ON public.users FOR SELECT TO authenticated USING (id = auth.uid())");
    console.log('CREATE POLICY IF NOT EXISTS succeeded');
  } catch (e) {
    console.log('CREATE POLICY IF NOT EXISTS error:', e.message);
  }
  
  await c.end();
}

main();
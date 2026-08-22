const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  
  // Check all policies
  try {
    const r = await c.query("SELECT polname, polrelid::regclass as table_name FROM pg_policy");
    console.log('All policies:', r.rows.map(x => ({ table: x.table_name, pol: x.polname })));
  } catch(e) { console.log('Error:', e.message); }
  
  await c.end();
}

main();
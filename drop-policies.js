const { Client } = require('pg');

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  
  // Get all policies
  const r = await c.query("SELECT polname, polrelid::regclass as table_name FROM pg_policy");
  console.log('Found policies:', r.rows.length);
  
  // Drop each policy
  for (const row of r.rows) {
    const polName = row.polname;
    const tableName = row.table_name;
    try {
      await c.query(`DROP POLICY IF EXISTS ${polName} ON public.${tableName}`);
      console.log(`Dropped policy ${polName} on ${tableName}`);
    } catch (e) {
      console.log(`Error dropping policy ${polName}:`, e.message);
    }
  }
  
  await c.end();
}

main();
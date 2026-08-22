const { Client } = require('pg');
const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });
c.connect().then(() => {
  console.log('Connected successfully');
  return c.query('SELECT 1 as test');
}).then(r => {
  console.log('Query result:', r.rows);
  return c.query('select table_name from information_schema.tables where table_schema = current_schema()');
}).then(r2 => {
  console.log('Tables:', r2.rows.map(x => x.table_name));
  return c.query("select * from pg_tables where schemaname = 'public'");
}).then(r3 => {
  console.log('Tables (pg_tables):', r3.rows.map(x => x.tablename));
  return c.query('select * from public.schema_migrations');
}).then(r4 => {
  console.log('Migrations:', r4.rows.map(x => x.filename));
  c.end();
}).catch(e => {
  console.log('Error message:', e.message);
  console.log('Error code:', e.code);
  c.end().catch(() => {});
});
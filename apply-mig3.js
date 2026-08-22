const { Client } = require('pg');
const path = require('path');
const { readFile } = require('fs').promises;

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  
  const migrationPath = path.resolve('supabase/migrations/202608210003_rls_storage.sql');
  const sql = await readFile(migrationPath, 'utf8');
  
  try {
    await c.query(sql);
    await c.query('COMMIT');
    console.log('Migration 3 applied successfully');
  } catch (e) {
    await c.query('ROLLBACK');
    console.log('Error:', e.message);
    // Print line number if available
    if (e.position) console.log('Position:', e.position);
  }
  
  await c.end();
}

main();
const { Client } = require('pg');
const path = require('path');
const { readFile } = require('fs').promises;

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  
  const migrationPath = path.resolve('supabase/migrations/202608210003_rls_storage.sql');
  const sql = await readFile(migrationPath, 'utf8');
  
  // The migration SQL uses dollar-quoted strings ($$...$$) and contains
  // semicolons inside them. We need to handle this carefully.
  
  // Let's try running the entire SQL as a single statement first
  try {
    await c.query(sql);
    await c.query('COMMIT');
    console.log('Migration 3 applied successfully (entire SQL as single statement)');
    await c.end();
    return;
  } catch (e) {
    console.log('Error running entire SQL:', e.message);
    await c.query('ROLLBACK');
  }
  
  // If that fails, try splitting by "*/" to separate sections
  // Actually, let's just try running key statements
  
  await c.end();
}

main().catch(e => {
  console.log('Fatal error:', e.message);
  c.query('ROLLBACK').then(() => c.end());
});
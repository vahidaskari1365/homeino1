const { Client } = require('pg');
const path = require('path');
const { readFile } = require('fs').promises;

const c = new Client({ connectionString: 'postgres://postgres.agriyxnnleeltidvglma:Vahid%400142!%40%23@aws-1-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=disable', ssl: { rejectUnauthorized: false } });

async function main() {
  await c.connect();
  await c.query('BEGIN');
  
  const migrationPath = path.resolve('supabase/migrations/202608210003_rls_storage.sql');
  const sql = await readFile(migrationPath, 'utf8');
  
  // Get all create policy statements
  const afterRls = sql.split('-- User-owned')[1] || '';
  const policiesSection = afterRls ? afterRls.split('-- AI data')[0] : '';
  const policyStatements = policiesSection.split(';').filter(s => s.trim().startsWith('create policy'));
  
  console.log('Total create policy statements:', policyStatements.length);
  
  for (let i = 0; i < policyStatements.length; i++) {
    try {
      await c.query(policyStatements[i]);
      console.log(`Policy ${i+1} OK: ${policyStatements[i].substring(0, 50)}...`);
    } catch (e) {
      console.log(`Policy ${i+1} FAIL: ${e.message.substring(0, 80)}...`);
      console.log('  SQL:', policyStatements[i].substring(0, 200));
    }
  }
  
  await c.query('ROLLBACK');
  await c.end();
}

main().catch(e => { console.log('Fatal:', e.message); c.query('ROLLBACK').then(() => c.end()); });
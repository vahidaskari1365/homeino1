const { Client } = require('pg');
const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
c.connect().then(() => c.query("select count(*) as n from pg_tables where schemaname = public")).then(r => { console.log('Total tables:', r.rows[0].n); c.end(); }).catch(e => console.log('Error:', e.message));
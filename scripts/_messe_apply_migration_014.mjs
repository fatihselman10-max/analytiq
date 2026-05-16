import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upPath = path.resolve(__dirname, '../backend/migrations/014_analysis_outbox.up.sql');
const sql = fs.readFileSync(upPath, 'utf8');

const c = new pg.Client({
  host: 'junction.proxy.rlwy.net', port: 51834, user: 'postgres', database: 'railway',
  password: 'xswhBJfiUcWyTQdDdMvBGxXsMOkwJObO',
});
await c.connect();
console.log('Applying migration 014_analysis_outbox...');
try {
  await c.query(sql);
  console.log('✓ Applied');
} catch (e) {
  console.error('✗ Failed:', e.message);
  process.exit(1);
}

for (const t of ['analysis_queue', 'analysis_attempts']) {
  const r = await c.query(`SELECT column_name, is_nullable, data_type FROM information_schema.columns WHERE table_name=$1 ORDER BY ordinal_position`, [t]);
  console.log(`\n${t} (${r.rowCount} kolon):`);
  for (const x of r.rows) console.log(`  ${x.column_name.padEnd(22)} ${x.data_type} ${x.is_nullable==='NO'?'NOT NULL':''}`);
}

await c.end();
console.log('\n[done]');

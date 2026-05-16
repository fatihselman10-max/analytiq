// Migration 013: customer_activities orphan support.
// DB'de _migrations tablosu olmadığı için manuel idempotent apply.
// Çalıştırılma: `node scripts/_messe_apply_migration_013.mjs`
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const upPath = path.resolve(__dirname, '../backend/migrations/013_activity_orphan_support.up.sql');
const sql = fs.readFileSync(upPath, 'utf8');

const c = new pg.Client({
  host: 'junction.proxy.rlwy.net',
  port: 51834,
  user: 'postgres',
  database: 'railway',
  password: 'xswhBJfiUcWyTQdDdMvBGxXsMOkwJObO',
});

await c.connect();
console.log('Applying migration 013_activity_orphan_support...');
console.log('SQL:');
console.log(sql);
console.log('---');

try {
  await c.query(sql);
  console.log('✓ Migration applied successfully');
} catch (e) {
  console.error('✗ Migration failed:', e.message);
  process.exit(1);
}

// Verify
const r = await c.query(`
  SELECT column_name, is_nullable
  FROM information_schema.columns
  WHERE table_name='customer_activities' AND column_name IN ('customer_id','contact_id','conversation_id')
  ORDER BY column_name
`);
console.log('\nVerify columns:');
for (const x of r.rows) console.log(`  ${x.column_name.padEnd(20)} nullable=${x.is_nullable}`);

const idx = await c.query(`
  SELECT indexname FROM pg_indexes
  WHERE tablename='customer_activities' AND indexname LIKE '%orphan%' OR indexname LIKE '%contact%' OR indexname LIKE '%conversation%'
`);
console.log('\nNew indexes:');
for (const x of idx.rows) console.log(`  ${x.indexname}`);

await c.end();
console.log('\n[done]');

/**
 * One-time script: copy all app data from Neon to Supabase.
 * Run after `npm run db:migrate` on the Supabase database.
 */
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { Pool } from 'pg';
import { createPoolConfig } from './pool-config';

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    const value = trimmed.slice(eq + 1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const NEON_URL =
  process.env.NEON_DATABASE_URL_UNPOOLED ??
  'postgresql://neondb_owner:npg_BaEyw8ZS9qGe@ep-royal-glitter-aqch867r.c-8.us-east-1.aws.neon.tech/neondb?sslmode=require';

const SUPABASE_URL =
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL;

const TABLES = [
  'users',
  'categories',
  'products',
  'purchases',
  'purchase_details',
  'stock_movements',
  'yape_notifications',
  'kiosk_codes',
] as const;

const SERIAL_TABLES = [
  'categories',
  'products',
  'purchases',
  'purchase_details',
  'stock_movements',
  'yape_notifications',
  'kiosk_codes',
] as const;

async function truncateAll(target: Pool) {
  const list = [...TABLES].reverse().map((t) => `"${t}"`).join(', ');
  await target.query(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
}

async function getTableColumns(pool: Pool, table: string): Promise<string[]> {
  const { rows } = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = $1
     ORDER BY ordinal_position`,
    [table]
  );
  return rows.map((row) => row.column_name as string);
}

async function copyTable(source: Pool, target: Pool, table: string) {
  const { rows } = await source.query(`SELECT * FROM "${table}"`);
  if (rows.length === 0) {
    console.log(`  ${table}: 0 rows (skipped)`);
    return;
  }

  const sourceColumns = Object.keys(rows[0]);
  const targetColumns = await getTableColumns(target, table);
  const columns = sourceColumns.filter((column) => targetColumns.includes(column));

  if (columns.length === 0) {
    console.log(`  ${table}: no matching columns (skipped)`);
    return;
  }

  const skippedColumns = sourceColumns.filter((column) => !targetColumns.includes(column));
  if (skippedColumns.length > 0) {
    console.log(`  ${table}: ignoring columns not in target: ${skippedColumns.join(', ')}`);
  }

  const colList = columns.map((c) => `"${c}"`).join(', ');
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

  for (const row of rows) {
    const values = columns.map((c) => row[c]);
    await target.query(
      `INSERT INTO "${table}" (${colList}) VALUES (${placeholders})`,
      values
    );
  }

  console.log(`  ${table}: ${rows.length} rows copied`);
}

async function fixSequences(target: Pool) {
  for (const table of SERIAL_TABLES) {
    await target.query(`
      SELECT setval(
        pg_get_serial_sequence('"${table}"', 'id'),
        COALESCE((SELECT MAX(id) FROM "${table}"), 1),
        (SELECT MAX(id) IS NOT NULL FROM "${table}")
      )
    `);
  }
}

async function main() {
  if (!SUPABASE_URL) {
    throw new Error('DATABASE_URL or DATABASE_URL_UNPOOLED is not set');
  }

  const source = new Pool(createPoolConfig(NEON_URL));
  const target = new Pool(createPoolConfig(SUPABASE_URL));

  try {
    console.log('Copying data from Neon to Supabase...\n');

    await target.query('SET session_replication_role = replica');
    await truncateAll(target);
    for (const table of TABLES) {
      await copyTable(source, target, table);
    }
    await target.query('SET session_replication_role = DEFAULT');

    console.log('\nFixing serial sequences...');
    await fixSequences(target);

    console.log('\nData migration completed!');
  } finally {
    await source.end();
    await target.end();
  }
}

main().catch((err) => {
  console.error('Data migration failed:', err);
  process.exit(1);
});

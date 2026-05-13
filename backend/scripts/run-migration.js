import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import dotenv from 'dotenv';
import pg from 'pg';

const { Client } = pg;
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(scriptDirectory, '..');
const projectRoot = resolve(backendRoot, '..');
const migrationFileName = process.argv[2] ?? '001_initial_schema.sql';

dotenv.config({ path: resolve(backendRoot, '.env'), quiet: true });

const expectedTables = [
  'users',
  'refresh_sessions',
  'audit_logs',
  'patient_profiles',
  'doctor_profiles',
  'staff_profiles',
  'doctor_unavailability',
  'appointments',
  'visits',
  'test_catalog',
  'visit_assigned_tests',
  'lab_orders',
  'lab_order_items',
  'lab_reports',
  'patient_reports',
  'report_attachments',
  'invoices',
  'invoice_items',
  'payments',
];

async function runMigration() {
  validateMigrationFileName(migrationFileName);

  const connectionString = process.env.MIGRATION_DATABASE_URL;

  if (!connectionString) {
    throw new Error('MIGRATION_DATABASE_URL is required to run migrations');
  }

  const migrationPath = resolve(projectRoot, 'db', 'migrations', migrationFileName);
  const migrationSql = await readFile(migrationPath, 'utf8');
  const client = new Client({ connectionString });

  try {
    await client.connect();
    await client.query('BEGIN');
    await client.query(migrationSql);
    await client.query('COMMIT');

    await verifyExpectedTables(client);

    console.log(`Migration applied successfully: ${migrationFileName}`);
  } catch (error) {
    await rollbackIfNeeded(client);

    console.error(`Migration failed: ${migrationFileName}`);
    console.error(formatDatabaseError(error));
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

function validateMigrationFileName(fileName) {
  if (!/^\d+_[a-z0-9_]+\.sql$/u.test(fileName)) {
    throw new Error('Migration file name must look like 001_initial_schema.sql');
  }
}

async function verifyExpectedTables(client) {
  const result = await client.query(
    `
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY($1)
    ORDER BY table_name
    `,
    [expectedTables],
  );

  const existingTables = new Set(result.rows.map((row) => row.table_name));
  const missingTables = expectedTables.filter((tableName) => !existingTables.has(tableName));

  if (missingTables.length > 0) {
    throw new Error(`Migration verification failed. Missing tables: ${missingTables.join(', ')}`);
  }
}

async function rollbackIfNeeded(client) {
  try {
    await client.query('ROLLBACK');
  } catch {
    // The connection may have failed before BEGIN. Nothing useful to roll back.
  }
}

function formatDatabaseError(error) {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const details = [
    error.message ? error.message : null,
    error.name ? `name=${error.name}` : null,
    'code' in error && error.code ? `code=${error.code}` : null,
  ].filter(Boolean);

  return details.length > 0 ? details.join(' | ') : 'Unknown database error';
}

await runMigration();

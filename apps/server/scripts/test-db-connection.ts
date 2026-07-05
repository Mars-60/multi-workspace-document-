import { config } from 'dotenv';

import { createPgPool } from '../src/lib/db.js';

config({ path: ['apps/server/.env', '.env'] });

function formatDbError(error: unknown) {
  if (error instanceof Error) {
    const dbError = error as Error & { code?: string; detail?: string; errors?: unknown[] };
    return {
      message: error.message,
      code: dbError.code,
      detail: dbError.detail,
      errors: dbError.errors,
      stack: error.stack,
    };
  }

  return { message: String(error) };
}

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('FAIL: DATABASE_URL is not set.');
  process.exit(1);
}

const pool = createPgPool(databaseUrl);

try {
  await pool.query('SELECT 1');
  console.log('PASS: connected to Postgres with the production pg.Pool settings.');
} catch (error) {
  const formatted = formatDbError(error);
  console.error('FAIL: could not connect to Postgres.');
  console.error(`message: ${formatted.message}`);
  if (formatted.code) console.error(`code: ${formatted.code}`);
  if (formatted.detail) console.error(`detail: ${formatted.detail}`);
  if (formatted.errors) console.error('nested errors:', formatted.errors);
  if (formatted.stack) console.error(formatted.stack);
  process.exitCode = 1;
} finally {
  await pool.end();
}

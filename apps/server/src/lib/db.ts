import { Pool } from 'pg';

export const pgPoolConfig = {
  ssl: {
    rejectUnauthorized: false,
  },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
} as const;

export function createPgPool(connectionString: string) {
  return new Pool({
    connectionString,
    ...pgPoolConfig,
  });
}

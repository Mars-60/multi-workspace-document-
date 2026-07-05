import 'dotenv/config';

import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);
const nodeEnv = nodeEnvSchema.parse(process.env.NODE_ENV || 'development');

function normalizeUrl(value: string) {
  return value.replace(/\/+$/, '');
}

const urlSchema = z.string().trim().url().transform(normalizeUrl);

const supabaseProjectUrlSchema = urlSchema.refine((value) => {
  const url = new URL(value);
  return url.pathname === '' || url.pathname === '/';
}, 'SUPABASE_URL must be the project URL, not a REST endpoint such as /rest/v1');

const databaseUrlSchema = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const protocol = new URL(value).protocol;
    return protocol === 'postgresql:' || protocol === 'postgres:';
  }, 'DATABASE_URL must be a PostgreSQL connection string');

const productionSecretSchema = z
  .string()
  .refine((value) => Buffer.byteLength(value, 'utf8') >= 32, {
    message: 'BETTER_AUTH_SECRET must be at least 32 bytes',
  });

function parseRequiredInProduction<T>(
  name: string,
  value: string | undefined,
  schema: z.ZodType<T>,
  fallback: string,
): T {
  const candidate = value || (nodeEnv === 'production' ? undefined : fallback);
  if (!candidate) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const parsed = schema.safeParse(candidate);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variable ${name}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  return parsed.data;
}

function parseOptionalInDevelopment<T>(
  name: string,
  value: string | undefined,
  schema: z.ZodType<T>,
  fallback: T,
): T {
  if (!value) {
    if (nodeEnv === 'production') {
      throw new Error(`Missing required environment variable: ${name}`);
    }
    return fallback;
  }

  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variable ${name}: ${parsed.error.issues.map((issue) => issue.message).join('; ')}`,
    );
  }

  return parsed.data;
}

const env = {
  NODE_ENV: nodeEnv,
  PORT: z.coerce
    .number()
    .int()
    .min(1)
    .max(65535)
    .parse(process.env.PORT || 4000),
  CLIENT_URL: parseRequiredInProduction(
    'CLIENT_URL',
    process.env.CLIENT_URL,
    urlSchema,
    'http://localhost:5173',
  ),
  DATABASE_URL: parseRequiredInProduction(
    'DATABASE_URL',
    process.env.DATABASE_URL,
    databaseUrlSchema,
    'postgresql://postgres:postgres@localhost:5432/mwda',
  ),
  BETTER_AUTH_SECRET: parseRequiredInProduction(
    'BETTER_AUTH_SECRET',
    process.env.BETTER_AUTH_SECRET,
    productionSecretSchema,
    'dev-secret-with-at-least-32-bytes',
  ),
  BETTER_AUTH_URL: parseRequiredInProduction(
    'BETTER_AUTH_URL',
    process.env.BETTER_AUTH_URL,
    urlSchema,
    'http://localhost:4000',
  ),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .parse(process.env.LOG_LEVEL || 'info'),
  SUPABASE_URL: parseOptionalInDevelopment(
    'SUPABASE_URL',
    process.env.SUPABASE_URL,
    supabaseProjectUrlSchema,
    '',
  ),
  SUPABASE_SERVICE_ROLE_KEY: parseOptionalInDevelopment(
    'SUPABASE_SERVICE_ROLE_KEY',
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    z.string().min(1),
    '',
  ),
  SUPABASE_STORAGE_BUCKET: parseRequiredInProduction(
    'SUPABASE_STORAGE_BUCKET',
    process.env.SUPABASE_STORAGE_BUCKET,
    z.string().trim().min(1),
    'documents',
  ),
  GEMINI_API_KEY: parseOptionalInDevelopment(
    'GEMINI_API_KEY',
    process.env.GEMINI_API_KEY,
    z.string().trim().min(1),
    '',
  ),
  GEMINI_EMBEDDING_MODEL: z
    .string()
    .trim()
    .min(1)
    .parse(process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004'),
  GEMINI_CHAT_MODEL: z
    .string()
    .trim()
    .min(1)
    .parse(process.env.GEMINI_CHAT_MODEL || 'gemini-2.5-flash'),
  RATE_LIMIT_MAX_REQUESTS: z.coerce
    .number()
    .int()
    .min(1)
    .parse(process.env.RATE_LIMIT_MAX_REQUESTS || 120),
  RATE_LIMIT_WINDOW_MS: z.coerce
    .number()
    .int()
    .min(1000)
    .parse(process.env.RATE_LIMIT_WINDOW_MS || 60000),
};

export default env;

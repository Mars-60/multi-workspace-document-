import { betterAuth } from 'better-auth';
import { Pool } from 'pg';

import env from '../config/env.js';

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.CLIENT_URL],
  database: pool,
  emailAndPassword: {
    enabled: true,
  },
});

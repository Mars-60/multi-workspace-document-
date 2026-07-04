import { betterAuth } from 'better-auth';

import env from '../config/env.js';

export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: {
    provider: 'postgresql',
    url: env.DATABASE_URL,
  },
  emailAndPassword: {
    enabled: true,
  },
});

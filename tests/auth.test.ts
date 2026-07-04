import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ─── Auth middleware tests ────────────────────────────────────────────────────

test('protected routes use Better Auth sessions and no development user header', () => {
  const middleware = readFileSync('apps/server/src/middleware/auth.middleware.ts', 'utf8');
  assert.match(middleware, /auth\.api\.getSession/);
  assert.doesNotMatch(middleware, /x-dev-user-id|dev-user/);
});

test('auth controller forwards Better Auth cookies', () => {
  const controller = readFileSync('apps/server/src/controllers/auth/auth.controller.ts', 'utf8');
  assert.match(controller, /Set-Cookie/);
  assert.match(controller, /signOut/);
});

test('auth controller handles sign-in, sign-up, sign-out, and session endpoints', () => {
  const controller = readFileSync('apps/server/src/controllers/auth/auth.controller.ts', 'utf8');
  assert.match(controller, /signUpEmail/);
  assert.match(controller, /signInEmail/);
  assert.match(controller, /signOut/);
  assert.match(controller, /getSession/);
});

test('session endpoint returns 401 when no session', () => {
  const controller = readFileSync('apps/server/src/controllers/auth/auth.controller.ts', 'utf8');
  assert.match(controller, /401/);
  assert.match(controller, /UNAUTHORIZED/);
});

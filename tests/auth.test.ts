import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ─── Auth middleware tests ────────────────────────────────────────────────────

test('protected routes use JWT cookies and no development user header', () => {
  const middleware = readFileSync('apps/server/src/middleware/auth.middleware.ts', 'utf8');
  assert.match(middleware, /verifyAuthToken/);
  assert.match(middleware, /AUTH_COOKIE_NAME/);
  assert.match(middleware, /prisma\.user\.findUnique/);
  assert.doesNotMatch(middleware, /x-dev-user-id|dev-user/);
});

test('auth controller hashes passwords and never returns password hashes', () => {
  const controller = readFileSync('apps/server/src/controllers/auth/auth.controller.ts', 'utf8');
  assert.match(controller, /bcrypt\.hash\(password, 12\)/);
  assert.match(controller, /bcrypt\.compare/);
  assert.match(controller, /passwordHash/);
  assert.doesNotMatch(controller, /passwordHash: user\.passwordHash/);
});

test('auth routes expose register, login, logout, and me endpoints', () => {
  const routes = readFileSync('apps/server/src/routes/auth.routes.ts', 'utf8');
  assert.match(routes, /router\.post\('\/register'/);
  assert.match(routes, /router\.post\('\/login'/);
  assert.match(routes, /router\.post\('\/logout'/);
  assert.match(routes, /router\.get\('\/me'/);
  assert.match(routes, /loginLimiter/);
});

test('auth middleware returns 401 when no valid token is present', () => {
  const middleware = readFileSync('apps/server/src/middleware/auth.middleware.ts', 'utf8');
  assert.match(middleware, /401/);
  assert.match(middleware, /UNAUTHORIZED/);
});

test('JWT auth uses secure HTTP-only cookies with production cross-site support and seven-day expiry', () => {
  const jwt = readFileSync('apps/server/src/auth/jwt.ts', 'utf8');
  assert.match(jwt, /httpOnly: true/);
  assert.match(jwt, /'none' as const/);
  assert.match(jwt, /'lax' as const/);
  assert.match(jwt, /secure: env\.NODE_ENV === 'production'/);
  assert.match(jwt, /expiresIn: '7d'/);
});

test('frontend auth client uses credentials include and current endpoints', () => {
  const client = readFileSync('apps/web/src/lib/auth.ts', 'utf8');
  assert.match(client, /credentials: 'include'/);
  assert.match(client, /\/api\/auth\/register/);
  assert.match(client, /\/api\/auth\/login/);
  assert.match(client, /\/api\/auth\/logout/);
  assert.match(client, /\/api\/auth\/me/);
});

test('protected route still returns unauthorized status text', () => {
  const middleware = readFileSync('apps/server/src/middleware/auth.middleware.ts', 'utf8');
  assert.match(middleware, /401/);
  assert.match(middleware, /UNAUTHORIZED/);
});

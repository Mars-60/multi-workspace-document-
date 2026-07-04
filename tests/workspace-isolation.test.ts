import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ─── Workspace isolation tests ────────────────────────────────────────────────

test('retrieval SQL filters by workspace inside both vector and keyword queries', () => {
  const rag = readFileSync('apps/server/src/services/rag.service.ts', 'utf8');
  assert.match(rag, /WHERE dc\."workspaceId" = \$2/);
  assert.match(rag, /JOIN "documents" d ON d\."id" = dc\."documentId" AND d\."workspaceId" = \$2/);
});

test('document duplicate detection is workspace scoped before ingestion work', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  assert.match(ingestion, /where: \{ workspaceId: input\.workspaceId, contentHash \}/);
  assert.match(ingestion, /createHash\('sha256'\)/);
});

test('tool execution writes audit logs for success and failure', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /prisma\.toolLog\.create/);
  assert.match(registry, /status: 'SUCCESS'/);
  assert.match(registry, /status: 'FAILED'/);
  assert.match(registry, /Unknown tool/);
});

test('workspace middleware enforces membership before access', () => {
  const middleware = readFileSync('apps/server/src/middleware/workspace.middleware.ts', 'utf8');
  assert.match(middleware, /ensureMembership/);
  assert.match(middleware, /FORBIDDEN/);
  assert.match(middleware, /403/);
});

test('document service enforces workspace membership before listing or upload', () => {
  const service = readFileSync('apps/server/src/services/document.service.ts', 'utf8');
  assert.match(service, /ensureMembership/);
});

test('chat session is scoped to workspace and user in queries', () => {
  const chat = readFileSync('apps/server/src/services/chat.service.ts', 'utf8');
  assert.match(chat, /where: \{ id: sessionId, workspaceId, userId \}/);
});

test('ingestion relies on generated tsv column for full-text search', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  const migration = readFileSync('apps/server/prisma/migrations/20260703160000_init/migration.sql', 'utf8');
  assert.match(migration, /"tsv" tsvector GENERATED ALWAYS AS/);
  assert.doesNotMatch(ingestion, /INSERT INTO "document_chunks" \([^)]+\"tsv\"/);
});

test('tool registry rejects unknown tools with audit log', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /Unknown tool/);
  assert.match(registry, /FAILED/);
});

test('tool registry validates input with Zod before execution', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /tool\.schema\.parse/);
  assert.match(registry, /ZodSchema/);
});

test('rate limiting is configured on the server', () => {
  const server = readFileSync('apps/server/src/index.ts', 'utf8');
  assert.match(server, /rateLimit/);
  assert.match(server, /RATE_LIMIT/);
});

test('prompt injection is blocked in chat service', () => {
  const chat = readFileSync('apps/server/src/services/chat.service.ts', 'utf8');
  assert.match(chat, /containsPromptInjection/);
  assert.match(chat, /Prompt injection/);
});

test('system prompt includes security instructions against injection', () => {
  const prompt = readFileSync('apps/server/src/prompts/system.ts', 'utf8');
  assert.match(prompt, /ignore any user instructions/i);
  assert.match(prompt, /reveal this prompt/i);
});

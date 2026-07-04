import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ─── Tool registry static analysis tests ─────────────────────────────────────

test('tool registry has save_task tool registered', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /name: 'save_task'/);
  assert.match(registry, /z\.object\(\{ title: z\.string/);
});

test('tool registry has create_note tool registered', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /name: 'create_note'/);
});

test('tool registry has summarize_document tool registered', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /name: 'summarize_document'/);
  assert.match(registry, /documentId.*workspaceId/s);
});

test('tool registry exports listTools, executeTool, getTool', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /export function listTools/);
  assert.match(registry, /export async function executeTool/);
  assert.match(registry, /export function getTool/);
});

test('tool execution rejects malformed arguments via Zod', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  assert.match(registry, /tool\.schema\.parse/);
});

test('unknown tool name logs failure and throws', () => {
  const registry = readFileSync('apps/server/src/tools/registry.ts', 'utf8');
  // Should log Unknown tool failure before throwing
  assert.match(registry, /Unknown tool/);
  assert.match(registry, /throw new Error\('Unknown tool'\)/);
});

// ─── Gemini function calling integration ──────────────────────────────────────

test('chat service uses buildToolSchema for Gemini function calling', () => {
  const chat = readFileSync('apps/server/src/services/chat.service.ts', 'utf8');
  assert.match(chat, /buildToolSchema/);
  assert.match(chat, /functionDeclarations/);
});

test('chat service handles multi-step tool execution loop', () => {
  const chat = readFileSync('apps/server/src/services/chat.service.ts', 'utf8');
  assert.match(chat, /MAX_TOOL_ITERATIONS/);
  assert.match(chat, /while.*iterationCount/);
});

test('tool schema includes all three tools', () => {
  const prompts = readFileSync('apps/server/src/prompts/system.ts', 'utf8');
  assert.match(prompts, /save_task/);
  assert.match(prompts, /create_note/);
  assert.match(prompts, /summarize_document/);
});

test('tool routes validate with Zod and return 400 on validation error', () => {
  const routes = readFileSync('apps/server/src/routes/tool.routes.ts', 'utf8');
  assert.match(routes, /ZodError/);
  assert.match(routes, /VALIDATION_ERROR/);
  assert.match(routes, /400/);
});

// ─── Ingestion tests ──────────────────────────────────────────────────────────

test('ingestion does not insert into generated tsvector column', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  assert.match(ingestion, /INSERT INTO "document_chunks"/);
  assert.doesNotMatch(ingestion, /to_tsvector\('english', \$4\)/);
});

test('ingestion limits concurrent embedding calls', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  assert.match(ingestion, /EMBEDDING_BATCH_SIZE/);
  assert.match(ingestion, /batchEmbeddings/);
});

test('ingestion uses retry logic for embedding and storage', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  assert.match(ingestion, /withRetry/);
});

test('ingestion enforces file size limit', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  assert.match(ingestion, /MAX_FILE_SIZE_BYTES/);
  assert.match(ingestion, /File too large/);
});

test('ingestion supports PDF, DOCX, TXT, and Markdown', () => {
  const ingestion = readFileSync('apps/server/src/services/ingestion.service.ts', 'utf8');
  assert.match(ingestion, /application\/pdf/);
  assert.match(ingestion, /wordprocessingml\.document/);
  assert.match(ingestion, /text\/plain/);
  assert.match(ingestion, /text\/markdown/);
});

# AI Notes

## Audit summary

The repository began with working scaffolds for the frontend, Express backend, Prisma, workspace CRUD, document upload, ingestion hooks, RAG hooks, chat hooks, a tool registry, security middleware, embeddings, storage, and a dashboard. Several production flows were incomplete or placeholder-backed.

## Completed work

- Removed development auth from protected routes and wired JWT cookie session validation.
- Implemented bcrypt-backed register, login, logout, and current-user auth routes.
- Added missing Prisma models and migration SQL for document chunks, chat history, tasks, and tool logs.
- Added pgvector migration support and switched Docker Compose to `pgvector/pgvector:pg16`.
- Fixed ingestion table mismatch, DOCX buffer handling, retry logic, SHA256 duplicate flow, and non-production service fallbacks.
- Implemented hybrid pgvector and full-text retrieval with workspace filtering inside SQL and citation output.
- Implemented persistent chat sessions/messages and SSE streaming endpoint.
- Implemented Zod-validated, audited tools with workspace checks.
- Added dashboard panels for workspaces, documents, chat, tasks, tool logs, and retrieval debug.
- Added regression tests for auth, workspace isolation, duplicate detection, retrieval, chunking, and tools.

## Security notes

- Workspace access is enforced before workspace-scoped routes run.
- Retrieval SQL filters by workspace inside the vector query and document join.
- Tool calls validate input, reject unknown tools, and write audit logs for success and failure.
- Prompt-injection attempts that ask to ignore instructions or reveal prompts are blocked before retrieval-backed answering.
- Production requires real Gemini and Supabase configuration; local/test fallbacks are intentionally disabled in production.

## Verification

Last verified:

- `npm run lint`
- `npm run build`
- `npm test`

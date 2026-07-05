# Multi-Workspace Document Assistant

Production-oriented React + Vite and Express + TypeScript application for workspace-isolated document upload, ingestion, RAG retrieval, chat, and audited tool calling.

## Implemented features

- JWT email/password authentication with bcrypt, Prisma users, and HTTP-only cookies.
- Protected workspace, document, chat, retrieval, task, and tool routes.
- Workspace-scoped Prisma persistence for documents, chunks, chats, tasks, and tool logs.
- PDF, DOCX, TXT, and Markdown ingestion with SHA256 duplicate detection.
- Gemini embedding integration with retry logic and Supabase Storage upload.
- pgvector plus full-text hybrid retrieval with citations and prompt-injection checks.
- Persistent chat history, SSE streaming endpoint, citations, and markdown-compatible responses.
- Zod-validated tool registry with permission checks and audit logging.
- Dashboard panels for workspace switching, documents, chat, tasks, tool logs, and retrieval debug.

## Prerequisites

- Node.js 22+
- npm 10+
- Docker Desktop
- Supabase project and bucket for production document storage
- Gemini API key for production embeddings

## Setup

1. Copy `.env.example` to `.env` and set real secrets.
2. Start Postgres with pgvector:
   ```bash
   docker compose up -d postgres
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Generate Prisma and run migrations:
   ```bash
   npm run prisma:generate --workspace apps/server
   npm run prisma:migrate --workspace apps/server
   ```
5. Start the apps:
   ```bash
   npm run dev:server
   npm run dev
   ```

## Verification

Run these before submitting or deploying:

```bash
npm run lint
npm run build
npm test
```

## Environment

Use `.env.example` for the full local monorepo example, `apps/server/.env.example` for Render, and `apps/web/.env.example` for Vercel.

Backend variables:

| Variable                    | Required in production | Purpose                                                                                          |
| --------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                  | Yes                    | Runtime mode. Use `production` on Render.                                                        |
| `PORT`                      | Yes                    | HTTP port. Render injects this automatically; local default is `4000`.                           |
| `CLIENT_URL`                | Yes                    | Public frontend origin for CORS and credentialed cookie requests.                                |
| `DATABASE_URL`              | Yes                    | PostgreSQL connection string used by Prisma.                                                     |
| `JWT_SECRET`                | Yes                    | JWT signing secret for auth cookies. Must be at least 32 bytes.                                  |
| `LOG_LEVEL`                 | No                     | Pino log level. Defaults to `info`.                                                              |
| `SUPABASE_URL`              | Yes                    | Supabase project URL only, for example `https://project.supabase.co`; do not include `/rest/v1`. |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes                    | Backend-only key for Supabase Storage writes and signed URLs. Never expose to Vercel.            |
| `SUPABASE_STORAGE_BUCKET`   | Yes                    | Storage bucket for uploaded documents. Defaults to `documents` locally.                          |
| `GEMINI_API_KEY`            | Yes                    | Google AI Studio key for Gemini embeddings and chat.                                             |
| `GEMINI_EMBEDDING_MODEL`    | No                     | Embedding model. Defaults to `text-embedding-004`.                                               |
| `GEMINI_CHAT_MODEL`         | No                     | Chat model. Defaults to `gemini-2.5-flash`.                                                      |
| `RATE_LIMIT_MAX_REQUESTS`   | No                     | Maximum requests per rate-limit window. Defaults to `120`.                                       |
| `RATE_LIMIT_WINDOW_MS`      | No                     | Rate-limit window in milliseconds. Defaults to `60000`.                                          |

Frontend variables:

| Variable       | Required in production | Purpose                                       |
| -------------- | ---------------------- | --------------------------------------------- |
| `VITE_API_URL` | Yes                    | Public backend URL used by the Vite frontend. |

The frontend intentionally uses no Supabase, database, or JWT secrets.

### Supabase Postgres on Render

For Render, set `DATABASE_URL` to the Supabase **Session Pooler** connection string on port `5432`.

Use:

```text
postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Do not use the Supabase Direct Connection string from Render; it resolves to IPv6-only networking that Render cannot reach and can fail with `ENETUNREACH`. Do not use the Transaction Pooler on port `6543` for this server, because Prisma expects session-compatible Postgres behavior for migrations and normal queries.

After resetting the Supabase database password, copy the full connection string immediately from Supabase. The displayed password is single-use-display; do not reconstruct the URL from memory.

Before deploying, verify the exact URL locally:

```bash
npm run test:db --workspace apps/server
```

## Deployment

Render backend settings:

```text
Root Directory: blank / repository root
Build Command: npm install && npm run build --workspace=apps/server
Start Command: npm start --workspace=apps/server
```

Run Prisma migrations against the production database before or during deployment:

```bash
npm run prisma:deploy --workspace apps/server
```

Vercel frontend settings:

```text
Root Directory: blank / repository root
Build Command: npm install && npm run build --workspace=apps/web
Output Directory: apps/web/dist
```

Set `VITE_API_URL` in Vercel before building. Set all backend variables only in Render.

## Production Checks

Before final submission:

```bash
npm install
npm run lint
npm run build
npm test
```

Then verify:

- `GET /health` on Render returns `{ "status": "ok", "service": "server" }`.
- Frontend can sign up, sign in, and sign out.
- Two workspaces cannot retrieve, cite, summarize, or tool-act on each other's documents.
- Supabase upload and signed URL creation work for the configured bucket.
- Gemini embeddings and chat generation succeed with the configured models.

## Notes

Local non-production runs use deterministic fallback embeddings and no-op storage when Gemini or Supabase are not configured. Production keeps those integrations mandatory.

# Multi-Workspace Document Assistant

Production-oriented React + Vite and Express + TypeScript application for workspace-isolated document upload, ingestion, RAG retrieval, chat, and audited tool calling.

## Implemented features

- Better Auth email/password auth with secure cookie session forwarding.
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

Required for production:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `FRONTEND_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_BUCKET`
- `GEMINI_API_KEY`
- `GEMINI_EMBEDDING_MODEL`
- `GEMINI_CHAT_MODEL`

## Notes

Local non-production runs use deterministic fallback embeddings and no-op storage when Gemini or Supabase are not configured. Production keeps those integrations mandatory.

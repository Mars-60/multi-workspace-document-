# Repository Overview

This is a TypeScript npm-workspaces monorepo with a React/Vite frontend in `apps/web`, an Express API in `apps/server`, and shared types in `packages/shared`. Authentication is now implemented with Prisma users, bcrypt password hashes, signed JWTs, and HTTP-only cookies. The rest of the backend keeps Prisma/Postgres with pgvector, Supabase Storage for uploaded documents, Gemini for embeddings and chat generation, workspace-scoped RAG retrieval, persistent chat, and audited Zod-validated tool calls.

# Feature Matrix

| Requirement                 | Status      | Evidence (files)                                                                                                           | Notes                                                                                                           |
| --------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Sign-up/login/logout/me     | ✅ Complete | `apps/server/src/controllers/auth/auth.controller.ts`, `apps/server/src/routes/auth.routes.ts`, `apps/web/src/lib/auth.ts` | JWT cookie auth replaces the previous auth provider.                                                            |
| Password hashing            | ✅ Complete | `apps/server/src/controllers/auth/auth.controller.ts`                                                                      | Uses bcrypt with 12 rounds.                                                                                     |
| HTTP-only cookies           | ✅ Complete | `apps/server/src/auth/jwt.ts`                                                                                              | `httpOnly`, local `sameSite=lax`, and production `SameSite=None; Secure` for Render/Vercel cross-site requests. |
| Protected routes            | ✅ Complete | `apps/server/src/middleware/auth.middleware.ts`, `apps/server/src/routes/*.ts`                                             | Middleware verifies JWT and reloads user from Prisma.                                                           |
| Workspace management        | ✅ Complete | `apps/server/src/services/workspace.service.ts`, `apps/web/src/App.tsx`                                                    | Users can list/create/switch workspaces.                                                                        |
| Workspace isolation         | ✅ Complete | `apps/server/src/middleware/workspace.middleware.ts`, `apps/server/src/services/rag.service.ts`                            | Membership and SQL workspace filters are enforced.                                                              |
| Document upload/ingestion   | ✅ Complete | `apps/server/src/routes/document.routes.ts`, `apps/server/src/services/ingestion.service.ts`                               | PDF/DOCX/TXT/Markdown with duplicate detection.                                                                 |
| RAG retrieval and citations | ✅ Complete | `apps/server/src/services/rag.service.ts`, `apps/server/src/services/chat.service.ts`                                      | Hybrid retrieval, RRF, citations, and grounded fallback.                                                        |
| Gemini integration          | 🟡 Partial  | `apps/server/src/lib/embeddings.ts`, `apps/server/src/services/chat.service.ts`                                            | Implemented; live credential verification still required.                                                       |
| Supabase Storage            | 🟡 Partial  | `apps/server/src/lib/storage.ts`                                                                                           | Implemented; live bucket verification still required.                                                           |
| Tool calling and audit logs | ✅ Complete | `apps/server/src/tools/registry.ts`, `apps/server/src/routes/tool.routes.ts`                                               | Zod validation and workspace-scoped logs.                                                                       |
| Dashboard                   | ✅ Complete | `apps/web/src/App.tsx`, `apps/web/src/auth/AuthContext.tsx`                                                                | Protected dashboard with workspaces, uploads, chat, tasks, tools, and debug view.                               |
| Env examples                | ✅ Complete | `.env.example`, `apps/server/.env.example`, `apps/web/.env.example`                                                        | Legacy auth-provider variables removed; `JWT_SECRET` documented.                                                |
| Deployment scripts          | ✅ Complete | `apps/server/package.json`, `README.md`                                                                                    | `postinstall` generates Prisma client; `prisma:deploy` uses `prisma migrate deploy`.                            |

# Files Modified

- `.env.example`
- `AI_NOTES.md`
- `README.md`
- `apps/server/.env.example`
- `apps/server/package.json`
- `apps/server/prisma/schema.prisma`
- `apps/server/prisma/migrations/20260705090000_replace_better_auth_with_jwt/migration.sql`
- `apps/server/src/auth/jwt.ts`
- `apps/server/src/config/env.ts`
- `apps/server/src/controllers/auth/auth.controller.ts`
- `apps/server/src/index.ts`
- `apps/server/src/middleware/auth.middleware.ts`
- `apps/server/src/routes/auth.routes.ts`
- `apps/web/src/App.tsx`
- `apps/web/src/auth/AuthContext.tsx`
- `apps/web/src/lib/auth.ts`
- `apps/web/src/main.tsx`
- `apps/web/package.json`
- `package-lock.json`
- `tests/auth.test.ts`

# Security Review

Implemented security features: bcrypt password hashing, 7-day signed JWT cookies, HTTP-only auth cookies, production-only secure cookies with cross-site `SameSite=None`, login rate limiting, CORS credentials restricted to `CLIENT_URL`, Prisma-backed user lookup on each authenticated request, no password hash returned to clients, workspace membership checks, workspace filters inside retrieval SQL, Zod validation for auth/tool inputs, Helmet, body-size limits, and global rate limiting.

Remaining risks: live Supabase/Gemini/Render/Vercel verification still requires production credentials; existing users from the previous auth system receive an empty `passwordHash` and must reset/recreate credentials; no HTTP integration test suite currently exercises auth with a real database.

# Testing Summary

Existing tests include static auth/security checks, workspace-isolation checks, retrieval/chunking tests, and tool registry checks. Missing tests are real HTTP auth integration tests, browser E2E tests, live Gemini tests, and live Supabase Storage tests.

# Deployment Guide

Render backend:

```text
Root Directory: blank / repository root
Build Command: npm install && npm run build --workspace=apps/server
Start Command: npm start --workspace=apps/server
```

Run migrations against production:

```bash
npm run prisma:deploy --workspace apps/server
```

Vercel frontend:

```text
Root Directory: blank / repository root
Build Command: npm install && npm run build --workspace=apps/web
Output Directory: apps/web/dist
```

# Remaining Limitations

Production still requires real `DATABASE_URL`, `JWT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET`, `GEMINI_API_KEY`, `CLIENT_URL`, and `VITE_API_URL` values. Supabase URL must be the project URL, not a `/rest/v1` endpoint.

# Manual Verification Checklist

□ Sign up  
□ Login  
□ Duplicate email returns 409  
□ Invalid password returns 401  
□ `/api/auth/me` returns current user  
□ Logout clears session  
□ Create workspace  
□ Switch workspace  
□ Upload PDF/DOCX/TXT/Markdown  
□ Upload duplicate document  
□ Ask question and verify citation  
□ Verify "I don't know"  
□ Verify workspace isolation  
□ Verify tool calling and tool logs  
□ Verify SSE streaming  
□ Verify dashboard and retrieval debug  
□ Verify Render `/health`  
□ Verify Vercel frontend with cookies

# Reviewer Feedback

Strengths: the authentication path is now simple and auditable; workspace isolation remains scoped in middleware and SQL; deployment env docs are cleaner.

Weaknesses: auth integration tests and credential-backed Supabase/Gemini checks are still missing.

Possible deductions: no deployed URL/evaluator account in the repo; no live E2E proof.

Overall score: 8/10.

Estimated assignment completion percentage: 90%.

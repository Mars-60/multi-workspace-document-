# ─── Builder stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/

# Install all dependencies (including dev, for build)
RUN npm ci --prefer-offline

# Copy source
COPY tsconfig.base.json ./
COPY apps/server ./apps/server
COPY apps/web ./apps/web
COPY packages/shared ./packages/shared

# Generate Prisma client
RUN npm run prisma:generate --workspace apps/server

# Build both apps
RUN npm run build

# ─── Server production image ───────────────────────────────────────────────────
FROM node:22-alpine AS server

ENV NODE_ENV=production

WORKDIR /app

# Copy workspace manifests for production install
COPY package.json package-lock.json ./
COPY apps/server/package.json ./apps/server/
COPY packages/shared/package.json ./packages/shared/

# Production dependencies only
RUN npm ci --omit=dev --prefer-offline --workspace apps/server --workspace packages/shared

# Copy built server and Prisma schema
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/server/node_modules/.prisma ./apps/server/node_modules/.prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY apps/server/prisma ./apps/server/prisma

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "apps/server/dist/index.js"]

# ─── Web production image ──────────────────────────────────────────────────────
FROM nginx:alpine AS web

COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

# nginx SPA fallback
RUN printf 'server {\n  listen 80;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' \
  > /etc/nginx/conf.d/default.conf

EXPOSE 80

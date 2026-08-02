# AgroBridge

Platform connecting Georgian agricultural producers with buyers in Georgia and abroad.

## Stack (MVP)

| Layer | Choice |
|-------|--------|
| Monorepo | pnpm + Turborepo |
| Web | Next.js (App Router) + TypeScript + Tailwind CSS + next-intl |
| API | NestJS + TypeScript |
| Database | PostgreSQL + Prisma |
| Cache / jobs | Redis (Docker; used later for translation queue) |
| Shared types | `@agrobridge/shared` |

### Languages (UI)

Priority order: **ka → en → ru → de → fr → it → es**

In-platform chat: users write in their own language; AI translates for the recipient (architecture prepared in the data model).

## Repository layout

```text
apps/
  web/          # Next.js frontend
  api/          # NestJS backend
packages/
  shared/       # Shared locales, roles, types
docker-compose.yml
```

## Prerequisites

- Node.js 22+
- pnpm 9+
- Docker (PostgreSQL + Redis)

## Quick start

```bash
# Install dependencies
pnpm install

# Start Postgres + Redis
docker compose up -d

# Configure API env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local

# Build shared package, generate Prisma client, run migrations
pnpm --filter @agrobridge/shared build
pnpm --filter @agrobridge/api db:generate
pnpm --filter @agrobridge/api db:migrate

# Run web (http://localhost:3000) and api (http://localhost:3001)
pnpm dev
```

Health check: `GET http://localhost:3001/api/health`

## Auth (current step)

API (JWT):

- `POST /api/auth/register` — roles `farmer` | `buyer` (admin is not self-serve)
- `POST /api/auth/login`
- `GET /api/auth/me` — Bearer token

Web:

- `/[locale]/register`, `/[locale]/login`, `/[locale]/account`
- Session cookie: `agrobridge_token` (httpOnly), set by Next.js route handlers

## Next implementation steps

1. Farm profiles and product catalog
2. RFQ / offer flow
3. Chat with AI translation
4. Admin moderation

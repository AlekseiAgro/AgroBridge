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

## Next implementation steps

1. Authentication (roles: farmer / buyer / admin)
2. Farm profiles and product catalog
3. RFQ / offer flow
4. Chat with AI translation
5. Admin moderation

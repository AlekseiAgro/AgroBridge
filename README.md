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

## Farms & catalog (current step)

API:

- `GET /api/farms`, `GET /api/farms/:id`, `GET|POST /api/farms/me` / `POST /api/farms`, `PATCH /api/farms/me`
- `GET /api/products` (filters: `q`, `category`, `region`)
- `GET /api/products/:id`, `GET /api/products/mine`
- `POST|PATCH|DELETE /api/products`

Web:

- Public: `/[locale]/catalog`, `/products/[id]`, `/farms/[id]`
- Farmer dashboard: `/dashboard/farm`, `/dashboard/products`

## RFQ / offers (current step)

Flow:

1. Buyer opens a product → sends quote request (quantity, message)
2. Farmer sees it in `/dashboard/inbox` → sends price offer (GEL/EUR/USD)
3. Buyer accepts / declines in `/dashboard/rfqs`

Statuses: `pending` → `offered` → `accepted` | `declined` (or `cancelled` while pending)

## Chat + AI translation (current step)

- Open chat from an RFQ (`Open chat`) or `/dashboard/chat`
- Each user writes in their own language (profile locale)
- Messages are stored as originals; translations are cached per recipient locale
- Providers: `TRANSLATION_PROVIDER=mock` (default) or `openai` (+ `OPENAI_API_KEY`)
- UI shows translation by default with “Show original”

## Admin moderation (current step)

- Farmer submits a product for review (`Submit for moderation`)
- Statuses: `draft` → `pending` → `approved` | `rejected`
- Public catalog shows only **approved + published** products
- Admin desk: `/dashboard/admin`
- Seed admin user:

```bash
pnpm --filter @agrobridge/api db:seed
# default: admin@agrobridge.local / ChangeMeAdmin1
```

## Product photos (current step)

- Farmers upload up to **8** product photos (JPEG / PNG / WebP, max **5MB** each) on the product edit page
- First photo becomes primary; primary can be changed later
- Catalog, farm pages, and product detail show images
- Storage: `STORAGE_DRIVER=local` (dev, files under `apps/api/uploads`) or `s3` (AWS S3 / Cloudflare R2)
- Changing photos on a published listing returns it to moderation (`pending`)

API:

- `POST /api/products/:id/images` (multipart field `file`)
- `DELETE /api/products/:id/images/:imageId`
- `PATCH /api/products/:id/images/:imageId/primary`
- Local files served at `GET /api/uploads/products/:productId/:filename`

## Next implementation steps

1. Email notifications

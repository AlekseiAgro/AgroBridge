# AgroBridge architecture (MVP)

## Goals

- Connect Georgian farmers with buyers (shops, restaurants, processors, wholesalers).
- Work well on phones and desktops; stay simple for non-technical users.
- Stay modular so payments, logistics, and deeper B2B tools can be added later.

## Applications

### `apps/web`

- Next.js App Router, TypeScript, Tailwind CSS.
- Locale-prefixed routes via `next-intl`: `/ka`, `/en`, `/ru`, `/de`, `/fr`, `/it`, `/es`.
- Talks to the API over HTTP (`NEXT_PUBLIC_API_URL`).

### `apps/api`

- NestJS modular API under global prefix `/api`.
- Prisma + PostgreSQL for persistence.
- Redis reserved for translation jobs and rate limiting (not wired in step 1).

### `packages/shared`

- Canonical locale list and user roles shared by web and API.

## Domain model (initial)

- **User** — role (`farmer` | `buyer` | `admin`) and preferred `locale`.
- **Farm** — producer profile.
- **Product** — catalog items.
- **Conversation / Message** — 1:1 chat.
- **MessageTranslation** — cached AI translation per target locale; original text remains source of truth.

## Admin moderation

- `Product.moderationStatus`: `draft | pending | approved | rejected`
- Submitting for publication sets `pending`; catalog requires `approved`
- Content changes on a published listing return it to `pending`
- Admin API under `/api/admin/*` (role `admin` only)
- Admin account is seeded via `prisma/seed.ts` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`)

## RFQ / offer flow

- Buyer creates an `Rfq` against a published product.
- Farmer responds with one `RfqOffer` (price, currency, optional quantity/message).
- Buyer can accept or decline an offered RFQ; pending RFQs can be cancelled by the buyer.
- Farmer can decline a pending RFQ without offering.

## Farms and catalog

- Each farmer has at most one `Farm` profile.
- Products belong to a farm; only `isPublished=true` items appear in the public catalog.
- Catalog filters: text query, category, region.
- Farmer dashboard manages farm profile and product drafts/publish state.

## Authentication

- NestJS issues JWT access tokens (`JWT_SECRET`, `JWT_EXPIRES_SECONDS`).
- Self-registration is limited to `farmer` and `buyer`. `admin` is provisioned separately.
- Web stores the access token in an httpOnly cookie (`agrobridge_token`) via `/api/auth/*` route handlers.
- Protected API routes use `JwtAuthGuard` and optional `RolesGuard`.

## Chat translation flow

1. Conversation is 1:1 (`farmerId` + `buyerId`), usually opened from an RFQ.
2. Sender writes in their language; API stores `sourceText` + `sourceLocale`.
3. `TranslationService` translates into the recipient locale (`mock` or `openai`).
4. `MessageTranslation` caches the result (`pending` / `completed` / `failed`).
5. Recipient sees translation by default and can toggle the original.
6. Web polls the conversation every few seconds for new messages (WebSockets later).

## Out of scope for early MVP

- Native mobile apps
- Microservices
- Full payment gateway
- Group chats / voice messages

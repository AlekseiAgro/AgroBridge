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

## Chat translation flow (planned)

1. Sender writes in their language.
2. API stores `sourceText` + `sourceLocale`.
3. Background job translates into recipient locale.
4. Recipient sees translation by default; can open the original.

## Out of scope for early MVP

- Native mobile apps
- Microservices
- Full payment gateway
- Group chats / voice messages

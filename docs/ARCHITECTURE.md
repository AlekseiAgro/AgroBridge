# AgroBridge architecture (MVP)

## Goals

- Connect Georgian farmers with buyers (shops, restaurants, processors, wholesalers).
- Work well on phones and desktops; stay simple for non-technical users.
- Stay modular so payments, logistics, and deeper B2B tools can be added later.

## Applications

### `apps/web`

- Next.js App Router, TypeScript, Tailwind CSS.
- Locale-prefixed routes via `next-intl`: `/ka`, `/en`, `/ru`, `/de`, `/fr`, `/it`, `/es`.
- Talks to the API over HTTP: the browser uses `NEXT_PUBLIC_API_URL`, the server uses the
  private `API_INTERNAL_URL` so the API can still identify the visitor
  (see [`RATE_LIMITING.md`](RATE_LIMITING.md)).

### `apps/api`

- NestJS modular API under global prefix `/api`.
- Prisma + PostgreSQL for persistence.
- Redis reserved for translation jobs (not wired yet). Rate limiting is Postgres-backed —
  see [`RATE_LIMITING.md`](RATE_LIMITING.md) for why.

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

## Product images

- `ProductImage` rows store `url`, storage `key`, `sortOrder`, and `isPrimary`.
- Upload is multipart (`file`); allowed types: JPEG, PNG, WebP; max 5MB; max 8 images per product.
- `StorageService` abstracts drivers:
  - `local` — writes under `STORAGE_LOCAL_DIR` and serves public media via `/api/uploads/...`
  - `s3` — AWS S3 / Cloudflare R2; public media uses `S3_PUBLIC_BUCKET` (or legacy `S3_BUCKET`) and `STORAGE_PUBLIC_BASE_URL/{key}`; private farm documents use `S3_PRIVATE_BUCKET` and never receive a public URL
- Farm verification documents (`idCard`, `businessRegistration`, `other`) stay private: Browser → Web BFF → API (`JWT` + `EmailVerified` + owner/admin) → `openReadStream(key)`.
- `ProductCertificate` currently uploads as `visibility: 'public'` (separate policy; pending certificates can appear in public product JSON).
- Image changes on a published product reset moderation to `pending`.

## Email notifications

- `MailModule` provides `MailService` + `NotificationsService` (global).
- Drivers: `console` (dev/default), `resend` (HTTPS to `api.resend.com`), or `smtp` via nodemailer (legacy).
- `MAIL_DRIVER=resend` requires `RESEND_API_KEY` and `MAIL_FROM` at boot. `MAIL_DRIVER=smtp` requires `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` and `MAIL_FROM`. Missing values fail startup; the service never falls back to console.
- `NODE_ENV=production` rejects `MAIL_DRIVER=console` unless `MAIL_ALLOW_CONSOLE=true` (explicit staging override).
- Resend uses a 10s HTTP timeout and retries transient failures (timeouts, 429, 5xx) up to 3 attempts. SMTP keeps TLS 1.2+, STARTTLS on 587 / SMTPS on 465, 10–20s timeouts, and the same retry budget.
- Templates are locale-aware (`ka|en|ru|de|fr|it|es`) with English fallback.
- Events: welcome, RFQ lifecycle, product moderation (pending → admins; approved/rejected → farmer).
- Template notifications (welcome, RFQ, harvest, chat, …) log delivery failures and do not fail the API action. Verification, email-change and account-deletion codes fail closed with a generic 503 that never includes SMTP details.
- Chat messages email the recipient via `notifyChatMessage` (fire-and-forget; skipped if the peer opened the thread within the last 2 minutes).

## Out of scope for early MVP

- Native mobile apps
- Microservices
- Full payment gateway
- Group chats / voice messages

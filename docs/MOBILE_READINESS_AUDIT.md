# Mobile Readiness Audit

Source of truth: `origin/main` at `4a3e28b` (`feat: add Open Graph metadata for public pages (#235)`).

This is a read-only audit of the existing monorepo. No mobile app was added. No API or web behavior was changed. Conclusions below come from the NestJS controllers, services, guards, shared types, and the Next.js BFF that sits in front of the API today.

The future app should call the existing Nest API (`/api/...`) with `Authorization: Bearer`. It should not call the Next.js route handlers under `apps/web/src/app/api`, and it should not introduce a second backend.

`docs/ARCHITECTURE.md` is older than the code. It still describes native mobile as out of scope and treats RFQ as the main trade flow. The code now lets every marketplace account buy and sell (`canTrade` in `packages/shared/src/roles.ts`) and treats Purchase Requests plus Quotes as the demand/offer flow.

## 1. Executive Summary

The Nest API can already serve a native client. Login and registration return `accessToken` with `tokenType: "Bearer"`. `JwtStrategy` reads only the `Authorization` header. The httpOnly cookie `agrobridge_token` is a web BFF detail (`apps/web/src/app/api/auth/login/route.ts` stores the token and returns `{ user }` only).

No API change is required before a first mobile MVP. The client must:

- talk to the public API origin (`NEXT_PUBLIC_API_URL`, documented as `https://api.agrobridge.ge/api`)
- keep the access token in secure storage
- treat a 401 as “sign in again” (there is no refresh token)
- prefix relative `/api/uploads/...` media with the API host
- map in-app notification `href` values, which are locale-less web paths
- poll chat and notifications the same way the web app does

Email verification is a 6-digit code on the API, which fits a native screen. Password reset is an opaque token posted to `POST /api/auth/reset-password`; the email link is a web URL.

Endpoint classification for the routes that exist today:

| Status | Routes |
| --- | ---: |
| READY | 33 |
| READY WITH MINOR CHANGES | 29 |
| NEEDS API CHANGE | 0 |
| NOT NEEDED FOR MOBILE MVP | 58 |

There is no P0 backend blocker for the MVP described below. Refresh tokens, push delivery, cursor pagination, and absolute media URLs are follow-ups, not prerequisites at the current catalog size (on the order of tens of public products).

## 2. Current Monorepo Architecture

| Path | Role |
| --- | --- |
| `apps/api` | NestJS 11, global prefix `/api`, Prisma, PostgreSQL |
| `apps/web` | Next.js App Router, `next-intl`, seven locales |
| `packages/shared` | Roles, locales, catalog enums, DTO-facing types |
| `apps/web/src/app/api/**` | BFF. Attaches the cookie token as Bearer when it calls Nest |

`apps/api/src/main.ts` sets `whitelist`, `transform`, and `forbidNonWhitelisted` on `ValidationPipe`, CORS `credentials: true` for `WEB_ORIGIN` (comma-separated), and a rate-limit filter that adds `Retry-After`.

Persistence is one PostgreSQL database. Redis is mentioned in the architecture note for translation jobs and is not required for the mobile read path. Chat translation is synchronous/cached in Postgres. There is no WebSocket gateway and no FCM/APNs module.

Public web media rewrites live in `apps/web/next.config.ts`: `/api/uploads/:path*` on the website is proxied to the API. The API also serves those files itself when `STORAGE_DRIVER=local` (`UploadsController`). S3/R2 public objects are absolute `STORAGE_PUBLIC_BASE_URL/{key}` URLs.

## 3. Authentication & Session Readiness

`POST /api/auth/register` and `POST /api/auth/login` return `AuthTokenResponse` (`packages/shared/src/auth.ts`):

- `accessToken`
- `tokenType: "Bearer"`
- `expiresIn` (string seconds; default `JWT_EXPIRES_SECONDS` or 7 days, `apps/api/src/auth/auth.module.ts`)
- `user` (`PublicUser`, including `emailVerified`)
- `verificationEmailSent` on register only

The JWT payload is `sub`, `email`, `role`, `locale`, `ver` (`auth.service.ts`). On each request `JwtStrategy` reloads the user and rejects the token when `ver !== user.authVersion`, the user is missing, or `blockedAt` is set. Password change and password reset increment `authVersion`, so older tokens die. There is no refresh token, no server session table, and no `POST /auth/logout`. Logout on mobile is deleting the stored token. Server-side revocation is block, password change, or reset.

Registration (`RegisterDto`) requires email, password (8–128), `role` of `farmer` or `buyer`, `acceptTerms: true`, and `acceptedTermsVersion`. `acceptedTermsLocale` is only `ka` or `en` (`isLegalLocale`). The role is a registration statistic. `canTrade` treats `farmer`, `buyer`, and `admin` as able to both buy and sell. The mobile client must still send one of the two registerable roles. Terms text and the current version come from `GET /api/legal/documents/current?locale=`.

`EmailVerifiedGuard` returns 403 `Confirm your email address to access your account` until `emailVerifiedAt` is set. Register still issues a token first. `POST /api/verification/email/send-code` and `POST /api/verification/email/confirm` accept that token and a body `{ code }` of exactly 6 digits. They do not use `EmailVerifiedGuard`. A failed first send is reported as `verificationEmailSent: false` without rolling back the account.

`POST /api/auth/forgot-password` always returns `{ ok: true }` when the rate limit allows it. The raw token is only inside the email link `{WEB_PUBLIC_URL}/{locale}/reset-password?token=...`. `POST /api/auth/reset-password` accepts `{ token, password }` and does not return a new JWT. The user signs in afterwards. A native app can open that HTTPS link (universal link / App Link) or let the existing website finish the reset.

`POST /api/auth/change-password` requires the current Bearer token and returns a new `AuthTokenResponse`.

Web-only trap: `POST /api/auth/login` on the **website** (`apps/web/src/app/api/auth/login/route.ts`) discards `accessToken` and sets `agrobridge_token` httpOnly. A native client that calls the website will not receive a token. Call Nest.

CORS does not apply to a normal native HTTP stack. It matters only for a WebView loaded from an origin that is not in `WEB_ORIGIN`. Do not add the mobile bundle id to CORS unless such a WebView exists.

Rate limits on login, register, and reset are per IP and per email (`RateLimitService`, Postgres). Mobile must not send `X-Forwarded-For`. That header is for the web BFF on the private network (`docs/RATE_LIMITING.md`).

## 4. API Readiness

Contract shape:

- Success: JSON body, or a file stream for private downloads.
- Validation: Nest `{ statusCode, message, error }`. `message` may be a string or a string array. `forbidNonWhitelisted` rejects unknown fields.
- 401: missing, expired, or revoked Bearer token. English text (`Invalid email or password`, `Please sign in again.`).
- 403: role, email not verified, or ownership.
- 404: hidden unpublished products are also 404 for non-owners (`ProductsService.getById`).
- 429: `{ statusCode, error, message, retryAfterSeconds }` plus `Retry-After`.

There is no OpenAPI document. `packages/shared` is the type contract the web already uses. Errors are English sentences, not stable error codes. The app should localize by HTTP status and a small set of known messages, and show the server string only as a fallback.

List endpoints used by the marketplace return plain arrays. There is no `page`, `cursor`, or `next`. Notification list is the exception: `limit` query, default 30, capped at 100 (`NotificationsService.listMine`).

Sorting and filters that exist:

- Catalog `GET /api/products`: `q`, `category`, `region`, `harvestStatus`, `preorder`, `inSeason`. Order is `updatedAt desc`.
- Open purchase requests: `q`, `category`. Order is `createdAt desc`. Status is always `open` on this list.
- Chat thread: optional `locale` query for translation display.
- Places autocomplete and admin filters are out of MVP.

## 5. Products & Marketplace

Public catalog uses `publicProductWhere`: `isPublished`, moderation `approved`, non-empty title, and not an internal draft title. `harvestStatus` is not removed when it is `soldOut`, so sold-out listings stay public. Filters accept `available`, `limited`, `soldOut`, and `growing` when `harvestStatus` is a known value. `preorder=true` and `inSeason=true` are real query flags (`CatalogQueryDto`).

`GET /api/products/:id` is public for a listed product. Owners and admins can load unpublished rows. Everyone else gets 404. Optional Bearer attaches `watching` for HarvestWatch.

Owner writes (`POST/PATCH/DELETE /api/products`, image routes) require Bearer, verified email, and `canTrade`. A farm row is optional at create time (`farmId` may be null). Publishing checks listing fields (title, category, unit, price). Image, video, and certificate changes can move an approved product back to `pending`. The mobile editor must show “waiting for review”, not assume the listing stays public.

HarvestWatch: `GET/POST/DELETE /api/products/:id/watch` and `GET /api/products/watches`. Email plus in-app type `harvestAvailable` already exists. No device push.

`POST /api/products/:id/views` is optional-auth and rate-limited. Safe to call from a product screen.

`GET /api/categories` returns the public category list. Labels for the seven locales live in `apps/web/messages/*.json`, not in this payload. The app should ship those catalogs or display the category id until it does.

`GET /api/products/:id/market-insight` is a separate read model. Leave it out of the first app.

## 6. Purchase Requests

`PurchaseRequestsController` is the buyer-demand API.

| Route | Who | Notes |
| --- | --- | --- |
| `GET /api/purchase-requests` | public, optional Bearer | open only; `category`, `q` |
| `GET /api/purchase-requests/mine` | verified | buyer’s own requests, any status |
| `POST /api/purchase-requests` | verified | create |
| `GET /api/purchase-requests/:id` | optional Bearer | non-open is forbidden for strangers |
| `POST /api/purchase-requests/:id/cancel` | owner | |
| `POST /api/purchase-requests/:id/close` | owner | |
| `POST /api/purchase-requests/:id/quotes` | verified seller with a farm | |
| `POST .../quotes/:quoteId/accept` | request owner | accepts one quote |
| `POST .../quotes/:quoteId/decline` | request owner | |
| `POST .../quotes/:quoteId/withdraw` | quote owner | |

`assertBuyer` and `assertFarmer` in `purchase-requests.service.ts` both call `canTrade`. The names are historical. A `buyer` account can quote; a `farmer` account can publish a request. Quote creation still needs the caller’s farm.

Closed, cancelled, and fulfilled requests are absent from the public list. That matches the website.

Accepting a quote does not open a Deal Workspace. No such API exists. Do not invent one in the app.

## 7. Offers / Quotes

Seller offers against a Purchase Request are Purchase Quotes, not RFQs.

`GET /api/purchase-requests/my-quotes` is the seller’s list. Status changes are the accept, decline, and withdraw routes above. In-app notification types already split buyer events (`purchaseQuoteReceived`, `purchaseQuoteWithdrawn`) from seller events (`purchaseQuoteAccepted`, `purchaseQuoteDeclined`, `purchaseRequestClosed`, `purchaseRequestCancelled`) in `packages/shared/src/notification.ts`.

`/api/rfqs` is a second, product-scoped request/offer flow (create, inbox, offer, accept, decline, cancel, complete). The website still has it. The mobile MVP should not call it. Completing an RFQ is closer to a post-acceptance workspace than to “My Quotes”.

## 8. Messaging & Notifications

Chat is ` /api/conversations`, all routes behind Bearer + verified email + `canTrade`.

- `GET /api/conversations` returns every thread for the user, with the latest message only.
- `GET /api/conversations/unread-count` returns `{ count }`.
- `POST /api/conversations` opens or reuses a pair. For a purchase request the body is `purchaseRequestId` plus `farmerId` when the buyer starts the thread. The seller can omit `farmerId`. Chat is allowed only after that seller has a quote, and after the request leaves `open` only for the winning seller (`ChatService.resolveParticipants`).
- `GET /api/conversations/:id?locale=` marks the thread read and returns **every** message, oldest first, including translations.
- `POST /api/conversations/:id/messages` sends `{ text, sourceLocale? }`.

The web client polls (`ChatRoom`, `ChatNavLink`). There is no socket and no push token API. A mobile MVP can poll the same two read endpoints.

The conversation row is still `farmerId` + `buyerId`. Those ids are the two participants of that trade, not “this account’s only role”. One user can appear as farmer in one thread and buyer in another.

In-app notifications:

- `GET /api/notifications?limit=`
- `GET /api/notifications/unread-count` returns `count`, `totalUnread`, and the purchase-request / quote splits
- `POST /api/notifications/read-all`
- `POST /api/notifications/read-types` with `{ types }`
- `POST /api/notifications/:id/read` (missing row returns `{ ok: false }`, not 404)

Each item has `type`, `productId` (often null), `title`, `body`, `href`, `readAt`, `createdAt`. `href` is a website path without a locale, for example `/requests/{id}`, `/dashboard/quotes`, `/dashboard/chat/{id}`, `/dashboard/products/{id}/edit`, `/products/{id}`. Email links are the same path under `{WEB_PUBLIC_URL}/{locale}`. The app should switch on `type` and parse `href`. It should not open a WebView for every row.

`GET/PUT /api/subscriptions/alerts` is the settings form for category/region email alerts. It is separate from HarvestWatch and from the notification inbox. Leave it out of the first app.

## 9. File & Image Uploads

Uploads are multipart, field name `file`, memory storage, Bearer + verified email.

| Kind | Route | Limits in shared/constants |
| --- | --- | --- |
| Product photo | `POST /api/products/:id/images` | JPEG, PNG, WebP; 5 MB; max 5 |
| Farm photo | `POST /api/farms/me/photos` | 5 MB; max 3 |
| Avatar | `POST /api/cabinet/me/avatar` | JPEG, PNG, WebP; 5 MB |

Primary flags: `PATCH .../images/:imageId/primary` and `PATCH /api/farms/me/photos/:photoId/primary`.

Local public URLs are relative: `/api/uploads/products/{id}/{file}`, `/api/uploads/farms/{id}/photos/{file}`, `/api/uploads/users/{id}/{file}` (`storedObjectUrl`). On the website, Next rewrites `/api/uploads` to the API. A native image loader must turn that path into `https://<api-host>/api/uploads/...`. Do not prefix a base that already ends in `/api` a second time (`https://api.agrobridge.ge/api` + `/api/uploads/...` is correct; `base + /api/uploads` doubled is not). Absolute `https://` CDN URLs must be left unchanged. Empty string means “not public” (`toPublicMediaUrl` drops certificates and farm documents).

Private files are streams, not CDN URLs:

- `GET /api/products/:id/certificates/:certificateId/file`
- `GET /api/farms/documents/:documentId/file`

Both need Bearer. Certificates and verification documents are out of the first MVP. Do not request them anonymously; public `/api/uploads/.../certificates/...` is hard-404.

Video upload exists (`POST /api/products/:id/videos`) and is not needed for the first app.

## 10. Localization

Locales in `packages/shared/src/locales.ts`: `ka`, `en`, `ru`, `de`, `fr`, `it`, `es`. Default `en`.

- Account locale is on the user and updated with `PATCH /api/cabinet/me/locale`.
- Register may send `locale`.
- Chat `sourceLocale` and `GET /conversations/:id?locale=` select translation. Georgian and Cyrillic are detected; Latin-script languages fall back to the sender’s declared locale (`detectMessageLocale`).
- Product titles and request titles are stored text. The web translates only known demo titles. The API will not translate user-authored catalog text.
- Category labels, harvest labels, and the rest of the UI copy live in `apps/web/messages/{locale}.json`. The mobile app needs its own copies of those strings.
- API errors and validation messages are English.
- Legal acceptance locale is `ka` or `en` only.
- Email and in-app notification titles are already localized for the recipient’s locale on the server. The app can show `title` and `body` as received.

No locale prefix belongs on API paths. Locale prefixes are a website routing concern.

## 11. Security & Permissions

What a mobile client must keep:

- Token in the platform keystore, not in logs, not in a URL.
- Never call admin routes. They are `JwtAuthGuard` + `EmailVerifiedGuard` + `@Roles('admin')` on the whole `AdminController`.
- Unpublished products, private certificates, and farm documents stay behind owner or admin checks. Guessing an id returns 404, not the row.
- Password-reset responses do not reveal whether the email exists. The client must not add a “no such user” screen.
- Blocked users fail login and fail `JwtStrategy` even with an old token.
- Rate limits are part of the contract. Honor `Retry-After`.

Extra risk once the API is called from devices that are not the Next server:

- A stolen 7-day access token works until expiry or until `authVersion` changes. There is no per-device revoke.
- Do not send `X-Forwarded-For` from the app. Rate-limit identity must stay the connection address seen by the API.
- `OptionalJwtAuthGuard` treats a broken Bearer token as anonymous instead of 401. A client bug that sends `Bearer null` can silently look logged out on public GETs.
- Registration still creates a session before the email is confirmed. The app must gate writes on `user.emailVerified` and on 403, not only on “we have a token”.

No new payment, escrow, or KYC surface should be added for mobile. Phone OTP, company registry, and identity documents already exist under `/api/verification` and `/api/farms/me/documents` and stay on the website until a later release.

## 12. Performance & Pagination

These reads are unbounded `findMany` (no `take`):

- `ProductsService.catalog` and `listMine`
- `FarmsService.list`
- `PurchaseRequestsService.listOpen` and `listMine`
- `ChatService.listMine`
- `ChatService.getById` (all messages)

`GET /api/notifications` is capped at 100. That cap is the only list limit in the MVP surface.

At the current public catalog size this is acceptable for a first client. It becomes a mobile problem when a thread or the catalog grows: one JSON payload, no incremental loading, and chat marks the whole thread read on every fetch. Cursor pagination would be an API addition. It is not justified as a blocker before the app exists.

Images are ordinary HTTPS files with `Cache-Control: public, max-age=86400` on the local upload controller. The app can use a normal image cache. HTML pages on the website are `no-store` because of the cookie session; that does not apply to the JSON API.

## 13. Mobile Compatibility Risks

| Risk | Why it shows up on mobile | What to do in the client |
| --- | --- | --- |
| Website login hides the JWT | BFF returns `{ user }` only | Call Nest `/api/auth/*` |
| Relative `/api/uploads` | Web rewrite is not on the phone | Prefix the API host; keep absolute CDN URLs |
| Notification `href` | Paths assume the Next router | Map `type` + `href`; do not require a WebView |
| Password-reset email | Link is `{origin}/{locale}/reset-password?token=` | Universal link, or finish reset on the website, then `POST /api/auth/login` |
| No refresh token | 7-day JWT | Store it securely; on 401 go to login |
| No push | Web polls | Poll unread counts; do not wait for APNs |
| English API errors | Copy is not `messages/*.json` | Localize known messages in the app |
| `role` at register | Still required, even though both roles can trade | Send `farmer` or `buyer`; do not invent a third role |
| Chat ids named farmer/buyer | Slot names, not account type | Pass the other user’s id as `farmerId` when the buyer opens a request thread |
| Unbounded lists | Fine at today’s volume | Do not request admin-sized histories; revisit before growth |
| `forbidNonWhitelisted` | Extra JSON keys are 400 | Send only documented fields |
| Multipart field name | Must be `file` | Match the interceptor |

None of these require a backend change to ship the first client.

## 14. Endpoint Readiness Matrix

Prefixes are the Nest global prefix `/api`.

### READY

The route is JSON (or a deliberate `{ ok: true }`), Bearer works where a session is required, and a native client can call it without reshaping the payload.

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/reset-password`
- `POST /auth/change-password`
- `POST /verification/email/send-code`
- `POST /verification/email/confirm`
- `GET /legal/documents/current`
- `GET /legal/me`
- `GET /categories`
- `POST /products/:id/views`
- `POST /products`
- `PATCH /products/:id`
- `DELETE /products/:id`
- `GET /products/:id/watch`
- `POST /products/:id/watch`
- `DELETE /products/:id/watch`
- `GET /purchase-requests/mine`
- `GET /purchase-requests/my-quotes`
- `POST /purchase-requests`
- `GET /purchase-requests/:id`
- `POST /purchase-requests/:id/cancel`
- `POST /purchase-requests/:id/close`
- `POST /purchase-requests/:id/quotes`
- `POST /purchase-requests/:id/quotes/:quoteId/accept`
- `POST /purchase-requests/:id/quotes/:quoteId/decline`
- `POST /purchase-requests/:id/quotes/:quoteId/withdraw`
- `GET /cabinet/overview`
- `PATCH /cabinet/me/profile`
- `PATCH /cabinet/me/locale`
- `POST /cabinet/me/email/request`
- `POST /cabinet/me/email/confirm`
- `GET /health`

Count: **33**.

### READY WITH MINOR CHANGES

The route is usable. The client must resolve media URLs, tolerate a full array, poll, or interpret a website path. No server change is required for the MVP.

- `POST /auth/forgot-password` — body is `{ ok: true }`; the token arrives only in the website email link.
- `GET /products` — full catalog array; image URLs may be relative.
- `GET /products/:id` — same media rule; unpublished rows are 404 for guests.
- `GET /products/mine` — same media rule; includes drafts and pending.
- `GET /products/watches` — same media rule.
- `POST /products/:id/images`
- `DELETE /products/:id/images/:imageId`
- `PATCH /products/:id/images/:imageId/primary`
- `GET /farms`
- `GET /farms/:id`
- `GET /farms/me`
- `POST /farms`
- `PATCH /farms/me`
- `POST /farms/me/photos`
- `DELETE /farms/me/photos/:photoId`
- `PATCH /farms/me/photos/:photoId/primary`
- `GET /purchase-requests` — full open list, no cursor.
- `GET /conversations`
- `GET /conversations/unread-count`
- `POST /conversations`
- `GET /conversations/:id` — entire history, polling instead of a socket.
- `POST /conversations/:id/messages`
- `GET /notifications`
- `GET /notifications/unread-count`
- `POST /notifications/read-all`
- `POST /notifications/read-types`
- `POST /notifications/:id/read`
- `POST /cabinet/me/avatar`
- `DELETE /cabinet/me/avatar`

Count: **29**.

### NEEDS API CHANGE

Count: **0**.

No current MVP route is unusable from a native client. The follow-ups in section 15 are improvements, not gaps that block the first app. They are listed there so they are not mistaken for required work.

### NOT NEEDED FOR MOBILE MVP

- Admin, 20 routes on `AdminController`: `stats`, product queue and approve/reject, users block/unblock, farm approve/reject, document approve/reject, certificate approve/reject, purchase-request moderation, `deals`, category enablement.
- Product RFQ, 12 routes on `RfqsController`: create, mine, inbox, completed, unread-count, get, delete, offer, accept, decline, cancel, complete.
- Verification beyond email, 6 routes: `GET /verification/me`, phone send/confirm, `seller-type`, `company/registry`, `private/submit`.
- Farm verification files, 4 routes: `GET/POST /farms/me/documents`, `DELETE /farms/me/documents/:documentId`, `GET /farms/documents/:documentId/file`.
- Product video, 2 routes: `POST /products/:id/videos`, `DELETE /products/:id/videos/:videoId`.
- Product certificates, 3 routes: upload, delete, authorized file download.
- `GET /products/:id/market-insight`.
- `GET/PUT /subscriptions/alerts`.
- `GET /places/autocomplete` (the website uses it as typing help; `originPlace` is still a plain string).
- `GET /users/:id`.
- Ratings, 3 routes: `POST /ratings`, `GET /users/:id/rating`, `GET /users/:id/ratings`.
- `POST /support`.
- Account deletion, 2 routes: `POST /cabinet/me/delete/request`, `POST /cabinet/me/delete/confirm`.

Count: **58**.

That is every Nest route except four public file GETs on `UploadsController` (`/api/uploads/products/...`, `/api/uploads/users/...`, `/api/uploads/farms/.../photos/...`, and the certificate path that always 404s). Those are image hosting, not app actions. 33 + 29 + 58 + 4 = 124 controller routes.

## 15. Required API Changes Before Mobile MVP

None. A client can implement the MVP in section 16 against the current Nest API.

Do not schedule the following as pre-work. They become relevant only after the client exists and a measured limit is hit. Each one can be added without a new backend. The website keeps working if the additions are optional fields or new routes.

| Later change | Why it is not required now | Smallest future change | Web impact |
| --- | --- | --- | --- |
| Refresh token | 7-day Bearer plus re-login matches an MVP | New `POST /api/auth/refresh` that rotates `ver` or a separate refresh secret | None if login still returns `accessToken` |
| Absolute media URLs | Client can prefix the API host | Emit absolute URLs from `storedObjectUrl` when a public origin is configured | Web already accepts absolute CDN URLs and rewrites relative `/api/uploads` |
| Cursor lists | Tens of products, short threads | Optional `cursor` + `limit` whose absence keeps today’s array | None if the default response stays an array |
| Structured notification target | `type` + `href` is enough to route | Optional `requestId` / `conversationId` next to `href` | None if `href` stays |
| Push | Web already polls | Later device-token table and a sender | None |

## 16. Recommended Mobile MVP Scope

One app, one account, both sides of the market. Consume `/api` only.

1. Register, login, `GET /auth/me`, secure token storage, 401 handling.
2. Email code send/confirm before any write.
3. Terms from `GET /legal/documents/current` during register (`ka` or `en`).
4. Forgot / reset password using the existing email link and `POST /auth/reset-password`, then login.
5. Catalog, product detail, farm detail. Harvest filters, sold-out, preorder, in-season.
6. HarvestWatch on a product.
7. Create and edit a farm and products, including availability (`available`, `limited`, `soldOut`, `growing`, preorder) and photo upload.
8. Purchase Requests: browse open, create, mine, cancel, close.
9. Quotes: submit, my quotes, withdraw, accept, decline.
10. Chat on a purchase request where the API already allows it. Poll.
11. Notification list, unread badge, mark read. Route with `type` and `href`.
12. Profile: display name, locale, avatar, change password, request email change.

Show moderation state on the seller’s own products. Do not pretend a pending listing is public.

## 17. Explicitly Deferred Features

- Deal Workspace and any post-acceptance deal object. Not in the API.
- Payments, escrow, logistics booking.
- KYC/KYB: phone OTP, registry check, identity documents, certificate files.
- Admin and moderation tools.
- Product RFQ (`/api/rfqs`) and RFQ completion.
- Product video, market insight, places autocomplete.
- Category/region alert subscriptions (`/api/subscriptions/alerts`).
- Public user profiles and the ratings UI. Seller rating may already appear inside product/farm payloads; do not build a profile/reviews destination.
- Support form and account deletion.
- Push notifications, WebSockets, offline sync, a second backend.
- Store listing on Google Play or the App Store. This audit does not cover store metadata.

## 18. Recommended Implementation Order

Build the client in this order. Do not open an API-changing PR first.

1. HTTP client: Bearer, validation errors, 401, 429 `Retry-After`, media URL resolver, no `X-Forwarded-For`.
2. Auth and email verification, including the terms version fetch.
3. Password reset hand-off and change-password.
4. Read-only catalog, product, farm.
5. Seller farm and product editor, photos, availability.
6. Purchase Requests and Quotes.
7. Chat polling.
8. Notification center.
9. Profile, locale, avatar.

Shared types should come from `packages/shared` or a generated copy of those types. Do not fork the JSON shapes in the app.

## 19. Risks / Blockers

Blockers for the MVP: **none in the API**.

Residual risks:

- Long-lived stolen tokens until the 7-day expiry or a password change.
- Chat and catalog payloads grow without a cursor. Revisit when lists are no longer small.
- Notification routing depends on website paths. A new `href` on the server will not deep-link until the app’s map is updated.
- API error text is English. A wrong mapping will show English or a generic failure.
- `docs/ARCHITECTURE.md` still says native apps are out of scope and describes RFQ as the primary flow. Implementers should follow this audit and the controllers, not that section, until the architecture note is updated on purpose.
- Password reset and other emails open the website. Until associated domains exist, those emails stay a browser step. That is acceptable for the MVP.
- Calling the Next BFF by mistake yields cookie sessions and no token.

## 20. Final Verdict

The current AgroBridge API is ready for a native MVP that uses Bearer tokens and the existing Purchase Request, Quote, catalog, chat, and notification routes.

Do not build a parallel backend. Do not change production auth, pagination, or uploads before the client needs a measured improvement. The first implementation work belongs in the mobile client, against `https://<api-host>/api`, with the website left as it is.

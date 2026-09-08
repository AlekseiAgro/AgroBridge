# Rate limiting and verification-code protection

This document describes the abuse protection around authentication, verification codes and
the support form, and the configuration it needs in production.

## Threat model

Verification codes are six digits, so the code space is 900,000. Nothing about HTTP rate
limiting alone makes that safe — a code that survives thousands of guesses inside its
10-minute lifetime is guessable. The protection therefore combines four independent layers:

1. a finite number of guesses per verification challenge (the important one);
2. only one usable challenge per account and channel at a time;
3. a small budget of new codes per account, per channel and per address;
4. IP- and account-aware limits on login, registration, confirmation and support.

## Where the counters live

Counters are rows in the Postgres table `rate_limit_counters`, and the per-challenge attempt
count is a column on `verification_codes`.

Postgres, not Redis, for three reasons:

- **No new failure mode.** Every protected endpoint already reads or writes user rows, so a
  database outage stops those requests anyway. There is no state in which the limiter is
  down but login still works, which is exactly the fail-open case to avoid for
  brute-force protection.
- **Correct across replicas and restarts.** An in-memory limiter would multiply every limit
  by the number of API instances and reset on each deploy. `REDIS_URL` is provisioned in the
  compose files but no Redis client is installed; adding one would make security depend on a
  component that today is optional and unmonitored.
- **Cheap at this volume.** Only auth, verification and support traffic is counted, and each
  check is a single indexed upsert.

Every counter update is a single `INSERT ... ON CONFLICT DO UPDATE`, which Postgres
serialises on the conflicting row. Concurrent requests can therefore never read the same
count twice, which is what stops a burst of parallel guesses from slipping past the limit.

If Postgres is unavailable the limiter throws and the request fails — closed, not open.

## Counter keys

Keys are HMAC-SHA256 digests of the action plus the scope (address, normalised email,
account id, channel). The table never contains a readable email address or IP. The HMAC key
comes from `RATE_LIMIT_KEY_SECRET`, falling back to `JWT_SECRET`.

Emails are lower-cased and trimmed before hashing, so `A@x.io` and ` a@x.io ` share a bucket.
IPv4-mapped IPv6 addresses (`::ffff:1.2.3.4`) are folded onto the plain IPv4 form.

## Client address and `TRUST_PROXY`

`X-Forwarded-For` is attacker-controlled. Only the entries appended by proxies we run may be
trusted, so the API sets Express' `trust proxy` explicitly.

Every rate-limited endpoint is reached through a Next.js BFF route handler, so the shape of
that one path is what matters:

```
browser → Cloudflare → Railway edge → web (Next.js)
                                       └─ private network → api
```

The web tier resolves the visitor from `CF-Connecting-IP` (Cloudflare overwrites whatever
the client sent) and relays **one** address as `X-Forwarded-For`. The API believes it
because the request arrives from a private peer: Railway's private network uses `fd12::/16`
and, on dual-stack environments, `10.0.0.0/8`; Compose uses its bridge network. Hence the
production default `loopback,linklocal,uniquelocal` — a trust *list*, not a hop count, since
the count varies while the peer range does not.

This is what `API_INTERNAL_URL` is for. Point the web tier at the public API hostname
instead and the request re-enters through Cloudflare and the Railway edge, the peer becomes
public, the relayed address is discarded, and every visitor collapses into a single bucket.

| Deployment | Correct value |
|---|---|
| Local development (no proxy) | `0` (default) |
| `docker-compose.prod.yml` behind `deploy/Caddyfile` | default |
| Cloudflare proxying (orange cloud) in front of Caddy | default |
| Railway with `API_INTERNAL_URL` set to the private address | default |

`TRUST_PROXY` accepts either a hop count (`1`) or a comma-separated list of keywords and
addresses (`loopback,uniquelocal,203.0.113.7`), and the API refuses to start on a malformed
value or on one that matches every address (`0.0.0.0/0`, `::/0`). Trusting too little only
makes limits stricter (several clients share a bucket); trusting too much lets a client
forge its own address. Account-scoped protections do not depend on the address at all, so a
misconfigured value can never disable the verification-code attempt cap.

Requests sent straight to the public API hostname keep resolving to the Railway edge rather
than to the caller. That is the safe direction — nobody can claim someone else's address —
and it costs nothing today because the browser only ever reaches those endpoints through
the BFF, while the per-account limits that stop guessing apply either way.

Spoofing is covered on both hops. A client that sends its own `X-Forwarded-For` or
`CF-Connecting-IP` is overwritten by Cloudflare and ignored by `visitorAddressOf` in
`apps/web/src/lib/client-address.ts`, which reads only headers a proxy wrote. A client that
reaches the API directly cannot be a private peer, so nothing it forwards is read.

The boot log prints the effective trust setting and the effective limits.

## Limits

Defaults are chosen so a human who mistypes a password or asks for a second code is never
locked out, while automated guessing dies immediately. Windows are fixed, not sliding.

| Endpoint / action | Default limit | Key |
|---|---|---|
| `POST /api/auth/login` | 5 per 15 min | IP + normalised email |
| `POST /api/auth/login` (spray guard) | 30 per 15 min | IP |
| `POST /api/auth/register` | 10 per hour | IP |
| Any code send (`verification/*/send-code`, `cabinet/me/email/request`, `cabinet/me/delete/request`, registration) | 1 per 60 s | account + channel |
| Any code send | 3 per hour | account + channel |
| Any code send | 10 per hour | IP |
| Any code confirm (`verification/*/confirm`, `cabinet/me/*/confirm`) | 10 per 15 min | account + channel |
| Any code confirm | 30 per 15 min | IP |
| Failed guesses per verification challenge | 5 | the challenge row |
| `POST /api/support` | 5 per 15 min | IP |
| `POST /api/support` | 10 per hour | normalised email |

A successful login clears the IP+email counter; a successful confirmation clears the
account confirmation counter. The wide per-IP counters are never cleared by a success, so
owning one valid account does not buy a fresh spraying budget.

Every limit is overridable through `RATE_LIMIT_*_MAX` and `RATE_LIMIT_*_WINDOW_SEC`
environment variables (see `apps/api/.env.example`). Values are validated at boot against a
hard ceiling, so a typo cannot silently switch a protection off, and
`RATE_LIMIT_CODE_MAX_ATTEMPTS` can never exceed 10.

## Verification-code lifecycle

- A new code invalidates any earlier unconsumed code for the same account and channel
  (`verification_codes.invalidatedAt`), so exactly one challenge is guessable at a time and
  an old code stops working the moment a new one is issued.
- Codes live for 10 minutes and are stored as SHA-256 hashes; the plaintext exists only in
  the outgoing email or SMS.
- Each guess atomically increments `verification_codes.attempts` and is rejected once the
  cap is reached — including a guess that happens to be correct. The caller is then told to
  request a new code.
- Consumption is a conditional update on `consumedAt IS NULL`, so a code can be redeemed
  exactly once even if several requests arrive simultaneously.
- Codes are compared in constant time.

## Responses

An exhausted limit produces `429 Too Many Requests` with a `Retry-After` header and a
deliberately generic body:

```json
{ "statusCode": 429, "error": "Too Many Requests", "message": "Too many attempts. Try again later.", "retryAfterSeconds": 812 }
```

The message never says which counter tripped, so a 429 cannot be used to test whether an
email belongs to an existing account.

## Logging

Verification codes are never written to logs. The console mail and SMS drivers print message
bodies for local development only; when `NODE_ENV=production` they log the recipient and
subject and omit the body.

## Tests

- `apps/api/src/rate-limit/prisma-rate-limit.store.integration.spec.ts` — atomicity of the
  counter under 25 parallel requests, window reset, persistence across instances.
- `apps/api/src/verification/verification-code.service.integration.spec.ts` — full code
  lifecycle, attempt cap under 40 parallel guesses, replay, expiry, supersession.
- `apps/api/src/rate-limit/rate-limit.http.spec.ts` — 429 body/headers and
  `X-Forwarded-For` handling with and without a trusted proxy.
- `apps/api/src/rate-limit/rate-limit.service.spec.ts`, `.../http/client-ip.spec.ts`,
  `.../mail/mail.service.spec.ts`, `.../sms/sms.service.spec.ts`.

The two integration suites need a Postgres instance. Point `TEST_DATABASE_URL` at a
throwaway database (`DATABASE_URL` is used as a fallback); without one they skip with a
warning instead of failing:

```bash
TEST_DATABASE_URL=postgresql://agrobridge:agrobridge@localhost:5432/agrobridge_test \
  pnpm --filter @agrobridge/api test
```

`scripts/verify-bff-client-ip.sh` checks the deployed topology end to end — two visitors
through the BFF, spoofing attempts, code sending, authenticated routes — against a running
web and API pair. Run it after a deploy that changes anything about proxies or
`API_INTERNAL_URL`; the counter-key assertions need database access and the API's
`JWT_SECRET`:

```bash
WEB=https://agrobridge.ge API=https://api.agrobridge.ge scripts/verify-bff-client-ip.sh
```

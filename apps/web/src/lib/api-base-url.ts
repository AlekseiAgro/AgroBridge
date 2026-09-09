/**
 * Base URL the Next.js server uses to reach the API. Never import this from a client
 * component: `API_INTERNAL_URL` is a server-only variable and must not reach the browser.
 *
 * `NEXT_PUBLIC_API_URL` is compiled into the browser bundle, so it has to stay the public
 * origin. Server-side calls use `API_INTERNAL_URL` when it is set — on Railway the service's
 * `*.railway.internal` address, in Compose the `api` service name.
 *
 * This exists for rate limiting rather than for latency. Reaching the API through its public
 * hostname sends the request back out through Cloudflare and the Railway edge, so the API
 * sees infrastructure as its peer and cannot believe the visitor address the BFF relays —
 * every visitor then lands in one bucket. Over the private network the peer is an address
 * only our own infrastructure can hold, which is exactly what the API's `TRUST_PROXY`
 * setting trusts.
 */
const INTERNAL_URL = process.env.API_INTERNAL_URL?.trim();

const SERVER_API_URL =
  INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

// Falling back in production is a silent security regression, so say so at boot. The build
// runs this module too, where the variable is legitimately absent (it is read at runtime).
if (
  !INTERNAL_URL &&
  process.env.NODE_ENV === 'production' &&
  process.env.NEXT_PHASE !== 'phase-production-build'
) {
  console.warn(
    '[api] API_INTERNAL_URL is not set: server-side calls go through the public API URL, ' +
      'so the API cannot tell visitors apart and rate limits apply to everyone at once.',
  );
}

export function serverApiUrl(): string {
  return SERVER_API_URL;
}

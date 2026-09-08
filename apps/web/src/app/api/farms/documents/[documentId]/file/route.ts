import { getAuthToken } from '@/lib/auth-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

/** Headers worth forwarding from the API response to the browser. */
const FORWARDED_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
  'x-content-type-options',
  'referrer-policy',
];

type Params = { params: Promise<{ documentId: string }> };

/**
 * Farm verification documents are private, so the browser cannot fetch them from the API
 * directly: the auth token lives in an httpOnly cookie. This proxies the download with a
 * Bearer token; the API still decides whether the caller owns the farm or is an admin.
 */
export async function GET(_request: Request, { params }: Params) {
  const { documentId } = await params;
  const token = await getAuthToken();
  if (!token) {
    return new Response(null, { status: 401 });
  }

  const upstream = await fetch(
    `${API_URL}/farms/documents/${encodeURIComponent(documentId)}/file`,
    {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    },
  );

  if (!upstream.ok || !upstream.body) {
    return new Response(null, { status: upstream.ok ? 502 : upstream.status });
  }

  const headers = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      headers.set(name, value);
    }
  }
  headers.set('Cache-Control', 'private, no-store, max-age=0');

  return new Response(upstream.body, { status: 200, headers });
}

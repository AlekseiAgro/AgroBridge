/**
 * Server-only helpers for proxying farm verification documents through the Web BFF.
 * The upstream URL is always a fixed path on `API_INTERNAL_URL`; callers must never
 * pass a free-form URL (SSRF).
 */

export const FARM_DOCUMENT_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isFarmDocumentId(value: string): boolean {
  return FARM_DOCUMENT_ID_RE.test(value);
}

export function farmDocumentUpstreamPath(documentId: string): string {
  return `/farms/documents/${encodeURIComponent(documentId)}/file`;
}

const FORWARDED_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
  'x-content-type-options',
  'referrer-policy',
] as const;

type ProxyParams = {
  documentId: string;
  token: string | null;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
};

/**
 * Forwards an authenticated browser download to the API. `apiBaseUrl` must come from
 * `serverApiUrl()` (API_INTERNAL_URL); it is never taken from the request.
 */
export async function proxyFarmDocumentFile(params: ProxyParams): Promise<Response> {
  if (!isFarmDocumentId(params.documentId)) {
    return Response.json({ statusCode: 404, message: 'Not found' }, { status: 404 });
  }

  if (!params.token) {
    return Response.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
  }

  const base = params.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}${farmDocumentUpstreamPath(params.documentId)}`;
  const fetchImpl = params.fetchImpl ?? fetch;

  const upstream = await fetchImpl(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${params.token}` },
    cache: 'no-store',
  });

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

/**
 * Server-only helpers for proxying product certificate files through the Web BFF.
 * The upstream URL is always a fixed path on `API_INTERNAL_URL`; callers must never
 * pass a free-form URL (SSRF).
 */

export const PRODUCT_CERTIFICATE_ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

export function isProductCertificateId(value: string): boolean {
  return PRODUCT_CERTIFICATE_ID_RE.test(value);
}

export function productCertificateUpstreamPath(
  productId: string,
  certificateId: string,
): string {
  return `/products/${encodeURIComponent(productId)}/certificates/${encodeURIComponent(certificateId)}/file`;
}

const FORWARDED_HEADERS = [
  'content-type',
  'content-disposition',
  'content-length',
  'x-content-type-options',
  'referrer-policy',
  'cache-control',
] as const;

type ProxyParams = {
  productId: string;
  certificateId: string;
  token: string | null;
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
};

/**
 * Forwards a browser download to the API. Approved public certificates may be
 * fetched without a token; pending/rejected files require the httpOnly cookie.
 * `apiBaseUrl` must come from `serverApiUrl()`; it is never taken from the request.
 */
export async function proxyProductCertificateFile(params: ProxyParams): Promise<Response> {
  if (
    !isProductCertificateId(params.productId) ||
    !isProductCertificateId(params.certificateId)
  ) {
    return Response.json({ statusCode: 404, message: 'Not found' }, { status: 404 });
  }

  const base = params.apiBaseUrl.replace(/\/$/, '');
  const url = `${base}${productCertificateUpstreamPath(params.productId, params.certificateId)}`;
  const fetchImpl = params.fetchImpl ?? fetch;
  const headers = new Headers();
  if (params.token) {
    headers.set('Authorization', `Bearer ${params.token}`);
  }

  const upstream = await fetchImpl(url, {
    method: 'GET',
    headers,
    cache: 'no-store',
  });

  if (!upstream.ok || !upstream.body) {
    const status = upstream.status === 401 && !params.token ? 401 : upstream.ok ? 502 : upstream.status;
    if (status === 401) {
      return Response.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 });
    }
    return new Response(null, { status });
  }

  const out = new Headers();
  for (const name of FORWARDED_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) {
      out.set(name, value);
    }
  }
  out.set('Cache-Control', 'private, no-store, max-age=0');

  return new Response(upstream.body, { status: 200, headers: out });
}

import { resolveApiBaseUrl } from './config';

/**
 * Resolves product and farm media for a native client.
 * `/api/uploads/...` is served by the API, not by the website rewrite.
 * Absolute http(s) URLs, including CDN URLs, stay unchanged.
 * Protocol-relative URLs are left unchanged so they are not prefixed with the API host.
 */
export function resolveMediaUrl(url: string | null | undefined, apiBaseUrl: string): string | null {
  if (!url) {
    return null;
  }
  const trimmed = url.trim();
  if (!trimmed) {
    return null;
  }
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('//')) {
    return trimmed;
  }
  if (trimmed === '/api/uploads' || trimmed.startsWith('/api/uploads/')) {
    const base = resolveApiBaseUrl(apiBaseUrl);
    const origin = base.endsWith('/api') ? base.slice(0, -'/api'.length) : base;
    return `${origin}${trimmed}`;
  }
  return trimmed;
}

import { isLocale } from '@agrobridge/shared';

/**
 * Pathname for next-intl Link `href` when changing UI locale.
 * Strips a leading locale segment so `/de/catalog` does not become `/ka/de/catalog`.
 */
export function localeSwitchPathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  const normalized = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const segments = normalized.split('/').filter(Boolean);
  if (segments[0] && isLocale(segments[0])) {
    const rest = segments.slice(1);
    return rest.length === 0 ? '/' : `/${rest.join('/')}`;
  }

  return normalized;
}

/** Combines the current un-prefixed path with the current query string. */
export function localeSwitchHref(pathname: string, search = ''): string {
  const path = localeSwitchPathname(pathname);
  const query = search.startsWith('?') ? search.slice(1) : search;
  if (!query) {
    return path;
  }
  return `${path}?${query}`;
}

import { localeSwitchHref } from './locale-switch-href';
import { safeNextPath } from './safe-next-path';

export const REQUEST_PATHNAME_HEADER = 'x-agrobridge-pathname';
export const REQUEST_SEARCH_HEADER = 'x-agrobridge-search';

/** Locale-stripped same-app path used as the post-auth `next` destination. */
export function protectedNextFromRequest(
  pathname: string | null | undefined,
  search: string | null | undefined,
  fallback = '/account',
): string {
  if (!pathname) {
    return safeNextPath(fallback, '/account');
  }
  return safeNextPath(localeSwitchHref(pathname, search ?? ''), fallback);
}

export function loginRedirectHref(nextPath: string): string {
  return `/login?next=${encodeURIComponent(nextPath)}`;
}

export function verifyEmailRedirectHref(nextPath: string): string {
  return `/verify-email?next=${encodeURIComponent(nextPath)}`;
}

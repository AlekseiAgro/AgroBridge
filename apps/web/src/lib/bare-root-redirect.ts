import { isLocale } from '@agrobridge/shared';

/**
 * Bare `/` landing locale when no valid NEXT_LOCALE cookie is present.
 * Explicit locale prefixes (`/en`, `/ru`, …) are not rewritten here.
 */
export const BARE_ROOT_LANDING_LOCALE = 'ka';
export const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';

export function bareRootRedirectPath(
  pathname: string,
  cookieLocale?: string | null,
): string | null {
  if (pathname !== '/') {
    return null;
  }

  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : BARE_ROOT_LANDING_LOCALE;
  return `/${locale}`;
}

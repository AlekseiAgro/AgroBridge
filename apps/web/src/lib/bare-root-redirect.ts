/**
 * Unprefixed `/` always lands on Georgian.
 * Explicit locale prefixes (`/en`, `/ru`, …) are not rewritten here.
 */
export const BARE_ROOT_LANDING_PATH = '/ka';

export function bareRootRedirectPath(pathname: string): string | null {
  return pathname === '/' ? BARE_ROOT_LANDING_PATH : null;
}

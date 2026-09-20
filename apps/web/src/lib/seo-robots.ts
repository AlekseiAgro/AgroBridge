import type { Metadata } from 'next';
import { LOCALES } from '@agrobridge/shared';

/** Canonical production origin for crawler-facing files. */
export const PRODUCTION_WEB_ORIGIN = 'https://agrobridge.ge';

export const PRODUCTION_SITEMAP_URL = `${PRODUCTION_WEB_ORIGIN}/sitemap.xml`;

export const noindexRobots = {
  index: false,
  follow: false,
} as const satisfies Metadata['robots'];

/**
 * Path suffixes after `/{locale}` that must not be crawled.
 * Only families that exist in `app/[locale]`.
 */
export const ROBOTS_DISALLOW_SUFFIXES = [
  '/dashboard',
  '/account',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/requests/new',
] as const;

export function robotsDisallowPaths(): string[] {
  return LOCALES.flatMap((locale) =>
    ROBOTS_DISALLOW_SUFFIXES.map((suffix) => `/${locale}${suffix}`),
  );
}

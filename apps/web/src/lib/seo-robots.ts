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
 * Auth/recovery pages are omitted so crawlers can fetch their noindex meta.
 * Only families that exist in `app/[locale]`.
 */
export const ROBOTS_DISALLOW_SUFFIXES = [
  '/dashboard',
  '/account',
  '/requests/new',
] as const;

export const AUTH_CRAWLABLE_NOINDEX_SUFFIXES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
] as const;

export function robotsDisallowPaths(): string[] {
  return LOCALES.flatMap((locale) =>
    ROBOTS_DISALLOW_SUFFIXES.map((suffix) => `/${locale}${suffix}`),
  );
}

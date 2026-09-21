import { DEFAULT_LOCALE } from '@agrobridge/shared';
import { hasLocale } from 'next-intl';
import { getLocale } from 'next-intl/server';
import { headers } from 'next/headers';
import { routing } from '@/i18n/routing';

export async function resolveRequestLocale(fallback: string = DEFAULT_LOCALE) {
  const candidates: Array<string | undefined> = [];

  try {
    candidates.push(await getLocale());
  } catch {
    // Root 404 can render outside a locale segment.
  }

  try {
    candidates.push((await headers()).get('x-next-intl-locale') ?? undefined);
  } catch {
    // Headers can be unavailable during some static renders.
  }

  for (const locale of candidates) {
    if (locale && hasLocale(routing.locales, locale)) {
      return locale;
    }
  }

  return hasLocale(routing.locales, fallback) ? fallback : DEFAULT_LOCALE;
}

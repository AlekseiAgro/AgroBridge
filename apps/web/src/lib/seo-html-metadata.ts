import type { Metadata } from 'next';
import { isLocale, type Locale } from '@agrobridge/shared';
import { localeSwitchPathname } from './locale-switch-href';
import { AUTH_CRAWLABLE_NOINDEX_SUFFIXES, ROBOTS_DISALLOW_SUFFIXES } from './seo-robots';
import {
  STATIC_PUBLIC_PATHS,
  isPublicRecordId,
  languageAlternates,
  localizedPublicUrl,
} from './seo-sitemap';

const PUBLIC_RECORD_PATH = /^\/(products|farms|requests)\/([^/]+)$/;

/** Locale-stripped path suffix used by sitemap/HTML SEO helpers. Home is `''`. */
export function publicPathSuffixFromPathname(pathname: string | null | undefined): string | null {
  if (!pathname) return null;
  const stripped = localeSwitchPathname(pathname);
  if (stripped === '/') return '';
  return stripped.startsWith('/') ? stripped : `/${stripped}`;
}

export function isPrivateOrNoindexSuffix(suffix: string): boolean {
  if (
    ROBOTS_DISALLOW_SUFFIXES.some(
      (prefix) => suffix === prefix || suffix.startsWith(`${prefix}/`),
    )
  ) {
    return true;
  }
  return AUTH_CRAWLABLE_NOINDEX_SUFFIXES.some(
    (prefix) => suffix === prefix || suffix.startsWith(`${prefix}/`),
  );
}

export function isPublicIndexableSuffix(suffix: string): boolean {
  if (isPrivateOrNoindexSuffix(suffix)) return false;
  if ((STATIC_PUBLIC_PATHS as readonly string[]).includes(suffix)) return true;

  const match = suffix.match(PUBLIC_RECORD_PATH);
  if (!match) return false;
  return isPublicRecordId(match[2]);
}

export function publicPageHtmlMetadata(
  locale: string,
  pathname: string | null | undefined,
): Pick<Metadata, 'alternates'> | null {
  if (!isLocale(locale)) return null;
  const suffix = publicPathSuffixFromPathname(pathname);
  if (suffix === null || !isPublicIndexableSuffix(suffix)) return null;

  return {
    alternates: {
      canonical: localizedPublicUrl(locale as Locale, suffix),
      languages: languageAlternates(suffix),
    },
  };
}

export const LEGAL_SITE_URL = 'https://agrobridge.ge';
export const LEGAL_UPDATED_ISO = '2026-09-08';

export const LEGAL_DOC_SLUGS = ['privacy', 'terms', 'cookies', 'rules'] as const;
export type LegalDocSlug = (typeof LEGAL_DOC_SLUGS)[number];

export function isLegalDocSlug(value: string): value is LegalDocSlug {
  return (LEGAL_DOC_SLUGS as readonly string[]).includes(value);
}

/** Session cookie set by the Next.js BFF after login/register. */
export const AUTH_COOKIE_NAME = 'agrobridge_token';

/** Locale preference cookie set by next-intl. */
export const LOCALE_COOKIE_NAME = 'NEXT_LOCALE';

/** localStorage key for the essential-cookies notice. */
export const COOKIE_NOTICE_STORAGE_KEY = 'agrobridge_cookie_notice_ack';

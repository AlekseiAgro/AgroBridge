/**
 * Optional (advertising) cookie consent. Necessary cookies such as
 * `agrobridge_token` and `NEXT_LOCALE` are not covered by this choice.
 *
 * Kept free of imports so `node --test` can load it directly.
 */

export const COOKIE_CONSENT_COOKIE = 'agrobridge_cookie_consent';

/**
 * Bump when the set of optional cookies changes materially; older stored
 * choices are then ignored and visitors are asked again.
 */
export const COOKIE_CONSENT_VERSION = 1;

/** 180 days. */
export const COOKIE_CONSENT_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

export type AdvertisingConsent = 'granted' | 'denied';

const VALUE_PATTERN = /^v(\d+)\.(granted|denied)$/;

export function consentCookieValue(consent: AdvertisingConsent): string {
  return `v${COOKIE_CONSENT_VERSION}.${consent}`;
}

/** Reads the stored choice from a `document.cookie`-style string. */
export function parseAdvertisingConsent(
  cookieHeader: string | null | undefined,
): AdvertisingConsent | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) continue;
    if (part.slice(0, separator).trim() !== COOKIE_CONSENT_COOKIE) continue;
    let raw = part.slice(separator + 1).trim();
    try {
      raw = decodeURIComponent(raw);
    } catch {
      return null;
    }
    const match = VALUE_PATTERN.exec(raw);
    if (!match || Number(match[1]) !== COOKIE_CONSENT_VERSION) return null;
    return match[2] as AdvertisingConsent;
  }
  return null;
}

/** A `document.cookie` assignment string that stores the choice site-wide. */
export function serializeAdvertisingConsent(
  consent: AdvertisingConsent,
  options: { secure: boolean },
): string {
  const attributes = [
    `${COOKIE_CONSENT_COOKIE}=${consentCookieValue(consent)}`,
    'Path=/',
    `Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS}`,
    'SameSite=Lax',
  ];
  if (options.secure) attributes.push('Secure');
  return attributes.join('; ');
}

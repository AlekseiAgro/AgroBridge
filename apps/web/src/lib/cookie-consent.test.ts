import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  COOKIE_CONSENT_COOKIE,
  COOKIE_CONSENT_MAX_AGE_SECONDS,
  consentCookieValue,
  parseAdvertisingConsent,
  serializeAdvertisingConsent,
} from './cookie-consent.ts';

describe('advertising consent cookie', () => {
  it('has no choice when the cookie is missing', () => {
    assert.equal(parseAdvertisingConsent(''), null);
    assert.equal(parseAdvertisingConsent(undefined), null);
    assert.equal(parseAdvertisingConsent('NEXT_LOCALE=ka; agrobridge_token=abc'), null);
  });

  it('reads granted and denied among other cookies', () => {
    assert.equal(
      parseAdvertisingConsent(`NEXT_LOCALE=en; ${COOKIE_CONSENT_COOKIE}=v1.granted; x=1`),
      'granted',
    );
    assert.equal(parseAdvertisingConsent(`${COOKIE_CONSENT_COOKIE}=v1.denied`), 'denied');
  });

  it('ignores unknown values and other consent versions', () => {
    assert.equal(parseAdvertisingConsent(`${COOKIE_CONSENT_COOKIE}=granted`), null);
    assert.equal(parseAdvertisingConsent(`${COOKIE_CONSENT_COOKIE}=v0.granted`), null);
    assert.equal(parseAdvertisingConsent(`${COOKIE_CONSENT_COOKIE}=v2.denied`), null);
    assert.equal(parseAdvertisingConsent(`${COOKIE_CONSENT_COOKIE}=v1.maybe`), null);
    assert.equal(parseAdvertisingConsent(`${COOKIE_CONSENT_COOKIE}=%E0%A4%A`), null);
  });

  it('does not match a cookie whose name only ends with the consent name', () => {
    assert.equal(parseAdvertisingConsent(`x${COOKIE_CONSENT_COOKIE}=v1.granted`), null);
  });

  it('round-trips through the serialized cookie', () => {
    for (const consent of ['granted', 'denied'] as const) {
      const serialized = serializeAdvertisingConsent(consent, { secure: true });
      const [pair] = serialized.split('; ');
      assert.equal(pair, `${COOKIE_CONSENT_COOKIE}=${consentCookieValue(consent)}`);
      assert.equal(parseAdvertisingConsent(pair), consent);
    }
  });

  it('stores the choice site-wide for 180 days', () => {
    const serialized = serializeAdvertisingConsent('denied', { secure: true });
    assert.match(serialized, /; Path=\/;/);
    assert.match(serialized, new RegExp(`; Max-Age=${COOKIE_CONSENT_MAX_AGE_SECONDS};`));
    assert.equal(COOKIE_CONSENT_MAX_AGE_SECONDS, 180 * 24 * 60 * 60);
    assert.match(serialized, /; SameSite=Lax; Secure$/);
  });

  it('omits Secure on plain http (local development)', () => {
    assert.doesNotMatch(serializeAdvertisingConsent('granted', { secure: false }), /Secure/);
  });
});

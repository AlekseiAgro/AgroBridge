import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import {
  META_PIXEL_SCRIPT_SRC,
  claimRegistrationEvent,
  cookieDomainCandidates,
  isMetaPixelTrackableUrl,
  loadMetaPixel,
  normalizeMetaPixelId,
  revokeMetaPixel,
  trackMetaCompleteRegistration,
  trackMetaPageView,
} from './meta-pixel.ts';

describe('Meta Pixel ID', () => {
  it('accepts digits only and never falls back to a default', () => {
    assert.equal(normalizeMetaPixelId('4510117069202254'), '4510117069202254');
    assert.equal(normalizeMetaPixelId(' 4510117069202254 '), '4510117069202254');
    assert.equal(normalizeMetaPixelId(undefined), null);
    assert.equal(normalizeMetaPixelId(''), null);
    assert.equal(normalizeMetaPixelId('abc123'), null);
    assert.equal(normalizeMetaPixelId("1');alert(1)//"), null);
  });
});

describe('Meta Pixel trackable URLs', () => {
  it('tracks ordinary pages, with or without a query', () => {
    assert.equal(isMetaPixelTrackableUrl('/en', ''), true);
    assert.equal(isMetaPixelTrackableUrl('/ka/catalog', '?category=fruit'), true);
    assert.equal(isMetaPixelTrackableUrl('/en/verify-email', '?next=%2Faccount'), true);
  });

  it('skips the password-reset page, whose URL carries a one-time token', () => {
    assert.equal(isMetaPixelTrackableUrl('/en/reset-password', '?token=secret'), false);
    assert.equal(isMetaPixelTrackableUrl('/ru/reset-password', ''), false);
  });

  it('skips any URL with a token, code or email query parameter', () => {
    assert.equal(isMetaPixelTrackableUrl('/en/login', '?token=abc'), false);
    assert.equal(isMetaPixelTrackableUrl('/en/verify-email', '?code=123456'), false);
    assert.equal(isMetaPixelTrackableUrl('/en/register', '?email=a%40b.ge'), false);
  });
});

describe('registration event de-duplication', () => {
  function memoryStorage() {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
    };
  }

  it('claims an account once per browser', () => {
    const storage = memoryStorage();
    assert.equal(claimRegistrationEvent(storage, new Set(), 'user-1'), true);
    assert.equal(claimRegistrationEvent(storage, new Set(), 'user-1'), false);
    assert.equal(claimRegistrationEvent(storage, new Set(), 'user-2'), true);
  });

  it('still de-duplicates in memory when storage throws', () => {
    const memory = new Set<string>();
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    assert.equal(claimRegistrationEvent(broken, memory, 'user-1'), true);
    assert.equal(claimRegistrationEvent(broken, memory, 'user-1'), false);
  });

  it('refuses an empty account id', () => {
    assert.equal(claimRegistrationEvent(memoryStorage(), new Set(), ''), false);
  });
});

describe('cookie domains to clear', () => {
  it('covers the host and its parent domains', () => {
    assert.deepEqual(cookieDomainCandidates('agrobridge.ge'), ['', 'agrobridge.ge']);
    assert.deepEqual(cookieDomainCandidates('www.agrobridge.ge'), [
      '',
      'www.agrobridge.ge',
      'agrobridge.ge',
    ]);
  });

  it('uses host-only cookies for localhost and IP addresses', () => {
    assert.deepEqual(cookieDomainCandidates('localhost'), ['']);
    assert.deepEqual(cookieDomainCandidates('127.0.0.1'), ['']);
  });
});

describe('Meta Pixel runtime', () => {
  const PIXEL = '1234567890';
  let scripts: { src: string; async: boolean }[];
  let cookieWrites: string[];
  let stored: Map<string, string>;

  type TestFbq = {
    queue: unknown[][];
    disablePushState?: boolean;
    allowDuplicatePageViews?: boolean;
  };
  const fbq = () => (globalThis as unknown as { window: { fbq?: TestFbq } }).window.fbq;
  const calls = () => fbq()?.queue ?? [];

  before(() => {
    scripts = [];
    cookieWrites = [];
    stored = new Map();
    const g = globalThis as Record<string, unknown>;
    g.window = {
      location: { hostname: 'agrobridge.ge' },
      localStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
      },
    };
    g.document = {
      head: { appendChild: (node: { src: string; async: boolean }) => scripts.push(node) },
      createElement: () => ({ src: '', async: false }),
      set cookie(value: string) {
        cookieWrites.push(value);
      },
    };
  });

  it('sends nothing and loads no script before consent', () => {
    revokeMetaPixel();
    assert.equal(trackMetaPageView('/en', ''), false);
    assert.equal(trackMetaCompleteRegistration('user-1'), false);
    assert.equal(fbq(), undefined);
    assert.equal(scripts.length, 0);
  });

  it('after consent: loads the script once, disables auto config, then tracks', () => {
    loadMetaPixel(PIXEL);
    loadMetaPixel(PIXEL);
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].src, META_PIXEL_SCRIPT_SRC);
    assert.equal(scripts[0].async, true);
    assert.equal(fbq()?.disablePushState, true);
    assert.equal(fbq()?.allowDuplicatePageViews, true);
    assert.deepEqual(calls(), [
      ['set', 'autoConfig', false, PIXEL],
      ['init', PIXEL],
    ]);

    assert.equal(trackMetaPageView('/en', ''), true);
    assert.equal(trackMetaPageView('/en', ''), false, 'same URL twice is one PageView');
    assert.equal(trackMetaPageView('/en/catalog', ''), true, 'client-side navigation');
    assert.equal(trackMetaPageView('/en/reset-password', '?token=x'), false);
    assert.equal(trackMetaPageView('/en', ''), true, 'returning to a page counts again');

    assert.equal(trackMetaCompleteRegistration('user-1'), true);
    assert.equal(trackMetaCompleteRegistration('user-1'), false, 'no duplicate');

    assert.deepEqual(calls().slice(2), [
      ['track', 'PageView'],
      ['track', 'PageView'],
      ['track', 'PageView'],
      ['track', 'CompleteRegistration'],
    ]);
  });

  it('sends no personal data with CompleteRegistration', () => {
    const registration = calls().find((call) => call[1] === 'CompleteRegistration');
    assert.deepEqual(registration, ['track', 'CompleteRegistration']);
    assert.ok(!JSON.stringify(calls()).includes('user-1'));
  });

  it('after withdrawal: revokes, clears Pixel cookies and sends nothing more', () => {
    const start = calls().length;
    revokeMetaPixel();
    assert.deepEqual(calls().slice(start), [['consent', 'revoke']]);
    for (const name of ['_fbp', '_fbc']) {
      assert.ok(cookieWrites.includes(`${name}=; Path=/; Max-Age=0`));
      assert.ok(cookieWrites.includes(`${name}=; Path=/; Max-Age=0; Domain=agrobridge.ge`));
    }
    assert.equal(trackMetaPageView('/en/farms', ''), false);
    assert.equal(trackMetaCompleteRegistration('user-2'), false);
    assert.equal(calls().length, start + 1);
  });

  it('re-granting in the same page grants consent instead of initialising twice', () => {
    const start = calls().length;
    loadMetaPixel(PIXEL);
    assert.deepEqual(calls().slice(start), [['consent', 'grant']]);
    assert.equal(trackMetaPageView('/en/farms', ''), true);
  });
});

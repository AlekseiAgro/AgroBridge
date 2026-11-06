import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  claimRegistrationEvent,
  cookieDomainCandidates,
  discardQueuedEvents,
  isMetaPixelSafeReferrer,
  isMetaPixelTrackableUrl,
  normalizeMetaPixelId,
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
    assert.equal(isMetaPixelTrackableUrl('/en/verify-email', ''), true);
    assert.equal(isMetaPixelTrackableUrl('/en/login', '?next=%2Fcatalog'), true);
    assert.equal(isMetaPixelTrackableUrl('/en/requests/cm123', ''), true);
  });

  it('does not track private areas or a private destination hidden in next', () => {
    for (const pathname of [
      '/en/dashboard',
      '/ka/dashboard/admin',
      '/ru/dashboard/admin/products/cm123',
      '/de/account',
      '/fr/account/settings',
      '/it/requests/new',
      '/es/requests/new',
    ]) {
      assert.equal(isMetaPixelTrackableUrl(pathname, ''), false, pathname);
    }
    assert.equal(
      isMetaPixelTrackableUrl('/en/login', `?next=${encodeURIComponent('/dashboard/admin')}`),
      false,
    );
    assert.equal(
      isMetaPixelTrackableUrl('/en/verify-email', `?next=${encodeURIComponent('/account')}`),
      false,
    );
    assert.equal(
      isMetaPixelTrackableUrl(
        '/en/login',
        `?next=${encodeURIComponent('/catalog?next=/account/settings')}`,
      ),
      false,
    );
    assert.equal(isMetaPixelTrackableUrl('/en/login', '?next=%252Fdashboard%252Fadmin'), false);
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

  it('skips secrets nested in other parameters and in the fragment', () => {
    assert.equal(
      isMetaPixelTrackableUrl('/en/login', `?next=${encodeURIComponent('/en/x?token=abc')}`),
      false,
    );
    assert.equal(isMetaPixelTrackableUrl('/en/login', '?next=%2Freset-password'), true);
    assert.equal(isMetaPixelTrackableUrl('/en/catalog', '?q=someone%40mail.ge'), false);
    assert.equal(isMetaPixelTrackableUrl('/en/login', '', '#token=abc'), false);
    assert.equal(isMetaPixelTrackableUrl('/en/login', '', '#a@b.ge'), false);
    assert.equal(isMetaPixelTrackableUrl('/en/catalog', '', '#harvest'), true);
  });
});

describe('Meta Pixel referrers', () => {
  it('rejects a referrer that is itself a sensitive URL', () => {
    assert.equal(isMetaPixelSafeReferrer(''), true);
    assert.equal(isMetaPixelSafeReferrer('https://agrobridge.ge/en/catalog'), true);
    assert.equal(isMetaPixelSafeReferrer('https://agrobridge.ge/en/dashboard/admin'), false);
    assert.equal(
      isMetaPixelSafeReferrer(
        `https://agrobridge.ge/en/login?next=${encodeURIComponent('/account/settings')}`,
      ),
      false,
    );
    assert.equal(isMetaPixelSafeReferrer('https://www.google.com/'), true);
    assert.equal(
      isMetaPixelSafeReferrer('https://agrobridge.ge/en/reset-password?token=abc'),
      false,
    );
    assert.equal(isMetaPixelSafeReferrer('https://agrobridge.ge/ka/reset-password'), false);
    assert.equal(isMetaPixelSafeReferrer('https://agrobridge.ge/en/login?email=a%40b.ge'), false);
    assert.equal(isMetaPixelSafeReferrer('not a url'), false);
  });
});

describe('discarding queued events', () => {
  it('drops track calls in place and keeps configuration in order', () => {
    const queue: unknown[][] = [
      ['set', 'autoConfig', false, '1'],
      ['init', '1'],
      ['track', 'PageView'],
      ['consent', 'revoke'],
      ['trackCustom', 'X'],
      ['trackSingle', '1', 'PageView'],
      ['track', 'CompleteRegistration'],
    ];
    discardQueuedEvents(queue);
    assert.deepEqual(queue, [
      ['set', 'autoConfig', false, '1'],
      ['init', '1'],
      ['consent', 'revoke'],
    ]);
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

type Beacon = { ev: string; dl: string; rl: string; id: string };

type FakeFbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[][];
  disablePushState?: boolean;
  allowDuplicatePageViews?: boolean;
};

/**
 * A fresh copy of the module and a browser-like global for each test. The
 * module keeps per-document state, which a real page reload would reset.
 */
let instance = 0;
async function setup(href = 'https://agrobridge.ge/en', referrer = '') {
  const scripts: { src: string; async: boolean }[] = [];
  const cookieWrites: string[] = [];
  const stored = new Map<string, string>();
  const g = globalThis as Record<string, unknown>;
  const location = new URL(href);
  const win = {
    location,
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => void stored.set(key, value),
    },
  } as unknown as { location: URL; fbq?: FakeFbq };
  const doc = {
    referrer,
    head: { appendChild: (node: { src: string; async: boolean }) => scripts.push(node) },
    createElement: () => ({ src: '', async: false }),
    set cookie(value: string) {
      cookieWrites.push(value);
    },
  };
  g.window = win;
  g.document = doc;
  instance += 1;
  const mod = (await import(`./meta-pixel.ts?test=${instance}`)) as typeof import('./meta-pixel.ts');
  const beacons: Beacon[] = [];

  /**
   * Emulates how fbevents.js takes over the stub: it replaces `callMethod`,
   * then replays `fbq.queue` in order. While consent is revoked every call
   * except `consent` is pushed back onto the queue, and `consent grant`
   * replays it. `track` sends a beacon for each initialised Pixel, with the
   * page URL and document referrer, as the real library does.
   */
  function loadMetaLibrary() {
    const fbq = win.fbq;
    assert.ok(fbq, 'the stub must exist before the library loads');
    const pixels: string[] = [];
    let locked = false;
    const drain = () => {
      while (!locked && fbq.queue.length) handle(fbq.queue.shift() as unknown[]);
    };
    const handle = (args: unknown[]) => {
      const [method, ...rest] = args;
      if (locked && method !== 'consent') {
        fbq.queue.push(args);
        return;
      }
      if (method === 'consent') {
        locked = rest[0] === 'revoke';
        if (!locked) drain();
      } else if (method === 'init') {
        pixels.push(String(rest[0]));
      } else if (method === 'track') {
        for (const id of pixels) {
          beacons.push({ ev: String(rest[0]), dl: win.location.href, rl: doc.referrer, id });
        }
      }
    };
    fbq.callMethod = (...args: unknown[]) => handle(args);
    drain();
  }

  function navigate(next: string) {
    const url = new URL(next, win.location.href);
    win.location.href = url.href;
    return { pathname: url.pathname, search: url.search, hash: url.hash, referrer: doc.referrer };
  }

  const page = () => ({
    pathname: win.location.pathname,
    search: win.location.search,
    hash: win.location.hash,
    referrer: doc.referrer,
  });

  return { mod, win, scripts, cookieWrites, beacons, loadMetaLibrary, navigate, page };
}

describe('Meta Pixel runtime', () => {
  const PIXEL = '1234567890123456';

  it('sends nothing and loads no script before consent', async () => {
    const t = await setup();
    t.mod.revokeMetaPixel();
    assert.equal(t.mod.trackMetaPageView('/en', ''), false);
    assert.equal(t.mod.scheduleMetaCompleteRegistration('user-1'), false);
    assert.equal(t.win.fbq, undefined);
    assert.equal(t.scripts.length, 0);
  });

  it('after consent: loads once with auto config off and sends one PageView per URL', async () => {
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.equal(t.scripts.length, 1);
    assert.equal(t.scripts[0].src, t.mod.META_PIXEL_SCRIPT_SRC);
    assert.equal(t.win.fbq?.disablePushState, true);
    assert.equal(t.win.fbq?.allowDuplicatePageViews, true);
    assert.deepEqual(t.win.fbq?.queue.slice(0, 2), [
      ['set', 'autoConfig', false, PIXEL],
      ['init', PIXEL],
    ]);
    t.loadMetaLibrary();
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/catalog'));
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en'));
    assert.deepEqual(
      t.beacons.map((b) => `${b.ev} ${b.dl}`),
      [
        'PageView https://agrobridge.ge/en',
        'PageView https://agrobridge.ge/en/catalog',
        'PageView https://agrobridge.ge/en',
      ],
    );
  });

  it('does not load on the password-reset page', async () => {
    const t = await setup('https://agrobridge.ge/en/reset-password?token=secret-token');
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.equal(t.win.fbq, undefined);
    assert.equal(t.scripts.length, 0);
  });

  it('does not load when the document referrer is the password-reset URL', async () => {
    const t = await setup(
      'https://agrobridge.ge/en/login',
      'https://agrobridge.ge/en/reset-password?token=secret-token',
    );
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.equal(t.win.fbq, undefined);
    assert.equal(t.scripts.length, 0);
  });

  it('stops on a sensitive page and stays off for the rest of that document', async () => {
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.loadMetaLibrary();
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/reset-password?token=secret-token'));
    // Meta's own automatic PageView (e.g. on a back/forward-cache restore) while paused.
    t.win.fbq?.('track', 'PageView');
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/login'));
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/catalog'));
    assert.deepEqual(
      t.beacons.map((b) => b.dl),
      ['https://agrobridge.ge/en'],
    );
    assert.ok(!JSON.stringify(t.beacons).includes('secret-token'));
  });

  it('control: appending only `consent revoke` lets a queued PageView through', async () => {
    // The previous implementation's sequence; proves this harness detects the leak.
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.win.fbq?.('consent', 'revoke');
    t.loadMetaLibrary();
    assert.equal(t.beacons.length, 1);
  });

  it('withdrawal before the library loads discards the queued PageView and init', async () => {
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.mod.revokeMetaPixel();
    assert.deepEqual(t.win.fbq?.queue, [['consent', 'revoke']]);
    t.loadMetaLibrary();
    assert.deepEqual(t.beacons, []);
    assert.deepEqual(t.win.fbq?.queue, []);
  });

  it('withdrawal before the library loads discards a queued CompleteRegistration', async () => {
    const t = await setup('https://agrobridge.ge/en/register');
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.equal(t.mod.scheduleMetaCompleteRegistration('user-1'), true);
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/verify-email'));
    assert.ok(t.win.fbq?.queue.some((call) => call[1] === 'CompleteRegistration'));
    t.mod.revokeMetaPixel();
    t.loadMetaLibrary();
    assert.deepEqual(t.beacons, []);
  });

  it('withdrawal after the library loads stops events, and a later grant sends none of the backlog', async () => {
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.loadMetaLibrary();
    assert.equal(t.beacons.length, 1);
    t.mod.revokeMetaPixel();
    for (const name of ['_fbp', '_fbc']) {
      assert.ok(t.cookieWrites.includes(`${name}=; Path=/; Max-Age=0`));
      assert.ok(t.cookieWrites.includes(`${name}=; Path=/; Max-Age=0; Domain=agrobridge.ge`));
    }
    // Meta's automatic PageView while revoked is held by the library, not sent.
    t.win.fbq?.('track', 'PageView');
    assert.equal(t.mod.trackMetaPageView('/en/farms', ''), false);
    assert.equal(t.beacons.length, 1);

    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/farms'));
    assert.deepEqual(
      t.beacons.map((b) => b.dl),
      ['https://agrobridge.ge/en', 'https://agrobridge.ge/en/farms'],
    );
    assert.equal(
      t.win.fbq?.queue.filter((call) => call[0] === 'init').length ?? 0,
      0,
      'the Pixel is not initialised twice',
    );
  });

  it('withdrawal from another tab while the library is still loading sends nothing', async () => {
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.mod.revokeMetaPixel();
    t.mod.revokeMetaPixel();
    t.loadMetaLibrary();
    assert.deepEqual(t.beacons, []);
  });

  it('does not send PageView for private routes and resumes on the next public page', async () => {
    const t = await setup();
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.loadMetaLibrary();
    for (const path of [
      '/en/dashboard',
      '/en/dashboard/admin?section=users',
      '/en/dashboard/admin/products/cm123secret',
      '/en/account',
      '/en/account/settings',
      '/en/requests/new',
    ]) {
      t.mod.syncMetaPixel(PIXEL, t.navigate(path));
    }
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/catalog'));
    assert.deepEqual(
      t.beacons.map((b) => `${b.ev} ${new URL(b.dl).pathname}`),
      ['PageView /en', 'PageView /en/catalog'],
    );
    const leaked = JSON.stringify(t.beacons);
    assert.equal(leaked.includes('dashboard'), false);
    assert.equal(leaked.includes('account'), false);
    assert.equal(leaked.includes('cm123secret'), false);
    assert.equal(leaked.includes('requests'), false);
  });

  it('does not load when the document referrer is a private URL', async () => {
    const t = await setup(
      'https://agrobridge.ge/en/catalog',
      'https://agrobridge.ge/en/dashboard/chat/cm123secret',
    );
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.equal(t.win.fbq, undefined);
    assert.deepEqual(t.beacons, []);
  });

  it('does not send a login PageView when next points at an admin page', async () => {
    const t = await setup(
      `https://agrobridge.ge/en/login?next=${encodeURIComponent('/dashboard/admin')}`,
    );
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.equal(t.win.fbq, undefined);
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/catalog'));
    t.loadMetaLibrary();
    assert.deepEqual(
      t.beacons.map((b) => new URL(b.dl).pathname),
      ['/en/catalog'],
    );
    assert.equal(JSON.stringify(t.beacons).includes('dashboard'), false);
  });

  it('skips CompleteRegistration when verification would expose a private next', async () => {
    const t = await setup('https://agrobridge.ge/en/register');
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.loadMetaLibrary();
    assert.equal(t.mod.scheduleMetaCompleteRegistration('user-1'), true);
    t.mod.syncMetaPixel(
      PIXEL,
      t.navigate(`/en/verify-email?next=${encodeURIComponent('/dashboard/admin')}`),
    );
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/catalog'));
    assert.deepEqual(
      t.beacons.map((b) => b.ev),
      ['PageView', 'PageView'],
    );
    assert.equal(JSON.stringify(t.beacons).includes('dashboard'), false);
    assert.equal(JSON.stringify(t.beacons).includes('user-1'), false);
  });

  it('sends CompleteRegistration once, without parameters, after leaving the form', async () => {
    const t = await setup('https://agrobridge.ge/en/register');
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.loadMetaLibrary();
    assert.equal(t.mod.scheduleMetaCompleteRegistration('user-1'), true);
    assert.equal(t.mod.scheduleMetaCompleteRegistration('user-1'), false, 'no duplicate');
    t.mod.syncMetaPixel(PIXEL, t.page());
    assert.deepEqual(
      t.beacons.map((b) => b.ev),
      ['PageView'],
      'not sent while the form is on screen',
    );
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/verify-email'));
    assert.deepEqual(
      t.beacons.map((b) => `${b.ev} ${new URL(b.dl).pathname}`),
      ['PageView /en/register', 'PageView /en/verify-email', 'CompleteRegistration /en/verify-email'],
    );
    const registration = t.win.fbq?.queue.find((call) => call[1] === 'CompleteRegistration');
    assert.equal(registration, undefined);
    assert.ok(!JSON.stringify(t.beacons).includes('user-1'));
  });

  it('drops a scheduled CompleteRegistration when consent is withdrawn', async () => {
    const t = await setup('https://agrobridge.ge/en/register');
    t.mod.syncMetaPixel(PIXEL, t.page());
    t.loadMetaLibrary();
    assert.equal(t.mod.scheduleMetaCompleteRegistration('user-1'), true);
    t.mod.revokeMetaPixel();
    t.mod.syncMetaPixel(PIXEL, t.navigate('/en/verify-email'));
    assert.deepEqual(
      t.beacons.map((b) => b.ev),
      ['PageView', 'PageView'],
    );
  });
});

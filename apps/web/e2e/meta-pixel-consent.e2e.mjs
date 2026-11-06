// Browser regression tests for the consent-gated Meta Pixel.
// How to run: apps/web/e2e/README.md
//
// Uses Meta's real fbevents.js, serves the Pixel configuration locally, and
// aborts every other request to Meta (including /tr beacons). Nothing is sent
// to Meta. The production Pixel ID is refused.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';

const BASE = (process.env.META_PIXEL_E2E_WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const API = (process.env.META_PIXEL_E2E_API_URL ?? 'http://localhost:3001').replace(/\/+$/, '');
const TEST_PIXEL_ID = process.env.META_PIXEL_E2E_PIXEL_ID ?? '1234567890123456';
const PRODUCTION_PIXEL_ID = '4510117069202254';
const LOG =
  process.env.META_PIXEL_E2E_LOG ??
  (existsSync('/opt/cursor/artifacts') ? '/opt/cursor/artifacts/meta-pixel-consent-e2e.log' : '');

if (!/^\d{5,20}$/.test(TEST_PIXEL_ID) || TEST_PIXEL_ID === PRODUCTION_PIXEL_ID) {
  console.error('Refusing to run: set META_PIXEL_E2E_PIXEL_ID to a non-production test Pixel ID.');
  process.exit(1);
}

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    console.error('No Chrome or Chromium found. Set CHROME_PATH. See e2e/README.md.');
    process.exit(1);
  }
  return found;
}
const out = [];
const log = (line) => {
  out.push(line);
  console.log(line);
};
let failures = 0;
function check(name, ok, detail = '') {
  if (!ok) failures += 1;
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -- ${detail}` : ''}`);
}

let realLibrary;
try {
  realLibrary = await (await fetch('https://connect.facebook.net/en_US/fbevents.js')).text();
  log(`fbevents.js: live copy from connect.facebook.net (${realLibrary.length} bytes)`);
} catch (error) {
  const fallback = process.env.META_PIXEL_E2E_FBEVENTS;
  if (!fallback) {
    console.error(
      `Could not download fbevents.js (${error}). Set META_PIXEL_E2E_FBEVENTS to a local copy. See e2e/README.md.`,
    );
    process.exit(1);
  }
  realLibrary = readFileSync(fallback, 'utf8');
  log(`fbevents.js: local copy ${fallback}`);
}
const assetCache = new Map();
async function metaAsset(url) {
  if (url.includes('fbevents.js')) return realLibrary;
  if (!assetCache.has(url)) assetCache.set(url, await (await fetch(url)).text());
  return assetCache.get(url);
}
const minimalConfig = (id) =>
  `fbq.registerPlugin("${id}", {__fbEventsPlugin: 1, plugin: function(fbq, instance) { instance.configLoaded("${id}"); }});`;
// What Events Manager serves with Automatic Advanced Matching switched on.
const aamConfig = (id) => `fbq.registerPlugin("${id}", {__fbEventsPlugin: 1, plugin: function(fbq, instance, config) {
config.set("${id}", "automaticMatching", {"selectedMatchKeys":["em","fn","ln","ph","external_id"]});
fbq.loadPlugin("inferredevents");
fbq.loadPlugin("identity");
instance.optIn("${id}", "AutomaticMatching", true);
instance.optIn("${id}", "InferredEvents", true);
instance.configLoaded("${id}"); }});`;

function databaseUrl() {
  const fromEnv = process.env.DATABASE_URL?.replace(/\?schema=.*$/, '').replace(/^["']|["']$/g, '');
  if (fromEnv) return fromEnv;
  const raw = readFileSync(new URL('../../api/.env', import.meta.url), 'utf8');
  const match = raw.match(/^DATABASE_URL=(.*)$/m);
  if (!match) {
    throw new Error('DATABASE_URL is not set and apps/api/.env has none. See e2e/README.md.');
  }
  return match[1].replace(/\?schema=.*$/, '').replace(/^["']|["']$/g, '');
}

function clearRateLimits() {
  execFileSync('psql', [databaseUrl(), '-q', '-c', 'delete from rate_limit_counters']);
}

/** Console mail from the local API, where the password-reset link is printed. */
function readApiConsole() {
  const file = process.env.META_PIXEL_E2E_API_LOG;
  if (file) return readFileSync(file, 'utf8');
  const session = process.env.META_PIXEL_E2E_API_TMUX;
  if (!session || !/^[A-Za-z0-9_.:-]+$/.test(session)) {
    throw new Error(
      'Set META_PIXEL_E2E_API_LOG to the API console log, or META_PIXEL_E2E_API_TMUX to the tmux session that shows it. See e2e/README.md.',
    );
  }
  const args = ['capture-pane', '-p', '-J', '-S', '-400', '-t', session];
  const config = process.env.META_PIXEL_E2E_TMUX_CONFIG;
  return execFileSync('tmux', config ? ['-f', config, ...args] : args, { encoding: 'utf8' });
}

for (const [name, url] of [
  ['web', `${BASE}/en`],
  ['api', `${API}/api/health`],
]) {
  const response = await fetch(url).catch(() => null);
  if (!response?.ok) {
    console.error(`${name} is not reachable at ${url}. See e2e/README.md.`);
    process.exit(1);
  }
}

const browser = await chromium.launch({ executablePath: findChrome() });
const traffic = [];

async function session({ config = 'minimal', hold = false, stripAutoConfig = false, consent } = {}) {
  const context = await browser.newContext();
  if (consent) {
    await context.addCookies([
      { name: 'agrobridge_cookie_consent', value: `v1.${consent}`, url: BASE },
    ]);
  }
  await context.addInitScript(() => {
    window.__pageshow = [];
    addEventListener('pageshow', (e) => window.__pageshow.push(e.persisted));
  });
  const hits = [];
  let release;
  const released = hold ? new Promise((r) => (release = r)) : Promise.resolve();
  await context.route(/facebook\.(net|com)/, async (route) => {
    const request = route.request();
    const url = request.url();
    const hit = { url, post: request.postData() ?? '', at: Date.now() };
    hits.push(hit);
    traffic.push(hit);
    const path = new URL(url).pathname;
    if (path.includes('/signals/config/')) {
      const id = path.split('/').pop();
      return route.fulfill({
        contentType: 'application/javascript',
        body: config === 'aam' ? aamConfig(id) : minimalConfig(id),
      });
    }
    if (path.endsWith('.js')) {
      if (path.endsWith('fbevents.js')) await released;
      const body = await metaAsset(url);
      // Control only: simulates code that does not opt out of auto config.
      const prefix =
        stripAutoConfig && path.endsWith('fbevents.js')
          ? 'window.fbq.queue = window.fbq.queue.filter(function(a){ return a[1] !== "autoConfig"; });'
          : '';
      return route.fulfill({ contentType: 'application/javascript', body: prefix + body });
    }
    return route.abort();
  });
  const page = await context.newPage();
  return { context, page, hits, release: () => release?.() };
}

function beacons(hits) {
  return hits
    .filter((h) => new URL(h.url).pathname.startsWith('/tr'))
    .map((h) => {
      const params = new URLSearchParams(new URL(h.url).search);
      if (h.post && !h.post.startsWith('{')) {
        for (const [k, v] of new URLSearchParams(h.post)) params.append(k, v);
      }
      return {
        ev: params.get('ev'),
        dl: params.get('dl') ?? '',
        rl: params.get('rl') ?? '',
        id: params.get('id') ?? '',
        keys: [...params.keys()],
      };
    });
}
const pathOf = (u) => (u ? new URL(u).pathname : '');

/** Every Meta request (URL and body, decoded) must be free of these. */
function assertNoPrivateLeak(name, hits) {
  const problems = [];
  for (const h of hits) {
    let text = `${h.url} ${h.post}`;
    for (let i = 0; i < 3; i += 1) {
      try {
        text = decodeURIComponent(text);
      } catch {
        break;
      }
    }
    if (/\/dashboard(?:[/?#&\s]|$)/.test(text) || /\/account(?:[/?#&\s]|$)/.test(text) || text.includes('/requests/new')) {
      problems.push(text.slice(0, 220));
    }
  }
  check(`${name}: no private path in any Meta request`, problems.length === 0, problems.join(' | '));
}

function verificationCodeFor(email) {
  const pane = readApiConsole();
  const marker = `to=${email}`;
  let from = pane.length;
  while (from > 0) {
    const at = pane.lastIndexOf(marker, from - 1);
    if (at === -1) return undefined;
    const code = pane.slice(at, at + 1500).match(/verification code is (\d{6})/i);
    if (code) return code[1];
    from = at;
  }
  return undefined;
}

function assertClean(name, hits, secrets) {
  const problems = [];
  for (const h of hits) {
    let text = `${h.url} ${h.post}`;
    for (let i = 0; i < 3; i += 1) {
      try {
        text = decodeURIComponent(text);
      } catch {
        break;
      }
    }
    for (const secret of secrets) if (secret && text.includes(secret)) problems.push(`contains ${secret}`);
    if (/[?&](ud|udff)\[/.test(text)) problems.push(`user-data parameter in ${new URL(h.url).pathname}`);
    if (/[^\s/]+@[^\s/&]+\.[a-z]{2,}/i.test(text)) problems.push('email-like value');
  }
  check(`${name}: no secret, email or ud[/udff[ in any of ${hits.length} Meta requests`, problems.length === 0, problems.join('; '));
}

async function register(page, email, { displayName = 'Pixel Tester', password = 'Testpass123!' } = {}) {
  await page.fill('input[name="displayName"]', displayName);
  await page.fill('input[name="email"]', email);
  await page.fill('#register-password', password);
  await page.fill('#register-confirm-password', password);
  await page.check('input[name="acceptTerms"]');
  await page.click('.auth-form button[type="submit"]');
  await page.waitForURL(/verify-email/, { timeout: 20000 });
}

async function createResetToken() {
  clearRateLimits();
  const email = `reset-${Date.now()}@example.test`;
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: 'agrobridge_cookie_consent', value: 'v1.denied', url: BASE }]);
  await ctx.route(/facebook\.(net|com)/, (route) => route.abort());
  const p = await ctx.newPage();
  await p.goto(`${BASE}/en/register`);
  await register(p, email);
  await ctx.close();
  await fetch(`${API}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  await new Promise((r) => setTimeout(r, 1500));
  const pane = readApiConsole();
  const tokens = [...pane.matchAll(/reset-password\?token=([A-Za-z0-9_\-.%]+)/g)].map((m) => m[1]);
  return { email, token: tokens.at(-1) };
}

const accept = (page) =>
  page.locator('section.cookie-consent').getByRole('button', { name: 'Accept advertising cookies' }).click();
const reject = (page) =>
  page.locator('section.cookie-consent').getByRole('button', { name: 'Reject advertising cookies' }).click();

// ---------------------------------------------------------------------------
log('\n== 1. Password reset: direct load, Ctrl-click on every link, locale switch, real reset ==');
{
  const { email, token } = await createResetToken();
  check('obtained a real reset token from the local API', Boolean(token));
  const s = await session({ consent: 'granted' });
  const resetUrl = `${BASE}/en/reset-password?token=${token}`;
  const response = await s.page.goto(resetUrl);
  await s.page.waitForTimeout(2000);
  check(
    'reset page sends Referrer-Policy: no-referrer',
    response.headers()['referrer-policy'] === 'no-referrer',
  );
  check(
    'reset page: Meta script never requested, no fbq',
    s.hits.length === 0 && !(await s.page.evaluate(() => 'fbq' in window)),
    `${s.hits.length} Meta requests`,
  );

  // Ctrl-click every visible link, then every language option.
  const opened = [];
  async function ctrlClick(locator, label) {
    const popupPromise = s.context.waitForEvent('page');
    await locator.click({ modifiers: ['Control'] });
    const popup = await popupPromise;
    await popup.waitForLoadState('load');
    await popup.waitForTimeout(2500);
    opened.push({
      label,
      url: popup.url(),
      referrer: await popup.evaluate(() => document.referrer),
      fbq: await popup.evaluate(() => 'fbq' in window),
    });
    await popup.close();
  }
  const links = s.page.locator('a[href]:visible');
  const count = await links.count();
  for (let i = 0; i < count; i += 1) {
    const link = links.nth(i);
    await ctrlClick(link, (await link.getAttribute('href')) ?? '?');
  }
  await s.page.locator('summary.language-switcher__button').click();
  const options = s.page.locator('.language-switcher__option');
  for (let i = 0; i < (await options.count()); i += 1) {
    const option = options.nth(i);
    if ((await option.getAttribute('aria-current')) === 'true') continue;
    await ctrlClick(option, `locale ${await option.getAttribute('hreflang')}`);
  }
  for (const o of opened) log(`      opened ${o.label} -> ${pathOf(o.url)}  referrer="${o.referrer}"  fbq=${o.fbq}`);
  check(`all ${opened.length} new tabs have an empty document.referrer`, opened.every((o) => o.referrer === ''));
  check(
    'new tabs on ordinary pages did load the Pixel (so the test exercises it)',
    opened.some((o) => o.fbq && !o.url.includes('reset-password')),
  );
  check(
    'new tabs on the reset page (other locales) did not load the Pixel',
    opened.filter((o) => o.url.includes('reset-password')).every((o) => !o.fbq),
  );
  const bs = beacons(s.hits);
  check('new tabs sent PageView beacons', bs.some((b) => b.ev === 'PageView'), `${bs.length} beacons`);
  check('no beacon has a reset-page referrer', bs.every((b) => !b.rl.includes('reset-password')));
  assertClean('Ctrl-click from reset page', s.hits, [token, email]);

  // Switch locale in the same tab (client-side), then reset the password there.
  await s.page.keyboard.press('Escape');
  await s.page.locator('.language-switcher__option[hreflang="ka"]').click();
  await s.page.waitForURL(/\/ka\/reset-password\?token=/);
  check('locale switch keeps the token in the URL', s.page.url().includes(token));
  await s.page.locator('input[type="password"]').nth(0).fill('Newpass456!');
  await s.page.locator('input[type="password"]').nth(1).fill('Newpass456!');
  await s.page.locator('form button[type="submit"]').click();
  await s.page.locator('.form-success').waitFor({ timeout: 10000 });
  check('password reset succeeds after switching locale', true);
  // Leave client-side for login; the document has shown the token, so the Pixel stays off.
  const before = s.hits.length;
  await s.page.locator('.auth-card__footer a').click();
  await s.page.waitForURL(/\/ka\/login/);
  await s.page.waitForTimeout(2000);
  check(
    'client-side navigation from reset to login loads no Pixel in that document',
    s.hits.length === before && !(await s.page.evaluate(() => 'fbq' in window)),
  );
  const loginRes = await fetch(`${API}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password: 'Newpass456!' }),
  });
  check('login with the new password works', loginRes.ok, `HTTP ${loginRes.status}`);
  assertClean('reset flow overall', s.hits, [token, email]);
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 2. Consent first given on the reset page, then Ctrl-click to login ==');
{
  const token = 'unit-reset-token-7c1e';
  const s = await session();
  await s.page.goto(`${BASE}/en/reset-password?token=${token}`);
  await accept(s.page);
  await s.page.waitForTimeout(1500);
  check('accepting on the reset page loads nothing there', s.hits.length === 0);
  const popupPromise = s.context.waitForEvent('page');
  await s.page.locator('.auth-card__footer a').click({ modifiers: ['Control'] });
  const popup = await popupPromise;
  await popup.waitForLoadState('load');
  await popup.waitForTimeout(2500);
  const bs = beacons(s.hits);
  check('login tab sent PageView', bs.some((b) => b.ev === 'PageView' && pathOf(b.dl) === '/en/login'));
  assertClean('accept-on-reset then Ctrl-click', s.hits, [token]);
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 3. Secrets in query or fragment of an ordinary page, and client-side entry to the reset page ==');
{
  const s = await session({ consent: 'granted' });
  await s.page.goto(`${BASE}/en/login?next=${encodeURIComponent('/en/x?token=frag-secret-1')}`);
  await s.page.waitForTimeout(2000);
  check('nested token in ?next=: Pixel not loaded', s.hits.length === 0);
  await s.page.goto(`${BASE}/en/catalog#token=frag-secret-2`);
  await s.page.waitForTimeout(2000);
  check('token in fragment: Pixel not loaded', s.hits.length === 0);

  const s2 = await session({ consent: 'granted' });
  await s2.page.goto(`${BASE}/en/catalog`);
  await s2.page.waitForTimeout(2500);
  const hasRouter = await s2.page.evaluate(() => typeof window.next?.router?.push === 'function');
  if (hasRouter) {
    await s2.page.evaluate(() => window.next.router.push('/en/reset-password?token=client-nav-secret'));
    await s2.page.waitForURL(/reset-password/);
    await s2.page.waitForTimeout(1500);
    await s2.page.evaluate(() => window.next.router.push('/en/farms'));
    await s2.page.waitForURL(/\/en\/farms/);
    await s2.page.waitForTimeout(2000);
    const bs = beacons(s2.hits).map((b) => `${b.ev} ${pathOf(b.dl)}`);
    check(
      'client-side: catalog PageView only; nothing on or after the reset page',
      JSON.stringify(bs) === JSON.stringify(['PageView /en/catalog']),
      JSON.stringify(bs),
    );
  } else {
    log('SKIP  window.next.router unavailable; client-side entry covered by unit tests');
  }
  assertClean('query/fragment/client-nav', [...s.hits, ...s2.hits], [
    'frag-secret-1',
    'frag-secret-2',
    'client-nav-secret',
  ]);
  await s.context.close();
  await s2.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 4. Back/forward between a tracked page and the reset page ==');
{
  const token = 'history-secret-token';
  const s = await session({ consent: 'granted' });
  await s.page.goto(`${BASE}/en/catalog`);
  await s.page.waitForTimeout(2000);
  await s.page.goto(`${BASE}/en/reset-password?token=${token}`);
  await s.page.waitForTimeout(1000);
  await s.page.goBack();
  await s.page.waitForTimeout(2000);
  const persisted = await s.page.evaluate(() => window.__pageshow);
  await s.page.goForward();
  await s.page.waitForTimeout(1500);
  await s.page.goBack();
  await s.page.waitForTimeout(2000);
  log(`      back navigation restored from bfcache: ${JSON.stringify(persisted)}`);
  const bs = beacons(s.hits);
  check('back/forward produced beacons only for the catalog page', bs.every((b) => pathOf(b.dl) === '/en/catalog'));
  check('no beacon carries the reset page as referrer', bs.every((b) => !b.rl.includes('reset-password')));
  assertClean('back/forward', s.hits, [token]);
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 5. Withdrawal while Meta script is still loading: PageView ==');
{
  const s = await session({ hold: true });
  await s.page.goto(`${BASE}/en/catalog`);
  await accept(s.page);
  await s.page.waitForTimeout(400);
  const queued = await s.page.evaluate(() => (window.fbq?.queue ?? []).map((a) => Array.from(a)));
  log(`      queue after accept: ${JSON.stringify(queued)}`);
  check('PageView queued before the script loads', queued.some((a) => a[1] === 'PageView'));
  await s.page.locator('footer').getByRole('button', { name: 'Cookie settings' }).click();
  await reject(s.page);
  await s.page.waitForTimeout(300);
  const after = await s.page.evaluate(() => (window.fbq?.queue ?? []).map((a) => Array.from(a)));
  log(`      queue after reject: ${JSON.stringify(after)}`);
  s.release();
  await s.page.waitForTimeout(3000);
  const scriptLoaded = s.hits.some((h) => h.url.includes('fbevents.js'));
  check('Meta script did load afterwards', scriptLoaded);
  check(
    'no Pixel config request and no beacon after withdrawal',
    !s.hits.some((h) => h.url.includes('/signals/config/')) && beacons(s.hits).length === 0,
    s.hits.map((h) => new URL(h.url).pathname).join(', '),
  );
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 6. Withdrawal in another tab while the script is loading: CompleteRegistration ==');
{
  clearRateLimits();
  const s = await session({ hold: true });
  await s.page.goto(`${BASE}/en/register`);
  await accept(s.page);
  const email = `withdraw-${Date.now()}@example.test`;
  await register(s.page, email);
  await s.page.waitForTimeout(800);
  const queued = await s.page.evaluate(() => (window.fbq?.queue ?? []).map((a) => Array.from(a)));
  log(`      tab A queue on verify-email: ${JSON.stringify(queued)}`);
  check('CompleteRegistration queued in tab A', queued.some((a) => a[1] === 'CompleteRegistration'));
  const tabB = await s.context.newPage();
  await tabB.goto(`${BASE}/en/catalog`);
  await tabB.locator('footer').getByRole('button', { name: 'Cookie settings' }).click();
  await reject(tabB);
  await tabB.waitForTimeout(500);
  const after = await s.page.evaluate(() => (window.fbq?.queue ?? []).map((a) => Array.from(a)));
  log(`      tab A queue after tab B rejected (tab A not focused): ${JSON.stringify(after)}`);
  check('tab A queue holds no events after withdrawal in tab B', !after.some((a) => String(a[0]).startsWith('track')));
  s.release();
  await s.page.waitForTimeout(3000);
  check('no beacon from either tab', beacons(s.hits).length === 0, JSON.stringify(beacons(s.hits).map((b) => b.ev)));
  assertClean('withdrawal during registration', s.hits, [email]);
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 7. Withdrawal in another tab after the script is active ==');
{
  const s = await session();
  await s.page.goto(`${BASE}/en/catalog`);
  await accept(s.page);
  await s.page.waitForTimeout(2500);
  const first = beacons(s.hits).length;
  check('tab A active and sent PageView', first >= 1);
  const tabB = await s.context.newPage();
  await tabB.goto(`${BASE}/en/farms`);
  await tabB.waitForTimeout(1500);
  const mark = s.hits.length;
  await tabB.locator('footer').getByRole('button', { name: 'Cookie settings' }).click();
  await reject(tabB);
  await tabB.waitForTimeout(500);
  // Tab A is not brought to the front: emulate Meta's own automatic event and a navigation.
  await s.page.evaluate(() => window.fbq('track', 'PageView'));
  const navLink = s.page.locator('header a[href^="/en/"]:visible:not([href="/en/catalog"])').first();
  log(`      tab A navigates client-side to ${await navLink.getAttribute('href')}`);
  await navLink.click();
  await s.page.waitForTimeout(2500);
  const later = beacons(s.hits.slice(mark));
  check('tab A sends nothing after withdrawal in tab B', later.length === 0, JSON.stringify(later.map((b) => b.ev)));
  const cookies = (await s.context.cookies()).map((c) => c.name);
  check('_fbp and _fbc removed', !cookies.includes('_fbp') && !cookies.includes('_fbc'), cookies.join(','));
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 8. Registration: CompleteRegistration after leaving the form, no user data ==');
for (const variant of [
  { label: 'minimal Meta config', config: 'minimal' },
  { label: 'Meta config with Automatic Advanced Matching ON', config: 'aam' },
  { label: 'CONTROL: AAM ON and auto-config opt-out removed', config: 'aam', stripAutoConfig: true },
]) {
  clearRateLimits();
  const s = await session({ config: variant.config, stripAutoConfig: variant.stripAutoConfig });
  await s.page.goto(`${BASE}/en/register`);
  await accept(s.page);
  await s.page.waitForTimeout(1500);
  const email = `aam-${Date.now()}@example.test`;
  await register(s.page, email);
  await s.page.waitForTimeout(3500);
  const bs = beacons(s.hits);
  const userKeys = [...new Set(bs.flatMap((b) => b.keys.filter((k) => /^(ud|udff)\[/.test(k))))];
  log(`   [${variant.label}]`);
  for (const b of bs) {
    log(`      ${b.ev} ${pathOf(b.dl)} user-data: ${b.keys.filter((k) => /^(ud|udff)\[/.test(k)).join(',') || '-'}`);
  }
  if (variant.stripAutoConfig) {
    check('control: harness detects AAM user data when the opt-out is missing', userKeys.length > 0, userKeys.join(','));
    continue;
  }
  const regs = bs.filter((b) => b.ev === 'CompleteRegistration');
  check('exactly one CompleteRegistration', regs.length === 1);
  check('CompleteRegistration sent from verify-email, not the form', regs.every((b) => pathOf(b.dl) === '/en/verify-email'));
  check('no ud[ / udff[ parameters', userKeys.length === 0, userKeys.join(','));
  assertClean(`registration (${variant.label})`, s.hits, [email, 'Pixel Tester', 'Pixel', 'Tester']);
  await s.page.reload();
  await s.page.waitForTimeout(2000);
  check(
    'reload does not resend CompleteRegistration',
    beacons(s.hits).filter((b) => b.ev === 'CompleteRegistration').length === 1,
  );
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 9. Banner accessibility ==');
{
  const s = await session();
  await s.page.goto(`${BASE}/en/catalog`);
  await s.page.locator('section.cookie-consent').waitFor({ timeout: 5000 });
  const firstFocusable = await s.page.evaluate(() => {
    const el = document.querySelector('a[href], button, input, summary');
    return el?.closest('section.cookie-consent') ? 'banner' : el?.outerHTML.slice(0, 60);
  });
  check('banner comes first in DOM / tab order', firstFocusable === 'banner', String(firstFocusable));
  await s.page.keyboard.press('Tab');
  const focused = await s.page.evaluate(() => Boolean(document.activeElement?.closest('section.cookie-consent')));
  check('first Tab lands inside the banner', focused);
  const role = await s.page.locator('section.cookie-consent').getAttribute('role');
  const label = await s.page.getByRole('region', { name: 'Cookies on AgroBridge' }).count();
  check('first-visit banner is a labelled region', role === 'region' && label === 1);
  await reject(s.page);
  await s.page.waitForTimeout(500);
  const status = await s.page.locator('[role="status"].sr-only').textContent();
  check('choice announced in a status region', /saved/i.test(status ?? '') && /rejected/i.test(status ?? ''), status ?? '');
  await s.page.locator('footer').getByRole('button', { name: 'Cookie settings' }).click();
  const dialog = await s.page.getByRole('dialog', { name: 'Cookie settings' }).count();
  const headingFocused = await s.page.evaluate(() => document.activeElement?.tagName === 'H2');
  check('settings open as a dialog with focus on its heading', dialog === 1 && headingFocused);
  await s.page.keyboard.press('Escape');
  const backOnTrigger = await s.page.evaluate(() => document.activeElement?.textContent === 'Cookie settings');
  check('Escape closes settings and returns focus to the trigger', backOnTrigger);
  await s.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 10. Real registration redirect ==');
{
  clearRateLimits();
  const s = await session({ consent: 'granted' });
  const email = `redir-${Date.now()}@example.test`;
  const password = 'Testpass123!';
  const displayName = 'Redirect Tester';
  await s.page.goto(`${BASE}/en/register`);
  await s.page.waitForTimeout(1500);
  await register(s.page, email, { displayName, password });
  await s.page.waitForTimeout(3500);
  const landed = new URL(s.page.url());
  log(`      landed ${landed.pathname}${landed.search}${landed.hash}`);
  check(
    'successful registration lands on /en/verify-email with no next parameter',
    landed.pathname === '/en/verify-email' && landed.search === '' && landed.hash === '',
    s.page.url(),
  );
  check('verification URL does not contain next=/account', !landed.searchParams.has('next'));
  check(
    'redirect URL has no email, token, code or fragment',
    !s.page.url().includes(email) &&
      !landed.searchParams.has('token') &&
      !landed.searchParams.has('code') &&
      !landed.searchParams.has('email') &&
      landed.hash === '',
  );
  const bs = beacons(s.hits);
  const regs = bs.filter((b) => b.ev === 'CompleteRegistration');
  check('exactly one CompleteRegistration after account creation', regs.length === 1, String(regs.length));
  check(
    'CompleteRegistration is sent for that redirect URL (the sensitive-URL guard does not block it)',
    regs.length === 1 && regs[0].dl === landed.href,
    regs[0]?.dl,
  );
  check(
    'PageView is sent for the same redirect URL',
    bs.some((b) => b.ev === 'PageView' && b.dl === landed.href),
  );
  assertClean('registration redirect', s.hits, [email, password, displayName, 'Redirect', 'Tester']);
  await s.page.reload();
  await s.page.waitForTimeout(2000);
  check(
    'reloading the redirect page does not send CompleteRegistration again',
    beacons(s.hits).filter((b) => b.ev === 'CompleteRegistration').length === 1,
  );
  const code = verificationCodeFor(email);
  check('verification code is in the local API console', Boolean(code));
  if (code) {
    await s.page.fill('input[name="code"]', code);
    await s.page.locator('form button[type="submit"]').click();
    await s.page.waitForURL(/\/en\/account$/, { timeout: 20000 });
    await s.page.waitForTimeout(2000);
    check('standard verification lands on /en/account', new URL(s.page.url()).pathname === '/en/account');
    check(
      'opening /account does not send another CompleteRegistration',
      beacons(s.hits).filter((b) => b.ev === 'CompleteRegistration').length === 1,
    );
    assertNoPrivateLeak('standard registration', s.hits);
    for (const path of ['/en/dashboard', '/en/dashboard/admin', '/en/account/settings', '/en/requests/new']) {
      const response = await s.page.goto(`${BASE}${path}`);
      await s.page.waitForTimeout(1500);
      check(
        `${path} sends Referrer-Policy: no-referrer`,
        response?.headers()['referrer-policy'] === 'no-referrer',
        response?.headers()['referrer-policy'] ?? 'missing',
      );
    }
    check(
      'private pages send no PageView',
      !beacons(s.hits).some((b) => b.ev === 'PageView' && /\/dashboard|\/account|\/requests\/new/.test(b.dl)),
    );
    assertNoPrivateLeak('authenticated private pages', s.hits);
    await s.page.goto(`${BASE}/en/catalog`);
    await s.page.waitForTimeout(2500);
    const referrer = await s.page.evaluate(() => document.referrer);
    check('full navigation from a private page has an empty referrer', referrer === '', referrer);
    const catalogViews = beacons(s.hits).filter((b) => b.ev === 'PageView' && pathOf(b.dl) === '/en/catalog');
    check('public page after a private page sends one PageView', catalogViews.length === 1, String(catalogViews.length));
    check(
      'that PageView referrer is not private',
      catalogViews.every((b) => !/dashboard|\/account|requests\/new/.test(decodeURIComponent(b.rl))),
    );
    const hasRouter = await s.page.evaluate(() => typeof window.next?.router?.push === 'function');
    if (hasRouter) {
      const mark = s.hits.length;
      await s.page.evaluate(() => window.next.router.push('/en/dashboard/admin'));
      await s.page.waitForURL(/dashboard/);
      await s.page.waitForTimeout(1000);
      await s.page.evaluate(() => window.next.router.push('/en/account/settings'));
      await s.page.waitForURL(/account/);
      await s.page.waitForTimeout(1000);
      await s.page.evaluate(() => window.next.router.push('/en/farms'));
      await s.page.waitForURL(/\/en\/farms/);
      await s.page.waitForTimeout(2000);
      const later = beacons(s.hits.slice(mark));
      check(
        'client-side private routes send no PageView',
        later.some((b) => b.ev === 'PageView' && pathOf(b.dl) === '/en/farms') &&
          later.filter((b) => b.ev === 'PageView').every((b) => pathOf(b.dl) === '/en/farms'),
        JSON.stringify(later.map((b) => `${b.ev} ${pathOf(b.dl)}`)),
      );
      check(
        'client-side return to a public page does not expose a private referrer',
        later.every((b) => !/dashboard|\/account/.test(decodeURIComponent(b.rl))),
      );
      assertNoPrivateLeak('client-side private navigation', s.hits.slice(mark));
    } else {
      log('SKIP  window.next.router unavailable; client-side private navigation covered by unit tests');
    }
  }
  await s.context.close();

  clearRateLimits();
  const dup = await session({ consent: 'granted' });
  await dup.page.goto(`${BASE}/en/register`);
  await dup.page.waitForTimeout(1000);
  await dup.page.fill('input[name="displayName"]', displayName);
  await dup.page.fill('input[name="email"]', email);
  await dup.page.fill('#register-password', password);
  await dup.page.fill('#register-confirm-password', password);
  await dup.page.check('input[name="acceptTerms"]');
  await dup.page.click('.auth-form button[type="submit"]');
  await dup.page.locator('.form-error').waitFor({ timeout: 15000 });
  check(
    'duplicate registration stays on /en/register',
    new URL(dup.page.url()).pathname === '/en/register',
    dup.page.url(),
  );
  check(
    'duplicate registration shows the API error',
    (await dup.page.locator('.form-error').textContent())?.includes('already registered') ?? false,
  );
  check(
    'duplicate registration sends no CompleteRegistration',
    !beacons(dup.hits).some((b) => b.ev === 'CompleteRegistration'),
    JSON.stringify(beacons(dup.hits).map((b) => b.ev)),
  );
  assertClean('duplicate registration', dup.hits, [email, password, displayName, 'Redirect', 'Tester']);
  await dup.context.close();

  const bad = await session({ consent: 'granted' });
  const badEmail = `mismatch-${Date.now()}@example.test`;
  await bad.page.goto(`${BASE}/en/register`);
  await bad.page.waitForTimeout(1000);
  await bad.page.fill('input[name="displayName"]', 'Mismatch Tester');
  await bad.page.fill('input[name="email"]', badEmail);
  await bad.page.fill('#register-password', password);
  await bad.page.fill('#register-confirm-password', 'Otherpass123!');
  await bad.page.check('input[name="acceptTerms"]');
  await bad.page.click('.auth-form button[type="submit"]');
  await bad.page.locator('.form-error').waitFor({ timeout: 5000 });
  await bad.page.waitForTimeout(500);
  check('mismatched passwords stay on /en/register', new URL(bad.page.url()).pathname === '/en/register');
  check(
    'mismatched passwords send no CompleteRegistration',
    !beacons(bad.hits).some((b) => b.ev === 'CompleteRegistration'),
    JSON.stringify(beacons(bad.hits).map((b) => b.ev)),
  );
  assertClean('mismatched passwords', bad.hits, [badEmail, password, 'Otherpass123!', 'Mismatch', 'Tester']);
  await bad.context.close();

  clearRateLimits();
  const priv = await session({ consent: 'granted' });
  const privEmail = `priv-${Date.now()}@example.test`;
  await priv.page.goto(`${BASE}/en/register?next=${encodeURIComponent('/dashboard/admin')}`);
  await priv.page.waitForTimeout(1000);
  await register(priv.page, privEmail, { displayName: 'Private Redirect', password });
  await priv.page.waitForTimeout(2500);
  const landedPriv = new URL(priv.page.url());
  check(
    'non-default registration keeps next=/dashboard/admin',
    landedPriv.pathname === '/en/verify-email' && landedPriv.searchParams.get('next') === '/dashboard/admin',
    priv.page.url(),
  );
  check(
    'non-default private verification sends no CompleteRegistration',
    !beacons(priv.hits).some((b) => b.ev === 'CompleteRegistration'),
    JSON.stringify(beacons(priv.hits).map((b) => b.ev)),
  );
  assertNoPrivateLeak('non-default private registration', priv.hits);
  await priv.context.close();
}

// ---------------------------------------------------------------------------
log('\n== 11. Private routes, private next, and consent ==');
{
  const s = await session({ consent: 'granted' });
  await s.page.goto(`${BASE}/en/farms`);
  await s.page.waitForTimeout(2500);
  const publicViews = beacons(s.hits).filter((b) => b.ev === 'PageView' && pathOf(b.dl) === '/en/farms');
  check('public page after consent sends exactly one PageView', publicViews.length === 1, String(publicViews.length));
  for (const path of ['/en/dashboard', '/en/dashboard/admin', '/en/account', '/en/account/settings', '/en/requests/new']) {
    const response = await s.page.goto(`${BASE}${path}`);
    await s.page.waitForTimeout(1200);
    check(
      `${path} response sends Referrer-Policy: no-referrer`,
      response?.headers()['referrer-policy'] === 'no-referrer',
      `${response?.url() ?? ''} ${response?.headers()['referrer-policy'] ?? 'missing'}`,
    );
  }
  const loginResponse = await s.page.goto(`${BASE}/en/login?next=${encodeURIComponent('/dashboard/admin')}`);
  await s.page.waitForTimeout(1500);
  check(
    'login?next=/dashboard/admin sends Referrer-Policy: no-referrer',
    loginResponse?.headers()['referrer-policy'] === 'no-referrer',
  );
  assertNoPrivateLeak('signed-out private routes and login next', s.hits);
  await s.page.goto(`${BASE}/en/catalog`);
  await s.page.waitForTimeout(2500);
  const referrer = await s.page.evaluate(() => document.referrer);
  check('leaving a private login URL does not keep it as the referrer', referrer === '', referrer);
  check(
    'catalog PageView after that login URL has no private referrer',
    beacons(s.hits)
      .filter((b) => b.ev === 'PageView' && pathOf(b.dl) === '/en/catalog')
      .every((b) => !/dashboard|\/account/.test(decodeURIComponent(b.rl))),
  );
  await s.context.close();

  const cold = await session();
  await cold.page.goto(`${BASE}/en/farms`);
  await cold.page.waitForTimeout(1500);
  check('public page before consent sends no Meta requests', cold.hits.length === 0, String(cold.hits.length));
  await cold.context.close();
}

await browser.close();
const sent = traffic.map((hit) => `${hit.url} ${hit.post}`).join('\n');
check('production Pixel ID is never used', !sent.includes(PRODUCTION_PIXEL_ID));
const beaconIds = [...new Set(beacons(traffic).map((beacon) => beacon.id).filter(Boolean))];
check(
  'every beacon uses the test Pixel ID',
  beaconIds.length === 1 && beaconIds[0] === TEST_PIXEL_ID,
  beaconIds.join(','),
);
log(`\n${failures === 0 ? 'ALL PASSED' : `${failures} FAILED`}`);
if (LOG) writeFileSync(LOG, `${out.join('\n')}\n`);
process.exit(failures ? 1 : 0);

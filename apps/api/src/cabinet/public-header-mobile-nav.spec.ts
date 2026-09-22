import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';

const WEB = join(__dirname, '../../../web');
const WEB_SRC = join(WEB, 'src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');
const HEADER = join(WEB_SRC, 'components/SiteHeader.tsx');
const MENU = join(WEB_SRC, 'components/PublicHeaderMenu.tsx');
const HOME = join(WEB_SRC, 'app/[locale]/page.tsx');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

type Measure = {
  client: number;
  scroll: number;
  diff: number;
  documentOverflow: boolean;
  overflowX: { html: string; body: string; header: string };
  overflowers: Array<{ cls: string; extra: number }>;
  hamburgerDisplay: string;
  hamburgerWidth: number;
  hamburgerHeight: number;
  navDisplay: string;
  switcherVisible: boolean;
  drawerOpen: boolean;
  drawerLinks: string[];
  headerLinkTexts: string[];
  headerHeight: number;
};

function readGlobalsCss(): string {
  return readFileSync(GLOBALS_CSS, 'utf8')
    .replace(/@import\s+['"]tailwindcss['"]\s*;/, '')
    .replace(/@theme\s+inline\s*\{[\s\S]*?\n\}/, '');
}

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as Nested;
}

function readMsg(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

function findChrome(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value));
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function fixture(css: string): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
  </head>
  <body>
    <div class="home">
      <section class="home-hero">
        <div class="home-hero__shell">
          <header class="site-header site-header--light" id="header">
            <button type="button" class="site-header__menu-button" id="open-menu" aria-expanded="false">
              <span class="site-header__menu-icon" aria-hidden="true"></span>
              <span class="sr-only">Menu</span>
            </button>
            <a class="auth-brand" href="/">AgroBridge</a>
            <div class="site-header__end">
              <nav class="site-header__nav" id="desktop-nav">
                <a href="/catalog">Каталог</a>
                <a href="/requests">Запросы на покупку</a>
                <a href="/how-it-works">Как это работает</a>
                <a href="/dashboard/chat">Чат</a>
                <a href="/account">Аккаунт</a>
              </nav>
              <div class="language-switcher">
                <button type="button" class="language-switcher__button">RU</button>
              </div>
            </div>
          </header>
          <div class="home-hero__content">
            <p class="home__brand">AgroBridge</p>
            <h1 class="home__headline">Georgian farms, worldwide buyers</h1>
            <p class="home__subtitle">Hero stays intact</p>
            <div class="home__actions">
              <a class="button button--primary" href="/buyers">I'm a buyer</a>
              <a class="button button--accent" href="/sellers">I'm a seller</a>
            </div>
          </div>
        </div>
      </section>
    </div>
    <script>
      const root = document.createElement('div');
      root.className = 'site-header__drawer-root';
      root.hidden = true;
      root.innerHTML = \`
        <button type="button" class="site-header__drawer-backdrop" id="backdrop" aria-label="Close"></button>
        <div class="site-header__drawer" role="dialog">
          <div class="site-header__drawer-head">
            <p class="site-header__drawer-title">Menu</p>
            <button type="button" class="site-header__drawer-close" id="close-menu">Close</button>
          </div>
          <nav class="site-header__nav" id="drawer-nav">
            <a href="/catalog">Каталог</a>
            <a href="/requests">Richieste di acquisto</a>
            <a href="/how-it-works">Как это работает</a>
            <a href="/dashboard/chat">Чат</a>
            <a href="/account">Аккаунт</a>
          </nav>
        </div>
      \`;
      document.body.appendChild(root);
      const open = () => { root.hidden = false; document.getElementById('open-menu').setAttribute('aria-expanded', 'true'); };
      const close = () => { root.hidden = true; document.getElementById('open-menu').setAttribute('aria-expanded', 'false'); };
      document.getElementById('open-menu').addEventListener('click', open);
      document.getElementById('backdrop').addEventListener('click', close);
      document.getElementById('close-menu').addEventListener('click', close);
      document.getElementById('drawer-nav').addEventListener('click', (event) => {
        if (event.target.closest('a')) { event.preventDefault(); close(); }
      });
      document.addEventListener('keydown', (event) => { if (event.key === 'Escape') close(); });
    </script>
  </body>
</html>`;
}

const MEASURE_JS = `(() => {
  const root = document.documentElement;
  const header = document.querySelector('.site-header');
  const hamburger = document.querySelector('.site-header__menu-button');
  const nav = document.querySelector('.site-header__end .site-header__nav');
  const drawer = document.querySelector('.site-header__drawer-root');
  const switcher = document.querySelector('.language-switcher');
  const overflowers = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > root.clientWidth + 1) {
      overflowers.push({
        cls: String(el.className || el.tagName).slice(0, 90),
        extra: Math.round(r.right - root.clientWidth),
      });
    }
  }
  const visible = (el) => {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const box = el.getBoundingClientRect();
    return box.width > 0 && box.height > 0;
  };
  return {
    client: root.clientWidth,
    scroll: root.scrollWidth,
    diff: root.scrollWidth - root.clientWidth,
    documentOverflow: root.scrollWidth > root.clientWidth + 1,
    overflowX: {
      html: getComputedStyle(root).overflowX,
      body: getComputedStyle(document.body).overflowX,
      header: header ? getComputedStyle(header).overflowX : '',
    },
    overflowers: overflowers.slice(0, 8),
    hamburgerDisplay: hamburger ? getComputedStyle(hamburger).display : '',
    hamburgerWidth: hamburger ? Math.round(hamburger.getBoundingClientRect().width) : 0,
    hamburgerHeight: hamburger ? Math.round(hamburger.getBoundingClientRect().height) : 0,
    navDisplay: nav ? getComputedStyle(nav).display : '',
    switcherVisible: visible(switcher),
    drawerOpen: Boolean(drawer && !drawer.hidden && getComputedStyle(drawer).display !== 'none'),
    drawerLinks: [...document.querySelectorAll('.site-header__drawer a')].map((el) => el.getAttribute('href') || ''),
    headerLinkTexts: [...document.querySelectorAll('.site-header__end .site-header__nav a')]
      .filter((el) => visible(el))
      .map((el) => el.textContent.trim()),
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
  };
})()`;

async function startStaticServer(
  files: Record<string, string>,
): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    const name = (req.url ?? '/').replace(/^\//, '') || 'index.html';
    const body = files[name];
    if (!body) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(body);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function launchChrome(
  chrome: string,
): Promise<{ wsUrl: string; process: ChildProcess; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-public-header-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--force-device-scale-factor=1',
      '--window-size=1280,900',
      `--user-data-dir=${dir}`,
      `--remote-debugging-port=${port}`,
      'about:blank',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  const deadline = Date.now() + 15000;
  let wsUrl: string | undefined;
  while (Date.now() < deadline && !wsUrl) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    try {
      const version = JSON.parse(
        execFileSync('curl', ['-sS', `http://127.0.0.1:${port}/json/version`], {
          encoding: 'utf8',
          timeout: 1000,
        }),
      ) as { webSocketDebuggerUrl?: string };
      wsUrl = version.webSocketDebuggerUrl;
    } catch {
      /* starting */
    }
  }
  if (!wsUrl) {
    child.kill('SIGKILL');
    throw new Error(`Chrome did not open a DevTools port on ${port}`);
  }
  return { wsUrl, process: child, cleanup: () => child.kill('SIGKILL') };
}

async function cdpSession(browserWs: string, url: string, viewport: { width: number; height: number }) {
  const httpBase = browserWs.replace(/^ws/, 'http').replace(/\/devtools\/browser\/.*$/, '');
  const tab = JSON.parse(
    execFileSync('curl', ['-sS', '-X', 'PUT', `${httpBase}/json/new?${encodeURIComponent('about:blank')}`], {
      encoding: 'utf8',
      timeout: 5000,
    }),
  ) as { webSocketDebuggerUrl: string };
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('CDP websocket failed')));
  });
  let nextId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(String(event.data)) as {
      id?: number;
      result?: unknown;
      error?: { message: string };
    };
    if (!msg.id || !pending.has(msg.id)) return;
    const waiter = pending.get(msg.id)!;
    pending.delete(msg.id);
    if (msg.error) waiter.reject(new Error(msg.error.message));
    else waiter.resolve(msg.result);
  });
  const send = (method: string, params: Record<string, unknown> = {}) =>
    new Promise<unknown>((resolve, reject) => {
      const id = ++nextId;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 1024,
  });
  await send('Page.navigate', { url });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const evaluate = async (expression: string) => {
    const result = (await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
    })) as { result: { value: unknown } };
    return result.result.value;
  };
  return {
    evaluate,
    close: () => ws.close(),
  };
}

describe('public header mobile navigation', () => {
  const css = readGlobalsCss();
  const header = readFileSync(HEADER, 'utf8');
  const menu = readFileSync(MENU, 'utf8');
  const home = readFileSync(HOME, 'utf8');
  const chrome = findChrome();
  const viewports = [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 768, height: 1024 },
    { width: 820, height: 1180 },
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
  ];

  it('keeps existing public destinations and a compact mobile menu', () => {
    expect(header).toContain('PublicHeaderMenu');
    expect(header).toContain("href=\"/catalog\">{t('catalog')}");
    expect(header).toContain("href=\"/requests\">{t('purchaseRequests')}");
    expect(header).toContain("href=\"/how-it-works\">{t('howItWorks')}");
    expect(header).toContain("href=\"/login\">{t('login')}");
    expect(header).toContain("href=\"/register\">{t('register')}");
    expect(header).toContain('<LanguageSwitcher />');
    expect(header).toContain("tc('openMenu')");
    expect(header).toContain("tc('closeMenu')");
    expect(header.split('href="/catalog"').length).toBe(2);
    expect(header).not.toContain('href="/buyers"');
    expect(header).not.toContain('cabinet__menu-button');
    expect(menu).toContain('site-header__menu-button');
    expect(menu).toContain('site-header__drawer-backdrop');
    expect(menu).toContain("event.key === 'Escape'");
    expect(menu).toContain('createPortal');
    expect(home).toContain('<SiteHeader tone="light" />');
    expect(home).toContain("{t('ctaBuyer')}");
    expect(home).toContain("{t('ctaSeller')}");
    expect(home).toContain('home-hero__image');
    expect(css).toContain('.site-header__menu-button');
    expect(css).not.toMatch(/\.site-header[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
  });

  it('reuses existing nav wording in every locale', () => {
    expect(readMsg(messages('ru'), 'nav.catalog')).toBe('Каталог');
    expect(readMsg(messages('ru'), 'nav.purchaseRequests')).toBe('Запросы на покупку');
    expect(readMsg(messages('ru'), 'nav.howItWorks')).toBe('Как это работает');
    expect(readMsg(messages('ru'), 'nav.chat')).toBe('Чат');
    expect(readMsg(messages('ru'), 'nav.account')).toBe('Аккаунт');
    expect(readMsg(messages('en'), 'nav.catalog')).toBe('Catalog');

    for (const locale of LOCALES) {
      const labels = [
        'nav.catalog',
        'nav.purchaseRequests',
        'nav.howItWorks',
        'nav.chat',
        'nav.account',
        'nav.login',
        'nav.register',
        'cabinet.openMenu',
        'cabinet.closeMenu',
      ].map((key) => readMsg(messages(locale), key));
      for (const label of labels) {
        expect(label.trim().length).toBeGreaterThan(0);
      }
      expect(labels.join('\n').toLowerCase()).not.toContain('котиров');
    }
  });

  (chrome ? it : it.skip)(
    'uses a compact header on phones and keeps desktop navigation',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({ 'header.html': fixture(css) });
      try {
        for (const viewport of viewports) {
          const session = await cdpSession(launched.wsUrl, `${server.url}/header.html`, viewport);
          const result = (await session.evaluate(MEASURE_JS)) as Measure;
          const mobile = viewport.width <= 640;

          expect(result.documentOverflow).toBe(false);
          expect(result.diff).toBeLessThanOrEqual(1);
          expect(result.overflowers).toEqual([]);
          expect(result.overflowX.html).not.toBe('hidden');
          expect(result.overflowX.body).not.toBe('hidden');
          expect(result.overflowX.header).not.toBe('hidden');
          expect(result.switcherVisible).toBe(true);

          if (mobile) {
            expect(['flex', 'inline-flex']).toContain(result.hamburgerDisplay);
            expect(result.hamburgerWidth).toBeGreaterThanOrEqual(39);
            expect(result.hamburgerHeight).toBeGreaterThanOrEqual(39);
            expect(result.navDisplay).toBe('none');
            expect(result.headerLinkTexts).toEqual([]);
            expect(result.headerHeight).toBeLessThan(90);
            expect(result.drawerOpen).toBe(false);

            await session.evaluate('document.getElementById("open-menu").click()');
            const opened = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(opened.drawerOpen).toBe(true);
            expect(opened.drawerLinks).toEqual([
              '/catalog',
              '/requests',
              '/how-it-works',
              '/dashboard/chat',
              '/account',
            ]);
            expect(opened.documentOverflow).toBe(false);

            await session.evaluate('document.getElementById("backdrop").click()');
            const closedBackdrop = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(closedBackdrop.drawerOpen).toBe(false);

            await session.evaluate('document.getElementById("open-menu").click()');
            await session.evaluate('document.getElementById("drawer-nav").querySelector("a").click()');
            const closedLink = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(closedLink.drawerOpen).toBe(false);

            await session.evaluate('document.getElementById("open-menu").click()');
            await session.evaluate(
              'document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }))',
            );
            const closedEscape = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(closedEscape.drawerOpen).toBe(false);
          } else {
            expect(result.hamburgerDisplay).toBe('none');
            expect(result.navDisplay).not.toBe('none');
            expect(result.headerLinkTexts).toEqual([
              'Каталог',
              'Запросы на покупку',
              'Как это работает',
              'Чат',
              'Аккаунт',
            ]);
            expect(result.drawerOpen).toBe(false);
          }

          session.close();
        }
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    120000,
  );
});

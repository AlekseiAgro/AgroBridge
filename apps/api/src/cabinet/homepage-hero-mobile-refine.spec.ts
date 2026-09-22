import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';

const WEB_SRC = join(__dirname, '../../../web/src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');
const HEADER = join(WEB_SRC, 'components/SiteHeader.tsx');
const HOME = join(WEB_SRC, 'app/[locale]/page.tsx');

type Measure = {
  client: number;
  scroll: number;
  diff: number;
  documentOverflow: boolean;
  overflowX: { html: string; body: string; header: string };
  overflowers: Array<{ cls: string; extra: number }>;
  headerLogoDisplay: string;
  wordmarkDisplay: string;
  wordmarkExtra: number;
  heroLogoDisplay: string;
  headerBottom: number;
  contentTop: number;
  gap: number;
  headlineTop: number;
  buttonsExtra: number[];
  drawerHasWordmark: boolean;
};

function readGlobalsCss(): string {
  return readFileSync(GLOBALS_CSS, 'utf8')
    .replace(/@import\s+['"]tailwindcss['"]\s*;/, '')
    .replace(/@theme\s+inline\s*\{[\s\S]*?\n\}/, '');
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
          <header class="site-header site-header--light">
            <button type="button" class="site-header__menu-button">
              <span class="site-header__menu-icon" aria-hidden="true"></span>
              <span class="sr-only">Menu</span>
            </button>
            <a class="auth-brand" href="/">
              <img class="brand-logo" alt="AgroBridge" width="80" height="40" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
              <span class="auth-brand__wordmark">AgroBridge</span>
            </a>
            <div class="site-header__end">
              <nav class="site-header__nav">
                <a href="/catalog">Каталог</a>
                <a href="/requests">Запросы на покупку</a>
                <a href="/how-it-works">Как это работает</a>
              </nav>
              <div class="language-switcher">
                <button type="button" class="language-switcher__button">RU</button>
              </div>
            </div>
          </header>
          <div class="home-hero__content">
            <p class="home__brand">
              <img class="brand-logo" alt="AgroBridge" width="200" height="100" src="data:image/gif;base64,R0lGODlhAQABAAAAACw=" />
            </p>
            <h1 class="home__headline">Грузинские хозяйства. Покупатели по всему миру.</h1>
            <p class="home__subtitle">От грузинских ферм к мировым рынкам</p>
            <div class="home__actions">
              <a class="button button--primary" href="/buyers">Я покупатель</a>
              <a class="button button--accent" href="/sellers">Я продавец</a>
            </div>
          </div>
        </div>
      </section>
    </div>
  </body>
</html>`;
}

const MEASURE_JS = `(() => {
  const root = document.documentElement;
  const extra = (parent, child) => {
    if (!parent || !child) return 0;
    return Math.max(0, Math.round(child.getBoundingClientRect().right - parent.getBoundingClientRect().right - 1));
  };
  const header = document.querySelector('.site-header');
  const wordmark = document.querySelector('.auth-brand__wordmark');
  const headerLogo = document.querySelector('.site-header .auth-brand .brand-logo');
  const heroLogo = document.querySelector('.home__brand .brand-logo');
  const content = document.querySelector('.home-hero__content');
  const headline = document.querySelector('.home__headline');
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
    headerLogoDisplay: headerLogo ? getComputedStyle(headerLogo).display : '',
    wordmarkDisplay: wordmark ? getComputedStyle(wordmark).display : '',
    wordmarkExtra: extra(header, wordmark),
    heroLogoDisplay: heroLogo ? getComputedStyle(heroLogo).display : '',
    headerBottom: header ? Math.round(header.getBoundingClientRect().bottom) : 0,
    contentTop: content ? Math.round(content.getBoundingClientRect().top) : 0,
    gap: header && content
      ? Math.round(content.getBoundingClientRect().top - header.getBoundingClientRect().bottom)
      : 0,
    headlineTop: headline ? Math.round(headline.getBoundingClientRect().top) : 0,
    buttonsExtra: [...document.querySelectorAll('.home__actions .button')].map((button) => extra(root, button)),
    drawerHasWordmark: Boolean(document.querySelector('.site-header__drawer .auth-brand__wordmark')),
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-hero-refine-'));
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

async function cdpEvaluate(
  browserWs: string,
  url: string,
  viewport: { width: number; height: number },
): Promise<Measure> {
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
  const result = (await send('Runtime.evaluate', {
    expression: MEASURE_JS,
    returnByValue: true,
  })) as { result: { value: Measure } };
  ws.close();
  return result.result.value;
}

describe('homepage hero mobile refine', () => {
  const css = readGlobalsCss();
  const header = readFileSync(HEADER, 'utf8');
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

  it('keeps the graphic logo in the hero and uses a header wordmark only on mobile', () => {
    expect(header).toContain('<BrandLogo />');
    expect(header).toContain('auth-brand__wordmark');
    expect(header).toContain('AgroBridge');
    expect(home).toContain('home__brand');
    expect(home).toContain('<BrandLogo />');
    expect(home).toContain("{t('headline')}");
    expect(home).toContain("{t('ctaBuyer')}");
    expect(home).toContain("{t('ctaSeller')}");
    expect(css).toContain('.auth-brand__wordmark');
    expect(css).toContain('.home-hero__content {\n    margin-top: 1.1rem;\n    margin-bottom: auto;');
    expect(css).not.toContain('.home-hero__content {\n    margin-top: auto;\n    margin-bottom: 1.5rem;');
    expect(css).not.toMatch(/\.site-header[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
  });

  (chrome ? it : it.skip)(
    'tightens mobile hero spacing without changing tablet or desktop brand',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({ 'home.html': fixture(css) });
      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(launched.wsUrl, `${server.url}/home.html`, viewport);
          const mobile = viewport.width <= 640;

          expect(result.documentOverflow).toBe(false);
          expect(result.diff).toBeLessThanOrEqual(1);
          expect(result.overflowers).toEqual([]);
          expect(result.overflowX.html).not.toBe('hidden');
          expect(result.overflowX.body).not.toBe('hidden');
          expect(result.overflowX.header).not.toBe('hidden');
          expect(result.heroLogoDisplay).not.toBe('none');
          expect(result.drawerHasWordmark).toBe(false);
          expect(result.buttonsExtra.every((value) => value === 0)).toBe(true);
          expect(result.wordmarkExtra).toBe(0);

          if (mobile) {
            expect(result.headerLogoDisplay).toBe('none');
            expect(result.wordmarkDisplay).not.toBe('none');
            expect(result.gap).toBeGreaterThanOrEqual(12);
            expect(result.gap).toBeLessThanOrEqual(40);
            expect(result.headlineTop).toBeGreaterThan(result.contentTop);
            expect(result.contentTop).toBeLessThan(viewport.height * 0.28);
          } else {
            expect(result.headerLogoDisplay).not.toBe('none');
            expect(result.wordmarkDisplay).toBe('none');
            expect(result.gap).toBeGreaterThan(80);
          }
        }
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    120000,
  );
});

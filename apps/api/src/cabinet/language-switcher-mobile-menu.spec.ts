import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';

const WEB_SRC = join(__dirname, '../../../web/src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');
const SWITCHER = join(WEB_SRC, 'components/LanguageSwitcher.tsx');

type Box = { top: number; right: number; bottom: number; left: number; width: number; height: number };

type Measure = {
  client: number;
  scroll: number;
  diff: number;
  documentOverflow: boolean;
  overflowers: Array<{ cls: string; extra: number }>;
  menuPosition: string;
  menuWidth: number;
  optionCount: number;
  optionLabels: string[];
  activeLabel: string | null;
  headerHeight: number;
  button: Box;
  menu: Box | null;
  hamburger: Box;
  wordmark: Box;
  heroLogo: Box;
  headline: Box;
  subtitle: Box;
  cta: Box;
  overlapsChrome: boolean;
  menuRightAligned: boolean;
  menuInViewport: boolean;
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
              </nav>
              <details class="language-switcher" id="switcher">
                <summary class="language-switcher__button">RU</summary>
                <div class="language-switcher__panel">
                  <ul class="language-switcher__menu" role="menu">
                    <li><a class="language-switcher__option" href="/ka">ქართული</a></li>
                    <li><a class="language-switcher__option language-switcher__option--active" href="/en" aria-current="true">English</a></li>
                    <li><a class="language-switcher__option" href="/ru">Русский</a></li>
                    <li><a class="language-switcher__option" href="/de">Deutsch</a></li>
                    <li><a class="language-switcher__option" href="/fr">Français</a></li>
                    <li><a class="language-switcher__option" href="/it">Italiano</a></li>
                    <li><a class="language-switcher__option" href="/es">Español</a></li>
                  </ul>
                </div>
              </details>
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
  const box = (el) => {
    if (!el) return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0 };
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      right: r.right,
      bottom: r.bottom,
      left: r.left,
      width: r.width,
      height: r.height,
    };
  };
  const intersects = (a, b) =>
    a.width > 0 &&
    b.width > 0 &&
    a.left < b.right - 1 &&
    a.right > b.left + 1 &&
    a.top < b.bottom - 1 &&
    a.bottom > b.top + 1;
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
  const switcher = document.querySelector('.language-switcher');
  const header = document.querySelector('.site-header');
  const menuEl = document.querySelector('.language-switcher__menu');
  const menuVisible =
    Boolean(switcher && switcher.open) &&
    Boolean(menuEl) &&
    getComputedStyle(menuEl).display !== 'none' &&
    menuEl.getBoundingClientRect().height > 0;
  const menu = menuVisible ? box(menuEl) : null;
  const button = box(document.querySelector('.language-switcher__button'));
  const hamburger = box(document.querySelector('.site-header__menu-button'));
  const wordmark = box(document.querySelector('.auth-brand__wordmark'));
  const heroLogo = box(document.querySelector('.home__brand .brand-logo'));
  const headline = box(document.querySelector('.home__headline'));
  const subtitle = box(document.querySelector('.home__subtitle'));
  const cta = box(document.querySelector('.home__actions'));
  const options = [...document.querySelectorAll('.language-switcher__option')];
  return {
    client: root.clientWidth,
    scroll: root.scrollWidth,
    diff: root.scrollWidth - root.clientWidth,
    documentOverflow: root.scrollWidth > root.clientWidth + 1,
    overflowers: overflowers.slice(0, 8),
    menuPosition: menuEl ? getComputedStyle(menuEl).position : '',
    menuWidth: menu ? Math.round(menu.width) : 0,
    optionCount: options.length,
    optionLabels: options.map((el) => el.textContent.trim()),
    activeLabel: (document.querySelector('.language-switcher__option--active') || {}).textContent || null,
    headerHeight: header ? Math.round(header.getBoundingClientRect().height) : 0,
    button,
    menu,
    hamburger,
    wordmark,
    heroLogo,
    headline,
    subtitle,
    cta,
    overlapsChrome: Boolean(
      menu && (intersects(menu, hamburger) || intersects(menu, wordmark) || intersects(menu, button)),
    ),
    menuRightAligned: Boolean(menu && Math.abs(menu.right - button.right) <= 2),
    menuInViewport: Boolean(
      menu &&
        menu.left >= -1 &&
        menu.right <= root.clientWidth + 1 &&
        menu.top >= 0 &&
        menu.bottom <= window.innerHeight + 1,
    ),
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-lang-menu-'));
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

async function cdpSession(
  browserWs: string,
  url: string,
  viewport: { width: number; height: number },
) {
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

describe('public header language menu mobile layout', () => {
  const css = readGlobalsCss();
  const switcher = readFileSync(SWITCHER, 'utf8');
  const chrome = findChrome();
  const mobileViewports = [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
  ];
  const desktopViewports = [
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
  ];

  it('keeps locale switching and overlays the mobile menu without changing flow', () => {
    expect(switcher).toContain('language-switcher__panel');
    expect(switcher).toContain('localeSwitchHref');
    expect(switcher).toContain('routing.locales.map');
    expect(css).toMatch(/\.language-switcher__menu \{[\s\S]*?position:\s*absolute;/);
    expect(css).toContain('.site-header .language-switcher__menu {\n    position: absolute;\n    top: calc(100% + 0.3rem);\n    right: 0;');
    expect(css).not.toContain('margin-left: calc(0px - min(10rem, calc(100vw - 1.5rem)))');
    expect(css).not.toMatch(/\.site-header \.language-switcher__menu \{[^}]*position:\s*relative/);
    expect(css).not.toMatch(/\.language-switcher__menu \{[^}]*z-index:\s*(1\d{2}|[5-9]\d)/);
  });

  (chrome ? it : it.skip)(
    'drops the open menu over the hero without moving the header or page content',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({ 'home.html': fixture(css) });
      try {
        for (const viewport of mobileViewports) {
          const session = await cdpSession(launched.wsUrl, `${server.url}/home.html`, viewport);
          try {
            const closed = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(closed.documentOverflow).toBe(false);
            expect(closed.menu).toBeNull();

            await session.evaluate('document.getElementById("switcher").open = true');
            const open = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(open.documentOverflow).toBe(false);
            expect(open.diff).toBeLessThanOrEqual(1);
            expect(open.overflowers).toEqual([]);
            expect(open.menu).not.toBeNull();
            expect(open.menuPosition).toBe('absolute');
            expect(open.headerHeight).toBe(closed.headerHeight);
            expect(Math.abs(open.headline.top - closed.headline.top)).toBeLessThanOrEqual(1);
            expect(Math.abs(open.heroLogo.top - closed.heroLogo.top)).toBeLessThanOrEqual(1);
            expect(Math.abs(open.subtitle.top - closed.subtitle.top)).toBeLessThanOrEqual(1);
            expect(Math.abs(open.cta.top - closed.cta.top)).toBeLessThanOrEqual(1);
            expect(open.menuWidth).toBeGreaterThanOrEqual(140);
            expect(open.menuWidth).toBeLessThanOrEqual(Math.min(168, viewport.width - 16));
            expect(open.optionCount).toBe(7);
            expect(open.optionLabels).toEqual([
              'ქართული',
              'English',
              'Русский',
              'Deutsch',
              'Français',
              'Italiano',
              'Español',
            ]);
            expect(open.activeLabel).toContain('English');
            expect(open.menuRightAligned).toBe(true);
            expect(open.menuInViewport).toBe(true);
            expect(open.overlapsChrome).toBe(false);
            expect(open.menu!.top).toBeGreaterThanOrEqual(open.button.bottom);

            await session.evaluate('document.getElementById("switcher").open = false');
            const restored = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(restored.menu).toBeNull();
            expect(restored.documentOverflow).toBe(false);
            expect(restored.headerHeight).toBe(closed.headerHeight);
            expect(Math.abs(restored.headline.top - closed.headline.top)).toBeLessThanOrEqual(1);
          } finally {
            session.close();
          }
        }

        for (const viewport of desktopViewports) {
          const session = await cdpSession(launched.wsUrl, `${server.url}/home.html`, viewport);
          try {
            const closed = (await session.evaluate(MEASURE_JS)) as Measure;
            await session.evaluate('document.getElementById("switcher").open = true');
            const open = (await session.evaluate(MEASURE_JS)) as Measure;
            expect(open.menuPosition).toBe('absolute');
            expect(open.menuRightAligned).toBe(true);
            expect(open.optionCount).toBe(7);
            expect(open.documentOverflow).toBe(false);
            expect(open.headerHeight).toBe(closed.headerHeight);
            expect(Math.abs(open.headline.top - closed.headline.top)).toBeLessThanOrEqual(1);
          } finally {
            session.close();
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

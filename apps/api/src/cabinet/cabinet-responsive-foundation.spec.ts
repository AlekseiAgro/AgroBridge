import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';

const WEB_SRC = join(__dirname, '../../../web/src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');

type Measure = {
  client: number;
  scroll: number;
  diff: number;
  documentOverflow: boolean;
  overflowers: Array<{ cls: string; extra: number }>;
  cabinetCols: string;
  sidebarDisplay: string;
  sidebarWidth: number;
  mainLeft: number;
  mainRight: number;
  mainWidth: number;
  navRight: number;
  mobileNavDisplay: string;
  menuVisible: boolean;
  headerRight: number;
  chipRight: number;
  fieldCols: number;
  chatCols: number;
  userCardCols: number;
  cabinetRowDir: string;
  pageMainRowDir: string;
  drawerWidth: number;
  drawerRight: number;
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

function cabinetFixture(css: string, options: { drawerOpen?: boolean } = {}): string {
  const drawer = options.drawerOpen
    ? `<div class="cabinet__drawer-root">
        <button type="button" class="cabinet__drawer-backdrop" aria-label="Close"></button>
        <div class="cabinet__drawer" role="dialog" aria-modal="true">
          <div class="cabinet__drawer-head">
            <p class="cabinet__eyebrow">Menu</p>
            <button type="button" class="cabinet__drawer-close">Close</button>
          </div>
          <nav class="cabinet__nav" aria-label="Personal cabinet">
            <a href="#overview">Overview</a>
            <div class="cabinet__nav-group">
              <p class="cabinet__nav-label">Activity</p>
              <a href="#inbox">Inbox</a>
              <a href="#chat">Chat</a>
            </div>
            <div class="cabinet__nav-group">
              <p class="cabinet__nav-label">Selling</p>
              <a href="#products">My products</a>
              <a href="#farm">My farm</a>
            </div>
            <div class="cabinet__nav-group">
              <p class="cabinet__nav-label">Market</p>
              <a href="#catalog">Catalog</a>
              <a href="#requests">Purchase requests</a>
              <a href="#quotes">My quotes</a>
            </div>
            <div class="cabinet__nav-group">
              <p class="cabinet__nav-label">Account</p>
              <a href="#settings">Settings</a>
            </div>
          </nav>
          <div class="cabinet__sidebar-foot"><button type="button">Log out</button></div>
        </div>
      </div>`
    : '';

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${css}</style>
  </head>
  <body>
    <div class="cabinet" id="host">
      <aside class="cabinet__sidebar">
        <a class="cabinet__brand" href="#home"><img class="brand-logo" alt="AgroBridge" width="177" height="89" /></a>
        <p class="cabinet__eyebrow">Personal cabinet</p>
        <nav class="cabinet__nav" aria-label="Personal cabinet">
          <a href="#overview">Overview</a>
          <div class="cabinet__nav-group">
            <p class="cabinet__nav-label">Activity</p>
            <a href="#inbox">Inbox</a>
            <a href="#chat">Chat</a>
          </div>
          <div class="cabinet__nav-group">
            <p class="cabinet__nav-label">Selling</p>
            <a href="#products">My products</a>
            <a href="#farm">My farm</a>
          </div>
          <div class="cabinet__nav-group">
            <p class="cabinet__nav-label">Market</p>
            <a href="#catalog">Catalog</a>
            <a href="#requests">Purchase requests</a>
            <a href="#quotes">My quotes</a>
          </div>
          <div class="cabinet__nav-group">
            <p class="cabinet__nav-label">Account</p>
            <a href="#settings">Settings</a>
          </div>
        </nav>
        <div class="cabinet__sidebar-foot"><button type="button">Log out</button></div>
      </aside>
      <div class="cabinet__main">
        <header class="cabinet__top">
          <div class="cabinet__top-start">
            <div class="cabinet__mobile-nav">
              <button type="button" class="cabinet__menu-button" aria-expanded="${options.drawerOpen ? 'true' : 'false'}">
                <span class="cabinet__menu-icon" aria-hidden="true"></span>
                <span class="sr-only">Menu</span>
              </button>
              ${drawer}
            </div>
            <a class="cabinet__brand cabinet__brand--bar" href="#home">
              <img class="brand-logo" alt="AgroBridge" width="177" height="89" />
            </a>
            <div>
              <h1 class="cabinet__title">My purchase requests</h1>
              <p class="cabinet__subtitle">Track offers from sellers</p>
            </div>
          </div>
          <div class="cabinet__top-actions">
            <a class="notification-bell" href="#notifications" aria-label="Notifications">N</a>
            <div class="language-switcher">
              <button type="button" class="language-switcher__button">EN</button>
            </div>
            <span class="cabinet__user-chip">farmer.longname@example.com</span>
          </div>
        </header>
        <div class="cabinet__content">
          <main class="cabinet-page">
            <form>
              <div class="field-row">
                <label class="field"><span>Quantity</span><input value="1200" /></label>
                <label class="field"><span>Unit</span><input value="kg" /></label>
              </div>
            </form>
            <section class="user-card">
              <div class="user-card__identity"><strong>Kakheti Honey Farm</strong></div>
              <div>Rating 4.8</div>
            </section>
            <ul class="product-list">
              <li class="product-list__item product-list__item--row">
                <div class="product-list__item-main">
                  <a class="product-list__title" href="#product">Organic honey</a>
                </div>
                <a class="button button--ghost" href="#open">Open</a>
              </li>
            </ul>
            <div class="chat-messenger">
              <div class="chat-messenger__sidebar">Threads</div>
              <div class="chat-messenger__pane">Conversation</div>
            </div>
          </main>
          <main class="page__main" id="public-main">
            <ul class="product-list">
              <li class="product-list__item product-list__item--row">
                <div class="product-list__item-main">
                  <a class="product-list__title" href="#request">Need walnuts</a>
                </div>
                <a class="button button--ghost" href="#open">Open</a>
              </li>
            </ul>
          </main>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

const MEASURE_JS = `(() => {
  const root = document.documentElement;
  const host = document.getElementById('host') || root;
  const hostBox = host.getBoundingClientRect();
  const overflowers = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > Math.max(hostBox.right, root.clientWidth) + 1) {
      overflowers.push({
        cls: String(el.className || el.tagName).slice(0, 80),
        extra: Math.round(r.right - root.clientWidth),
      });
    }
  }
  const cols = (el) => {
    if (!el) return 0;
    return getComputedStyle(el).gridTemplateColumns.split(' ').filter(Boolean).length;
  };
  const box = (sel) => {
    const el = document.querySelector(sel);
    return el ? el.getBoundingClientRect() : { left: 0, right: 0, width: 0, height: 0 };
  };
  const menu = document.querySelector('.cabinet__menu-button');
  const menuBox = menu ? menu.getBoundingClientRect() : { width: 0, height: 0 };
  return {
    client: root.clientWidth,
    scroll: root.scrollWidth,
    diff: root.scrollWidth - root.clientWidth,
    documentOverflow: root.scrollWidth > root.clientWidth + 1,
    overflowers: overflowers.slice(0, 8),
    cabinetCols: getComputedStyle(document.querySelector('.cabinet')).gridTemplateColumns,
    sidebarDisplay: getComputedStyle(document.querySelector('.cabinet__sidebar')).display,
    sidebarWidth: Math.round(box('.cabinet__sidebar').width),
    mainLeft: Math.round(box('.cabinet__main').left),
    mainRight: Math.round(box('.cabinet__main').right),
    mainWidth: Math.round(box('.cabinet__main').width),
    navRight: Math.round(box('.cabinet__nav').right),
    mobileNavDisplay: getComputedStyle(document.querySelector('.cabinet__mobile-nav')).display,
    menuVisible: menuBox.width > 0 && menuBox.height > 0,
    headerRight: Math.round(box('.cabinet__top-actions').right),
    chipRight: Math.round(box('.cabinet__user-chip').right),
    fieldCols: cols(document.querySelector('.field-row')),
    chatCols: cols(document.querySelector('.chat-messenger')),
    userCardCols: cols(document.querySelector('.user-card')),
    cabinetRowDir: getComputedStyle(document.querySelector('.cabinet-page .product-list__item--row')).flexDirection,
    pageMainRowDir: getComputedStyle(document.querySelector('#public-main .product-list__item--row')).flexDirection,
    drawerWidth: Math.round(box('.cabinet__drawer').width),
    drawerRight: Math.round(box('.cabinet__drawer').right),
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

function pickDebugPort(): number {
  return 20000 + Math.floor(Math.random() * 20000);
}

async function launchChrome(
  chrome: string,
): Promise<{ wsUrl: string; process: ChildProcess; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-chrome-'));
  const port = pickDebugPort();
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
      /* chrome is still starting */
    }
  }
  if (!wsUrl) {
    child.kill('SIGKILL');
    throw new Error(`Chrome did not open a DevTools port on ${port}`);
  }

  return {
    wsUrl,
    process: child,
    cleanup: () => {
      child.kill('SIGKILL');
    },
  };
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
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: viewport.width,
    height: viewport.height,
    deviceScaleFactor: 1,
    mobile: viewport.width <= 1024,
  });
  await send('Page.enable');
  await send('Page.navigate', { url });
  await new Promise((resolve) => setTimeout(resolve, 400));
  const result = (await send('Runtime.evaluate', {
    expression: MEASURE_JS,
    returnByValue: true,
  })) as { result: { value: Measure } };
  ws.close();
  return result.result.value;
}

describe('cabinet responsive foundation', () => {
  const css = readGlobalsCss();
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

  it('keeps cabinet-page width rules and scopes catalog row stacking to page__main', () => {
    expect(css).toMatch(/\.cabinet__content\s*\{[\s\S]*?container:\s*marketplace\s*\/\s*inline-size/);
    expect(css).toMatch(/\.cabinet-page\s*\{[\s\S]*?width:\s*min\(100%,\s*56rem\)/);
    expect(css).toContain('.page__main .product-list__item--row');
    expect(css).toContain('.page__main .product-list__item-main');
  });

  (chrome ? it : it.skip)(
    'fits cabinet chrome and content from 320px through desktop without hiding overflow',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({
        'cabinet.html': cabinetFixture(css),
        'cabinet-drawer.html': cabinetFixture(css, { drawerOpen: true }),
      });

      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(launched.wsUrl, `${server.url}/cabinet.html`, viewport);
          const mobile = viewport.width <= 640;
          const tabletOrDesktop = viewport.width >= 768;

          expect({
            viewport: viewport.width,
            documentOverflow: result.documentOverflow,
            overflowers: result.overflowers,
            diff: result.diff,
          }).toEqual({
            viewport: viewport.width,
            documentOverflow: false,
            overflowers: [],
            diff: expect.any(Number),
          });
          expect(result.diff).toBeLessThanOrEqual(1);
          expect(result.mainRight).toBeLessThanOrEqual(viewport.width + 1);
          expect(result.headerRight).toBeLessThanOrEqual(viewport.width + 1);
          expect(result.chipRight).toBeLessThanOrEqual(viewport.width + 1);
          expect(result.mainWidth).toBeGreaterThan(viewport.width * 0.45);

          if (mobile) {
            expect(result.sidebarDisplay).toBe('none');
            expect(result.mobileNavDisplay).not.toBe('none');
            expect(result.menuVisible).toBe(true);
            expect(result.cabinetCols.split(' ').length).toBe(1);
            expect(result.fieldCols).toBe(1);
            expect(result.chatCols).toBe(1);
            expect(result.userCardCols).toBe(1);
          }

          if (tabletOrDesktop) {
            expect(result.sidebarDisplay).not.toBe('none');
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainLeft).toBeGreaterThan(result.sidebarWidth - 8);
            expect(result.mobileNavDisplay).toBe('none');
            expect(result.menuVisible).toBe(false);
            expect(result.cabinetCols.split(' ').filter(Boolean).length).toBe(2);
            expect(result.navRight).toBeLessThanOrEqual(result.mainLeft + 1);
            expect(result.cabinetRowDir).toBe('row');
          }

          if (viewport.width === 768 || viewport.width === 820) {
            expect(result.fieldCols).toBe(1);
            expect(result.chatCols).toBe(1);
            expect(result.pageMainRowDir).toBe('column');
          }

          if (viewport.width === 1024) {
            expect(result.fieldCols).toBe(2);
            expect(result.chatCols).toBe(1);
            expect(result.userCardCols).toBe(2);
          }

          if (viewport.width === 1280) {
            expect(result.fieldCols).toBe(2);
            expect(result.chatCols).toBe(2);
            expect(result.userCardCols).toBe(2);
            expect(result.pageMainRowDir).toBe('row');
          }
        }

        for (const width of [320, 375, 390, 430]) {
          const open = await cdpEvaluate(launched.wsUrl, `${server.url}/cabinet-drawer.html`, {
            width,
            height: 800,
          });
          expect(open.documentOverflow).toBe(false);
          expect(open.diff).toBeLessThanOrEqual(1);
          expect(open.overflowers).toEqual([]);
          expect(open.drawerWidth).toBeGreaterThan(120);
          expect(open.drawerRight).toBeLessThanOrEqual(width + 1);
          expect(open.sidebarDisplay).toBe('none');
        }
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    120000,
  );
});

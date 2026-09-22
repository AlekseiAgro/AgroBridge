import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';

const WEB_SRC = join(__dirname, '../../../web/src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');
const PRODUCTS_PAGE = join(WEB_SRC, 'app/[locale]/dashboard/products/page.tsx');

type CardMeasure = {
  extra: number;
  titleExtra: number;
  statusExtra: number;
  qualityExtra: number;
  actionsExtra: number;
  buttonExtras: number[];
};

type Measure = {
  client: number;
  scroll: number;
  diff: number;
  documentOverflow: boolean;
  overflowX: { html: string; body: string; cabinet: string; item: string };
  overflowers: Array<{ cls: string; extra: number }>;
  sidebarWidth: number;
  mainWidth: number;
  contentWidth: number;
  itemDir: string;
  mainDir: string;
  titleDisplay: string;
  actionsDisplay: string;
  secondaryDisplay: string;
  actionCols: number;
  secondaryCols: number;
  mediaWidth: number;
  cards: CardMeasure[];
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

function cardHtml(options: {
  title: string;
  status: string;
  meta: string;
  score: string;
  photo: boolean;
}): string {
  const media = options.photo
    ? `<span class="product-list__media product-list__media--sm" style="display:block;background:#1f4a28"></span>`
    : `<span class="product-list__media product-list__media--sm product-photo-placeholder"><span class="product-photo-placeholder__label">No product photo</span></span>`;
  return `<li class="product-list__item product-list__item--row product-list__item--mine">
    <div class="product-list__item-main">
      ${media}
      <div class="product-list__item-body">
        <div class="product-list__identity">
          <p class="product-list__title">${options.title}</p>
          <p class="product-list__status">${options.status}</p>
        </div>
        <div class="product-quality-summary">
          <span class="quality-score-chip-wrap">
            <span class="quality-score-chip__name">Качество карточки товара</span>
            <span class="quality-score-chip">${options.score}</span>
          </span>
        </div>
        <p class="product-list__meta">${options.meta}</p>
      </div>
    </div>
    <div class="product-list__actions">
      <a class="button button--ghost product-list__action--primary" href="#preview">Посмотреть карточку</a>
      <div class="product-list__actions-secondary">
        <a class="button button--ghost" href="#edit">Изменить</a>
        <button class="button button--ghost" type="button">Удалить</button>
      </div>
    </div>
  </li>`;
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
    <div class="cabinet" id="host">
      <aside class="cabinet__sidebar"><p>Nav</p></aside>
      <div class="cabinet__main">
        <div class="cabinet__content">
          <main class="cabinet-page">
            <ul class="product-list">
              ${cardHtml({
                title: 'Honey',
                status: 'Черновик',
                meta: 'Honey · 200 kg',
                score: '72/100',
                photo: false,
              })}
              ${cardHtml({
                title:
                  'Organic Imereti mountain honey extra long harvest title for export to Germany and the Netherlands',
                status: 'Pending review after administrator clarification',
                meta: 'Honey · 1200–1800 kg · Needs clearer harvest window and origin wording',
                score: '5/100',
                photo: true,
              })}
              ${cardHtml({
                title: 'Новый товар',
                status: 'Черновик',
                meta: 'Nuts · 500 kg',
                score: '5/100',
                photo: false,
              })}
              ${cardHtml({
                title: 'Kakheti walnuts',
                status: 'Опубликован',
                meta: 'Nuts · 3 ton',
                score: '88/100',
                photo: true,
              })}
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
  const extra = (parent, child) => {
    if (!parent || !child) return 0;
    return Math.max(0, Math.round(child.getBoundingClientRect().right - parent.getBoundingClientRect().right - 1));
  };
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
  const cols = (el) => {
    if (!el) return 0;
    const value = getComputedStyle(el).gridTemplateColumns;
    if (!value || value === 'none') return 0;
    return value.split(' ').filter(Boolean).length;
  };
  const first = document.querySelector('.product-list__item--mine');
  const cards = [...document.querySelectorAll('.product-list__item--mine')].map((card) => {
    const buttons = [...card.querySelectorAll('.product-list__actions .button')];
    return {
      extra: extra(document.querySelector('.cabinet__content'), card),
      titleExtra: extra(card, card.querySelector('.product-list__title')),
      statusExtra: extra(card, card.querySelector('.product-list__status')),
      qualityExtra: extra(card, card.querySelector('.product-quality-summary')),
      actionsExtra: extra(card, card.querySelector('.product-list__actions')),
      buttonExtras: buttons.map((button) => extra(card, button)),
    };
  });
  return {
    client: root.clientWidth,
    scroll: root.scrollWidth,
    diff: root.scrollWidth - root.clientWidth,
    documentOverflow: root.scrollWidth > root.clientWidth + 1,
    overflowX: {
      html: getComputedStyle(root).overflowX,
      body: getComputedStyle(document.body).overflowX,
      cabinet: getComputedStyle(document.querySelector('.cabinet')).overflowX,
      item: first ? getComputedStyle(first).overflowX : '',
    },
    overflowers: overflowers.slice(0, 8),
    sidebarWidth: Math.round(document.querySelector('.cabinet__sidebar').getBoundingClientRect().width),
    mainWidth: Math.round(document.querySelector('.cabinet__main').getBoundingClientRect().width),
    contentWidth: Math.round(document.querySelector('.cabinet__content').getBoundingClientRect().width),
    itemDir: first ? getComputedStyle(first).flexDirection : '',
    mainDir: getComputedStyle(document.querySelector('.product-list__item--mine .product-list__item-main')).flexDirection,
    titleDisplay: getComputedStyle(document.querySelector('.product-list__item--mine .product-list__title')).display,
    actionsDisplay: getComputedStyle(document.querySelector('.product-list__item--mine .product-list__actions')).display,
    secondaryDisplay: getComputedStyle(document.querySelector('.product-list__item--mine .product-list__actions-secondary')).display,
    actionCols: cols(document.querySelector('.product-list__item--mine .product-list__actions')),
    secondaryCols: cols(document.querySelector('.product-list__item--mine .product-list__actions-secondary')),
    mediaWidth: Math.round(document.querySelector('.product-list__item--mine .product-list__media').getBoundingClientRect().width),
    cards,
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-mine-cards-'));
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

describe('My Products mobile cards', () => {
  const css = readGlobalsCss();
  const page = readFileSync(PRODUCTS_PAGE, 'utf8');
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

  it('scopes the mobile hierarchy to My Products cards only', () => {
    expect(page).toContain('product-list__item--mine');
    expect(page).toContain('product-list__identity');
    expect(page).toContain('product-list__status');
    expect(page).toContain('product-list__action--primary');
    expect(page).toContain('product-list__actions-secondary');
    expect(page).toContain("t('preview')");
    expect(page).toContain("t('edit')");
    expect(page).toContain('DeleteProductButton');
    expect(page).toContain("t(`moderation.${product.moderationStatus}`)");
    expect(css).toContain('.product-list__item--mine .product-list__title');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('.product-list__item--mine .product-list__actions-secondary');
    expect(css).toContain('flex-wrap: nowrap');
    expect(css).toMatch(/\.product-list__item--mine \.product-list__item-main \{[\s\S]*?flex:\s*none/);
    expect(css).toMatch(/\.product-list__item--mine \.product-list__actions \{[\s\S]*?flex:\s*none/);
    expect(css).not.toMatch(/\.product-list__item--mine[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/\.cabinet\s*\{[^}]*overflow-x:\s*hidden/);
  });

  (chrome ? it : it.skip)(
    'keeps every My Products card inside the cabinet column from 320 through desktop',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({ 'mine.html': fixture(css) });
      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(launched.wsUrl, `${server.url}/mine.html`, viewport);
          const mobile = viewport.width <= 640;
          const tablet = viewport.width === 768 || viewport.width === 820 || viewport.width === 1024;

          expect(result.documentOverflow).toBe(false);
          expect(result.diff).toBeLessThanOrEqual(1);
          expect(result.overflowers).toEqual([]);
          expect(result.overflowX.html).not.toBe('hidden');
          expect(result.overflowX.body).not.toBe('hidden');
          expect(result.overflowX.cabinet).not.toBe('hidden');
          expect(result.overflowX.item).not.toBe('hidden');
          expect(result.cards).toHaveLength(4);
          expect(result.titleDisplay).toBe('block');
          for (const card of result.cards) {
            expect(card.extra).toBe(0);
            expect(card.titleExtra).toBe(0);
            expect(card.statusExtra).toBe(0);
            expect(card.qualityExtra).toBe(0);
            expect(card.actionsExtra).toBe(0);
            expect(card.buttonExtras.every((value) => value === 0)).toBe(true);
          }

          if (mobile || viewport.width === 768 || viewport.width === 820) {
            expect(result.itemDir).toBe('column');
            expect(result.mainDir).toBe('column');
            expect(result.actionsDisplay).toBe('grid');
            expect(result.actionCols).toBe(1);
            expect(result.secondaryCols).toBe(2);
            expect(result.mediaWidth).toBeGreaterThan(result.contentWidth * 0.8);
          }

          if (viewport.width === 1024) {
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainWidth).toBeLessThan(800);
            expect(result.actionsDisplay).toBe('grid');
            expect(result.actionCols).toBe(1);
            expect(result.secondaryCols).toBe(2);
          }

          if (tablet) {
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainWidth).toBeLessThan(viewport.width - 200);
          }

          if (viewport.width === 1280) {
            expect(result.itemDir).toBe('row');
            expect(result.mainDir).toBe('row');
            expect(result.actionsDisplay).toBe('flex');
            expect(result.secondaryDisplay).toBe('contents');
            expect(result.mediaWidth).toBeLessThan(90);
            expect(result.sidebarWidth).toBeGreaterThan(200);
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

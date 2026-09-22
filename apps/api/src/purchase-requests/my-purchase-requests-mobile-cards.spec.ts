import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';
import { requestStatusBadgeClass } from '../../../web/src/lib/request-card-presentation';

const WEB = join(__dirname, '../../../web');
const WEB_SRC = join(WEB, 'src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');
const MINE_PAGE = join(WEB_SRC, 'app/[locale]/dashboard/purchase-requests/page.tsx');
const BOARD_PAGE = join(WEB_SRC, 'app/[locale]/requests/page.tsx');
const REQUEST_LIST = join(WEB_SRC, 'components/PurchaseRequestList.tsx');
const RFQ_LIST = join(WEB_SRC, 'components/RfqList.tsx');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

type CardMeasure = {
  extra: number;
  titleExtra: number;
  statusExtra: number;
  categoryExtra: number;
  qtyExtra: number;
  destinationExtra: number;
  partyExtra: number;
  contextExtra: number;
  actionsExtra: number;
  buttonExtras: number[];
  status: string;
  statusClass: string;
  statusBackground: string;
  cardBackground: string;
  slots: string[];
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
  titleDisplay: string;
  actionsDisplay: string;
  actionCols: number;
  actionWidth: number;
  dateDisplay: string;
  identityDisplay: string;
  partyDisplay: string;
  bodyCols: number;
  cards: CardMeasure[];
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

function cardHtml(options: {
  status: 'open' | 'closed' | 'cancelled' | 'fulfilled';
  statusLabel: string;
  title: string;
  category: string;
  qty: string;
  destination: string;
  party: string;
  context: string;
}): string {
  return `<li class="product-list__item product-list__item--row product-list__item--mine-requests" data-request-status="${options.status}">
    <div class="product-list__item-main">
      <div class="product-list__item-body">
        <div class="product-list__identity">
          <a class="product-list__title" href="#request">${options.title}</a>
          <span class="harvest-badge request-status request-status--${options.status}">${options.statusLabel}</span>
        </div>
        <p class="product-list__category">${options.category}</p>
        <p class="product-list__qty">${options.qty}</p>
        <p class="product-list__destination">${options.destination}</p>
        <p class="product-list__party"><a class="profile-link" href="#buyer">${options.party}</a></p>
        <p class="product-list__context">${options.context}</p>
      </div>
    </div>
    <p class="product-list__date">Опубликован 22 сент. 2026</p>
    <div class="product-list__actions">
      <a class="button button--ghost product-list__action--primary" href="#open">Открыть</a>
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
                status: 'open',
                statusLabel: 'Открыт',
                title: 'Голубика',
                category: 'Ягоды',
                qty: '500 Килограмм',
                destination: 'ОАЭ',
                party: 'Aleksei',
                context: 'предложений: 2',
              })}
              ${cardHtml({
                status: 'fulfilled',
                statusLabel: 'Предложение принято',
                title:
                  'Organic Imereti mountain blueberries extra long harvest request for export to Germany and the Netherlands',
                category: 'Ягоды',
                qty: '2,000 liter',
                destination: 'Germany',
                party: 'Very long buyer display name from Kakheti cooperative',
                context: 'предложений: 4',
              })}
              ${cardHtml({
                status: 'closed',
                statusLabel: 'Closed',
                title: 'Kakheti walnuts awaiting buyer decision with a long English title',
                category: 'Nuts',
                qty: '500 kg',
                destination: 'United Arab Emirates',
                party: 'Buyer',
                context: '3 quotes',
              })}
              ${cardHtml({
                status: 'cancelled',
                statusLabel: 'Cancelado después de una revisión administrativa adicional',
                title: 'Nuevo pedido de avellanas',
                category: 'Frutos secos',
                qty: '1 200 kg',
                destination: 'España',
                party: 'Marie',
                context: '4 ofertas',
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
  const first = document.querySelector('.product-list__item--mine-requests');
  const action = document.querySelector('.product-list__item--mine-requests .product-list__action--primary');
  const cards = [...document.querySelectorAll('.product-list__item--mine-requests')].map((card) => {
    const buttons = [...card.querySelectorAll('.product-list__actions .button')];
    const body = card.querySelector('.product-list__item-body');
    const status = card.querySelector('.request-status');
    return {
      extra: extra(document.querySelector('.cabinet__content'), card),
      titleExtra: extra(card, card.querySelector('.product-list__title')),
      statusExtra: extra(card, status),
      categoryExtra: extra(card, card.querySelector('.product-list__category')),
      qtyExtra: extra(card, card.querySelector('.product-list__qty')),
      destinationExtra: extra(card, card.querySelector('.product-list__destination')),
      partyExtra: extra(card, card.querySelector('.product-list__party')),
      contextExtra: extra(card, card.querySelector('.product-list__context')),
      actionsExtra: extra(card, card.querySelector('.product-list__actions')),
      buttonExtras: buttons.map((button) => extra(card, button)),
      status: card.getAttribute('data-request-status') || '',
      statusClass: status?.className || '',
      statusBackground: status ? getComputedStyle(status).backgroundColor : '',
      cardBackground: getComputedStyle(card).backgroundColor,
      slots: [...(body ? body.children : [])].map((el) => el.className.split(' ')[0]),
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
    titleDisplay: getComputedStyle(document.querySelector('.product-list__item--mine-requests .product-list__title')).display,
    actionsDisplay: getComputedStyle(document.querySelector('.product-list__item--mine-requests .product-list__actions')).display,
    actionCols: cols(document.querySelector('.product-list__item--mine-requests .product-list__actions')),
    actionWidth: action ? Math.round(action.getBoundingClientRect().width) : 0,
    dateDisplay: getComputedStyle(document.querySelector('.product-list__item--mine-requests .product-list__date')).display,
    identityDisplay: getComputedStyle(document.querySelector('.product-list__item--mine-requests .product-list__identity')).display,
    partyDisplay: getComputedStyle(document.querySelector('.product-list__item--mine-requests .product-list__party')).display,
    bodyCols: cols(document.querySelector('.product-list__item--mine-requests .product-list__item-body')),
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-request-cards-'));
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

function parseRgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (!match) return [255, 255, 255];
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

describe('My Purchase Requests mobile cards', () => {
  const css = readGlobalsCss();
  const page = readFileSync(MINE_PAGE, 'utf8');
  const board = readFileSync(BOARD_PAGE, 'utf8');
  const list = readFileSync(REQUEST_LIST, 'utf8');
  const rfqList = readFileSync(RFQ_LIST, 'utf8');
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

  it('scopes the stacked request card to My Purchase Requests only', () => {
    expect(page).toContain('PurchaseRequestList');
    expect(page).toContain('variant="mine"');
    expect(page).toContain('RfqList');
    expect(page).toContain('id="my-requests"');
    expect(board).toContain('PurchaseRequestList');
    expect(board).not.toContain('variant="mine"');
    expect(board).not.toContain('product-list__item--mine-requests');
    expect(list).toContain("variant = 'board'");
    expect(list).toContain("variant === 'mine'");
    expect(list).toContain('product-list__item--mine-requests');
    expect(list).toContain('product-list__identity');
    expect(list).toContain('requestStatusBadgeClass(item.status)');
    expect(list).toContain("t(`statuses.${item.status}`)");
    expect(list).toContain("t('view')");
    expect(list).toContain('product-list__action--primary');
    expect(list).toContain("t('quoteCount', { count: item.quoteCount })");
    expect(list).toContain("t('publishedAt', { date: formatCabinetDate(item.createdAt, locale) })");
    expect(list).toContain('item.destinationCountry');
    expect(list).not.toContain('OpenChatButton');
    expect(list).not.toContain('PurchaseRequestActionButton');
    expect(list).not.toContain('сделк');
    expect(list).not.toContain('транзакц');
    expect(rfqList).not.toContain('product-list__item--mine-requests');
    expect(css).toContain('.product-list__item--mine-requests .product-list__title');
    expect(css).toContain('.product-list__item--mine-requests .request-status');
    expect(css).toContain('@media (min-width: 1024px)');
    expect(css).toContain('@media (max-width: 767px)');
    expect(css).toContain('.harvest-badge.request-status--open');
    expect(css).toContain('.harvest-badge.request-status--closed');
    expect(css).toContain('.harvest-badge.request-status--cancelled');
    expect(css).toContain('.harvest-badge.request-status--fulfilled');
    expect(css).not.toMatch(/\.product-list__item--mine-requests[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/\.cabinet\s*\{[^}]*overflow-x:\s*hidden/);
    expect(requestStatusBadgeClass('open')).toBe('harvest-badge request-status request-status--open');
    expect(requestStatusBadgeClass('cancelled')).toBe(
      'harvest-badge request-status request-status--cancelled',
    );
  });

  it('keeps existing purchase-request wording in all locales', () => {
    expect(readMsg(messages('ru'), 'purchaseRequests.statuses.open')).toBe('Открыт');
    expect(readMsg(messages('ru'), 'purchaseRequests.statuses.closed')).toBe('Закрыт');
    expect(readMsg(messages('ru'), 'purchaseRequests.statuses.cancelled')).toBe('Отменён');
    expect(readMsg(messages('ru'), 'purchaseRequests.statuses.fulfilled')).toBe('Предложение принято');
    expect(readMsg(messages('ru'), 'purchaseRequests.view')).toBe('Открыть');
    expect(readMsg(messages('en'), 'purchaseRequests.statuses.open')).toBe('Open');
    expect(readMsg(messages('en'), 'purchaseRequests.view')).toBe('Open');

    for (const locale of LOCALES) {
      const open = readMsg(messages(locale), 'purchaseRequests.statuses.open');
      const closed = readMsg(messages(locale), 'purchaseRequests.statuses.closed');
      const cancelled = readMsg(messages(locale), 'purchaseRequests.statuses.cancelled');
      const fulfilled = readMsg(messages(locale), 'purchaseRequests.statuses.fulfilled');
      const view = readMsg(messages(locale), 'purchaseRequests.view');
      const quoteCount = readMsg(messages(locale), 'purchaseRequests.quoteCount');
      const publishedAt = readMsg(messages(locale), 'purchaseRequests.publishedAt');
      const haystack = [open, closed, cancelled, fulfilled, view, quoteCount, publishedAt]
        .join('\n')
        .toLowerCase();
      expect(publishedAt).toContain('{date}');
      expect(open.trim().length).toBeGreaterThan(0);
      expect(closed.trim().length).toBeGreaterThan(0);
      expect(cancelled.trim().length).toBeGreaterThan(0);
      expect(fulfilled.trim().length).toBeGreaterThan(0);
      expect(view.trim().length).toBeGreaterThan(0);
      expect(haystack).not.toContain('котиров');
      expect(haystack).not.toContain('quotation');
      expect(haystack).not.toMatch(/\brfq\b/);
    }
  });

  (chrome ? it : it.skip)(
    'keeps open and other request cards aligned from 320 through desktop',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({ 'requests.html': fixture(css) });
      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(launched.wsUrl, `${server.url}/requests.html`, viewport);
          const mobile = viewport.width <= 640;
          const tablet = viewport.width === 768 || viewport.width === 820;
          const desktop = viewport.width >= 1024;

          expect(result.documentOverflow).toBe(false);
          expect(result.diff).toBeLessThanOrEqual(1);
          expect(result.overflowers).toEqual([]);
          expect(result.overflowX.html).not.toBe('hidden');
          expect(result.overflowX.body).not.toBe('hidden');
          expect(result.overflowX.cabinet).not.toBe('hidden');
          expect(result.overflowX.item).not.toBe('hidden');
          expect(result.cards).toHaveLength(4);
          expect(result.titleDisplay).toBe('block');

          const open = result.cards.find((card) => card.status === 'open');
          const fulfilled = result.cards.find((card) => card.status === 'fulfilled');
          const closed = result.cards.find((card) => card.status === 'closed');
          const cancelled = result.cards.find((card) => card.status === 'cancelled');
          expect(open).toBeDefined();
          expect(fulfilled).toBeDefined();
          expect(closed).toBeDefined();
          expect(cancelled).toBeDefined();
          expect(open?.slots).toEqual(fulfilled?.slots);
          expect(open?.slots).toEqual([
            'product-list__identity',
            'product-list__category',
            'product-list__qty',
            'product-list__destination',
            'product-list__party',
            'product-list__context',
          ]);
          expect(open?.statusClass).toContain('request-status--open');
          expect(fulfilled?.statusClass).toContain('request-status--fulfilled');
          expect(closed?.statusClass).toContain('request-status--closed');
          expect(cancelled?.statusClass).toContain('request-status--cancelled');
          expect(open?.cardBackground).toBe(fulfilled?.cardBackground);
          expect(open?.statusBackground).not.toBe(open?.cardBackground);
          expect(open?.statusBackground).not.toBe(closed?.statusBackground);
          expect(open?.statusBackground).not.toBe(cancelled?.statusBackground);
          expect(fulfilled?.statusBackground).not.toBe(cancelled?.statusBackground);

          const openRgb = parseRgb(open?.statusBackground || '');
          const cancelledRgb = parseRgb(cancelled?.statusBackground || '');
          expect(openRgb[1]).toBeGreaterThan(openRgb[0]);
          expect(cancelledRgb[0]).toBeGreaterThan(cancelledRgb[1]);

          for (const card of result.cards) {
            expect(card.extra).toBe(0);
            expect(card.titleExtra).toBe(0);
            expect(card.statusExtra).toBe(0);
            expect(card.categoryExtra).toBe(0);
            expect(card.qtyExtra).toBe(0);
            expect(card.destinationExtra).toBe(0);
            expect(card.partyExtra).toBe(0);
            expect(card.contextExtra).toBe(0);
            expect(card.actionsExtra).toBe(0);
            expect(card.buttonExtras.every((value) => value === 0)).toBe(true);
            expect(card.slots).toEqual(open?.slots);
            expect(card.statusBackground).not.toBe('rgba(0, 0, 0, 0)');
            expect(card.statusBackground).not.toBe('transparent');
            expect(card.statusBackground).not.toBe('rgba(255, 255, 255, 0.7)');
          }

          if (mobile || tablet) {
            expect(result.itemDir).toBe('column');
            expect(result.actionsDisplay).toBe('grid');
            expect(result.actionCols).toBe(1);
            expect(result.actionWidth).toBeGreaterThan(result.contentWidth * 0.7);
          }

          if (mobile) {
            expect(result.dateDisplay).toBe('block');
            expect(result.identityDisplay).toBe('flex');
            expect(result.partyDisplay).toBe('none');
          }

          if (tablet) {
            expect(result.dateDisplay).toBe('none');
            expect(result.identityDisplay).toBe('grid');
            expect(result.partyDisplay).not.toBe('none');
          }

          if (viewport.width === 1024) {
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainWidth).toBeLessThan(800);
          }

          if (tablet) {
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainWidth).toBeLessThan(viewport.width - 200);
          }

          if (desktop) {
            expect(result.dateDisplay).toBe('block');
            expect(result.identityDisplay).toBe('flex');
            expect(result.partyDisplay).toBe('none');
            expect(result.bodyCols).toBe(4);
            expect(result.actionsDisplay).toBe('flex');
            expect(result.actionWidth).toBeLessThan(280);
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

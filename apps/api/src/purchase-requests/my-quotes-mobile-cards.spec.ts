import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { join } from 'path';
import { AddressInfo } from 'net';

const WEB = join(__dirname, '../../../web');
const WEB_SRC = join(WEB, 'src');
const GLOBALS_CSS = join(WEB_SRC, 'app/globals.css');
const QUOTES_PAGE = join(WEB_SRC, 'app/[locale]/dashboard/quotes/page.tsx');
const QUOTES_LIST = join(WEB_SRC, 'components/PurchaseQuoteList.tsx');
const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;

type Nested = Record<string, unknown>;

type CardMeasure = {
  extra: number;
  titleExtra: number;
  statusExtra: number;
  priceExtra: number;
  qtyExtra: number;
  partyExtra: number;
  contextExtra: number;
  actionsExtra: number;
  buttonExtras: number[];
  status: string;
  statusClass: string;
  slots: string[];
  cardBackground: string;
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
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn';
  statusLabel: string;
  title: string;
  price: string;
  qty: string;
  party: string;
  context: string;
}): string {
  return `<li class="product-list__item product-list__item--row product-list__item--quotes" data-quote-status="${options.status}">
    <div class="product-list__item-main">
      <div class="product-list__item-body">
        <div class="product-list__identity">
          <a class="product-list__title" href="#request">${options.title}</a>
          <span class="harvest-badge quote-status quote-status--${options.status}">${options.statusLabel}</span>
        </div>
        <p class="product-list__price">${options.price}</p>
        <p class="product-list__qty">${options.qty}</p>
        <p class="product-list__party"><a class="profile-link" href="#buyer">${options.party}</a></p>
        <p class="product-list__context">${options.context}</p>
      </div>
    </div>
    <div class="product-list__actions">
      <a class="button button--ghost product-list__action--primary" href="#open">Открыть запрос</a>
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
                status: 'pending',
                statusLabel: 'Ожидает',
                title: 'Honey',
                price: '7.00 GEL',
                qty: '200 kg',
                party: 'Gabriel',
                context: 'Открыт',
              })}
              ${cardHtml({
                status: 'accepted',
                statusLabel: 'Принято',
                title:
                  'Organic Imereti mountain honey extra long harvest request for export to Germany and the Netherlands',
                price: '12.50 USD',
                qty: '2,000 liter',
                party: 'Very long buyer display name from Kakheti cooperative',
                context: 'Предложение принято',
              })}
              ${cardHtml({
                status: 'pending',
                statusLabel: 'Pending',
                title: 'Kakheti walnuts awaiting buyer decision with a long English title',
                price: '3.00 GEL',
                qty: '500 kg',
                party: 'Buyer',
                context: 'Open',
              })}
              ${cardHtml({
                status: 'declined',
                statusLabel: 'Ausstehend after administrator clarification is still pending review',
                title: 'Новый запрос на фундук',
                price: '18.00 EUR',
                qty: '1 200 kg',
                party: 'Marie',
                context: 'Quote accepted after the buyer chose this offer',
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
  const first = document.querySelector('.product-list__item--quotes');
  const action = document.querySelector('.product-list__item--quotes .product-list__action--primary');
  const cards = [...document.querySelectorAll('.product-list__item--quotes')].map((card) => {
    const buttons = [...card.querySelectorAll('.product-list__actions .button')];
    const body = card.querySelector('.product-list__item-body');
    return {
      extra: extra(document.querySelector('.cabinet__content'), card),
      titleExtra: extra(card, card.querySelector('.product-list__title')),
      statusExtra: extra(card, card.querySelector('.quote-status')),
      priceExtra: extra(card, card.querySelector('.product-list__price')),
      qtyExtra: extra(card, card.querySelector('.product-list__qty')),
      partyExtra: extra(card, card.querySelector('.product-list__party')),
      contextExtra: extra(card, card.querySelector('.product-list__context')),
      actionsExtra: extra(card, card.querySelector('.product-list__actions')),
      buttonExtras: buttons.map((button) => extra(card, button)),
      status: card.getAttribute('data-quote-status') || '',
      statusClass: card.querySelector('.quote-status')?.className || '',
      slots: [...(body ? body.children : [])].map((el) => el.className.split(' ')[0]),
      cardBackground: getComputedStyle(card).backgroundColor,
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
    titleDisplay: getComputedStyle(document.querySelector('.product-list__item--quotes .product-list__title')).display,
    actionsDisplay: getComputedStyle(document.querySelector('.product-list__item--quotes .product-list__actions')).display,
    actionCols: cols(document.querySelector('.product-list__item--quotes .product-list__actions')),
    actionWidth: action ? Math.round(action.getBoundingClientRect().width) : 0,
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-quote-cards-'));
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

describe('My Quotes mobile cards', () => {
  const css = readGlobalsCss();
  const page = readFileSync(QUOTES_PAGE, 'utf8');
  const list = readFileSync(QUOTES_LIST, 'utf8');
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

  it('keeps a stable My Quotes hierarchy with existing quote badges', () => {
    expect(page).toContain('PurchaseQuoteList');
    expect(list).toContain('product-list__item--quotes');
    expect(list).toContain('product-list__identity');
    expect(list).toContain('quoteStatusBadgeClass(item.status)');
    expect(list).toContain("t(`quoteStatuses.${item.status}`)");
    expect(list).toContain('formatQuotePrice(item.priceAmount, item.currency)');
    expect(list).toContain('item.request.quantity');
    expect(list).toContain("t(`statuses.${item.request.status}`)");
    expect(list).toContain("t('openRequest')");
    expect(list).toContain('product-list__action--primary');
    expect(list).not.toContain('quote-list');
    expect(list).not.toContain('quoteStatusHints');
    expect(list).not.toContain('OpenChatButton');
    expect(list).not.toContain('сделк');
    expect(list).not.toContain('транзакц');
    expect(css).toContain('.product-list__item--quotes .product-list__title');
    expect(css).toContain('.product-list__item--quotes .quote-status');
    expect(css).toContain('.quote-status--pending');
    expect(css).toContain('.quote-status--accepted');
    expect(css).not.toContain('.quote-list__item');
    expect(css).not.toMatch(/\.product-list__item--quotes[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/\.cabinet\s*\{[^}]*overflow-x:\s*hidden/);
  });

  it('keeps existing quote status wording in all locales', () => {
    expect(readMsg(messages('ru'), 'purchaseRequests.quoteStatuses.pending')).toBe('Ожидает');
    expect(readMsg(messages('ru'), 'purchaseRequests.quoteStatuses.accepted')).toBe('Принято');
    expect(readMsg(messages('ru'), 'purchaseRequests.openRequest')).toBe('Открыть запрос');
    expect(readMsg(messages('ru'), 'purchaseRequests.statuses.fulfilled')).toBe('Предложение принято');
    expect(readMsg(messages('en'), 'purchaseRequests.quoteStatuses.pending')).toBe('Pending');
    expect(readMsg(messages('en'), 'purchaseRequests.quoteStatuses.accepted')).toBe('Accepted');

    for (const locale of LOCALES) {
      const pending = readMsg(messages(locale), 'purchaseRequests.quoteStatuses.pending');
      const accepted = readMsg(messages(locale), 'purchaseRequests.quoteStatuses.accepted');
      const declined = readMsg(messages(locale), 'purchaseRequests.quoteStatuses.declined');
      const withdrawn = readMsg(messages(locale), 'purchaseRequests.quoteStatuses.withdrawn');
      const openRequest = readMsg(messages(locale), 'purchaseRequests.openRequest');
      const fulfilled = readMsg(messages(locale), 'purchaseRequests.statuses.fulfilled');
      const haystack = [pending, accepted, declined, withdrawn, openRequest, fulfilled]
        .join('\n')
        .toLowerCase();
      expect(pending.trim().length).toBeGreaterThan(0);
      expect(accepted.trim().length).toBeGreaterThan(0);
      expect(openRequest.trim().length).toBeGreaterThan(0);
      expect(haystack).not.toContain('котиров');
      expect(haystack).not.toContain('quotation');
      expect(haystack).not.toMatch(/\brfq\b/);
    }
  });

  (chrome ? it : it.skip)(
    'keeps pending and accepted quote cards aligned from 320 through desktop',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({ 'quotes.html': fixture(css) });
      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(launched.wsUrl, `${server.url}/quotes.html`, viewport);
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

          const pending = result.cards.find((card) => card.status === 'pending');
          const accepted = result.cards.find((card) => card.status === 'accepted');
          expect(pending).toBeDefined();
          expect(accepted).toBeDefined();
          expect(pending?.slots).toEqual(accepted?.slots);
          expect(pending?.slots).toEqual([
            'product-list__identity',
            'product-list__price',
            'product-list__qty',
            'product-list__party',
            'product-list__context',
          ]);
          expect(pending?.statusClass).toContain('quote-status--pending');
          expect(accepted?.statusClass).toContain('quote-status--accepted');
          expect(pending?.cardBackground).toBe(accepted?.cardBackground);

          for (const card of result.cards) {
            expect(card.extra).toBe(0);
            expect(card.titleExtra).toBe(0);
            expect(card.statusExtra).toBe(0);
            expect(card.priceExtra).toBe(0);
            expect(card.qtyExtra).toBe(0);
            expect(card.partyExtra).toBe(0);
            expect(card.contextExtra).toBe(0);
            expect(card.actionsExtra).toBe(0);
            expect(card.buttonExtras.every((value) => value === 0)).toBe(true);
            expect(card.slots).toEqual(pending?.slots);
          }

          if (mobile || viewport.width === 768 || viewport.width === 820) {
            expect(result.itemDir).toBe('column');
            expect(result.actionsDisplay).toBe('grid');
            expect(result.actionCols).toBe(1);
            expect(result.actionWidth).toBeGreaterThan(result.contentWidth * 0.7);
          }

          if (viewport.width === 1024) {
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainWidth).toBeLessThan(800);
            expect(result.actionsDisplay).toBe('grid');
            expect(result.actionCols).toBe(1);
          }

          if (tablet) {
            expect(result.sidebarWidth).toBeGreaterThan(200);
            expect(result.mainWidth).toBeLessThan(viewport.width - 200);
          }

          if (viewport.width === 1280) {
            expect(result.itemDir).toBe('row');
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

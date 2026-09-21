import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'fs';
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
  overflowers: Array<{ cls: string; extra: number }>;
  filterCols: string;
  rowDir: string;
  tipWidth: number;
  ctaPosition: string;
  ctaCoversSearch: boolean;
  ctaCoversFirst: boolean;
  filterOverlap: boolean;
  searchClickable: boolean;
  firstCardClickable: boolean;
  horizontalOverflow: boolean;
};

function readGlobalsCss(): string {
  return readFileSync(GLOBALS_CSS, 'utf8')
    .replace(/@import\s+['"]tailwindcss['"]\s*;/, '')
    .replace(/@theme\s+inline\s*\{[\s\S]*?\n\}/, '');
}

function extractContainerBlock(
  css: string,
  query = '@container marketplace (max-width: 40rem)',
): string {
  const start = css.indexOf(query);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return '';
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

function pageMain(options: { longCta?: boolean } = {}): string {
  const ctaLabel = options.longCta ? 'შესყიდვის მოთხოვნის გამოქვეყნება' : 'List your product';
  const searchLabel = options.longCta ? 'ძებნა' : 'Search';
  const categoryLabel = options.longCta ? 'კატეგორია' : 'Category';
  return `<main class="page__main">
    <div class="page__heading-row">
      <h1>Catalog</h1>
      <a class="button button--primary" href="#">Publish request</a>
    </div>
    <form class="catalog-filters">
      <label class="field"><span>${searchLabel}</span><input value="honey" /></label>
      <label class="field"><span>${categoryLabel} <span class="field__optional">optional</span></span>
        <select><option>All categories</option></select>
      </label>
      <label class="field"><span>Region <span class="field__optional">optional</span></span>
        <select><option>All regions</option></select>
      </label>
      <label class="field"><span>Harvest <span class="field__optional">optional</span></span>
        <select><option>All statuses</option></select>
      </label>
      <label class="check-row"><input type="checkbox" /><span>In season</span></label>
      <label class="check-row"><input type="checkbox" /><span>Pre-order</span></label>
      <button class="button button--primary" type="button">Search</button>
    </form>
    <ul class="product-list">
      <li class="product-list__item product-list__item--row">
        <div class="product-list__item-main">
          <a class="product-list__title" href="#">Need 5 tonnes of organic walnuts</a>
          <p class="product-list__meta">Nuts · 5000 kg · DE · open</p>
          <p class="product-list__meta">Buyer name · 3 offers</p>
        </div>
        <a class="button button--ghost" href="#">Open</a>
      </li>
      <li class="product-list__item product-list__item--with-media">
        <div class="product-list__media product-list__media--empty"></div>
        <div>
          <a class="product-list__title" href="#">Organic Imereti honey</a>
          <p class="product-list__meta">Imereti · Honey</p>
          <div class="product-opportunity-row">
            <span class="opportunity-badge opportunity-badge--good">
              <span class="opportunity-badge__dot"></span>
              <span>Good opportunity</span>
              <span class="opportunity-badge__tip">
                Strong demand in Germany and the Netherlands. Limited remaining volume this week.
              </span>
            </span>
          </div>
        </div>
      </li>
    </ul>
    <aside class="floating-cta" aria-label="${ctaLabel}">
      <div class="floating-cta__inner">
        <div class="floating-cta__copy">
          <p class="floating-cta__lead">${options.longCta ? 'ვერ იპოვეთ საჭირო?' : 'Looking for something else?'}</p>
          <p class="floating-cta__text">${options.longCta ? 'გამოაქვეყნეთ მოთხოვნა.' : 'Post a purchase request and let sellers reply.'}</p>
        </div>
        <a class="button button--primary floating-cta__button" href="#cta">${ctaLabel}</a>
      </div>
    </aside>
  </main>`;
}

function fixtureHtml(css: string, cabinetWidth: number | null): string {
  const shell = cabinetWidth
    ? `<div class="cabinet" id="host" style="width:${cabinetWidth}px">
        <aside class="cabinet__sidebar"><p>Nav</p></aside>
        <div class="cabinet__main">
          <div class="cabinet__content">${pageMain()}</div>
        </div>
      </div>`
    : `<div class="page" id="host" style="width:700px">${pageMain()}</div>`;

  return `<!doctype html><html><head><meta charset="utf-8" /><style>${css}</style></head><body>${shell}</body></html>`;
}

function guestViewportHtml(css: string, options: { longCta?: boolean } = {}): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><style>${css}</style></head><body><div class="page" id="host">${pageMain(options)}</div></body></html>`;
}

function extractAtRuleBlock(css: string, query: string): string {
  const start = css.indexOf(query);
  if (start < 0) return '';
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === '{') depth += 1;
    if (css[i] === '}') {
      depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
  }
  return '';
}

const MEASURE_JS = `(() => {
  const measured = document.getElementById('host') || document.documentElement;
  const client = measured.clientWidth;
  const scroll = measured.scrollWidth;
  const host = measured.getBoundingClientRect();
  const overflowers = [];
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.right > host.right + 1) {
      overflowers.push({
        cls: String(el.className || el.tagName).slice(0, 80),
        extra: Math.round(r.right - host.right),
      });
    }
  }
  const box = (el) => (el ? el.getBoundingClientRect() : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 });
  const overlaps = (a, b) =>
    a.width > 0 &&
    b.width > 0 &&
    a.left < b.right - 1 &&
    a.right > b.left + 1 &&
    a.top < b.bottom - 1 &&
    a.bottom > b.top + 1;
  const inView = (r) =>
    r.width > 0 && r.height > 0 && r.bottom > 1 && r.top < window.innerHeight - 1 && r.right > 1 && r.left < window.innerWidth - 1;
  const hit = (el) => {
    if (!el) return false;
    const r = el.getBoundingClientRect();
    if (!inView(r)) return r.width > 0 && r.height > 0;
    const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1);
    const y = Math.min(Math.max(r.top + r.height / 2, 1), window.innerHeight - 1);
    const topEl = document.elementFromPoint(x, y);
    return Boolean(topEl && (el === topEl || el.contains(topEl) || topEl.contains(el)));
  };
  const cta = document.querySelector('.floating-cta');
  const search = document.querySelector('.catalog-filters input');
  const firstCard = document.querySelector('.product-list__item');
  const filterChildren = Array.from(document.querySelectorAll('.catalog-filters > *')).map(box);
  let filterOverlap = false;
  for (let i = 0; i < filterChildren.length; i += 1) {
    for (let j = i + 1; j < filterChildren.length; j += 1) {
      if (overlaps(filterChildren[i], filterChildren[j])) filterOverlap = true;
    }
  }
  const tip = document.querySelector('.opportunity-badge__tip');
  return {
    client,
    scroll,
    diff: scroll - client,
    overflowers: overflowers.slice(0, 8),
    filterCols: getComputedStyle(document.querySelector('.catalog-filters')).gridTemplateColumns,
    rowDir: getComputedStyle(document.querySelector('.product-list__item--row')).flexDirection,
    tipWidth: tip ? Math.round(tip.getBoundingClientRect().width) : 0,
    ctaPosition: cta ? getComputedStyle(cta).position : '',
    ctaCoversSearch: overlaps(box(cta), box(search)),
    ctaCoversFirst: overlaps(box(cta), box(firstCard)),
    filterOverlap,
    searchClickable: hit(search),
    firstCardClickable: hit(firstCard),
    horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
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
  viewport?: { width: number; height: number },
): Promise<Measure> {
  const httpBase = browserWs.replace(/^ws/, 'http').replace(/\/devtools\/browser\/.*$/, '');
  const tab = JSON.parse(
    execFileSync(
      'curl',
      [
        '-sS',
        '-X',
        'PUT',
        `${httpBase}/json/new?${encodeURIComponent(viewport ? 'about:blank' : url)}`,
      ],
      {
        encoding: 'utf8',
        timeout: 5000,
      },
    ),
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
  if (viewport) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width <= 1024,
    });
    await send('Page.enable');
    await send('Page.navigate', { url });
    await new Promise((resolve) => setTimeout(resolve, 400));
  } else {
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  const result = (await send('Runtime.evaluate', {
    expression: MEASURE_JS,
    returnByValue: true,
  })) as { result: { value: Measure } };
  ws.close();
  return result.result.value;
}

describe('cabinet marketplace tablet overflow (S1)', () => {
  const css = readGlobalsCss();

  it('makes catalog/request layout follow the marketplace container, not only the viewport', () => {
    expect(css).toMatch(/container:\s*marketplace\s*\/\s*inline-size/);
    expect(css).not.toMatch(/\.page__main[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/\.cabinet[^{]*\{[^}]*overflow-x:\s*hidden/);

    const block = extractContainerBlock(css);
    expect(block).toContain('@container marketplace (max-width: 40rem)');
    expect(block).toContain('.catalog-filters');
    expect(block).toContain('grid-template-columns: 1fr');
    expect(block).toContain('.product-list__item--row');
    expect(block).toContain('flex-direction: column');

    const tip = css.match(/\.opportunity-badge__tip\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(tip).toContain('min(18.5rem, 100%)');
    expect(tip).not.toContain('72vw');
  });

  it('keeps the seller CTA in normal flow below desktop and reflows public tablet filters', () => {
    const tablet = extractAtRuleBlock(css, '@media (max-width: 1024px)');
    expect(tablet).toContain('.floating-cta');
    expect(tablet).toContain('position: static');
    expect(tablet).toContain('repeat(2, minmax(0, 1fr))');

    const phone = extractAtRuleBlock(css, '@media (max-width: 640px)');
    expect(phone).not.toMatch(/\.floating-cta\s*\{[\s\S]*bottom:\s*0/);
    expect(phone).toContain('grid-template-columns: 1fr');

    const tabletContainer = extractAtRuleBlock(css, '@container marketplace (max-width: 52rem)');
    expect(tabletContainer).toContain('repeat(2, minmax(0, 1fr))');
    expect(tabletContainer).toContain('position: static');

    expect(css).toMatch(/\.catalog-filters \.field input[\s\S]{0,120}width:\s*100%/);
    expect(css).toMatch(/\.floating-cta\s*\{[\s\S]*?position:\s*fixed/);
    expect(css).toMatch(/@media \(min-width: 1025px\)[\s\S]*?\.page:has\(\.floating-cta\)/);

    const catalogPage = readFileSync(join(WEB_SRC, 'app/[locale]/catalog/page.tsx'), 'utf8');
    const requestsPage = readFileSync(join(WEB_SRC, 'app/[locale]/requests/page.tsx'), 'utf8');
    expect(catalogPage.indexOf('<CatalogPurchaseCta')).toBeGreaterThan(-1);
    expect(catalogPage.indexOf('<CatalogFilters')).toBeLessThan(
      catalogPage.indexOf('<CatalogPurchaseCta'),
    );
    expect(catalogPage.indexOf('<CatalogPurchaseCta')).toBeLessThan(catalogPage.indexOf('</main>'));
    expect(catalogPage).not.toMatch(/<\/main>[\s\S]*CatalogPurchaseCta/);
    expect(requestsPage.indexOf('<RequestsSellCta')).toBeGreaterThan(-1);
    expect(requestsPage.indexOf('<PurchaseRequestFilters')).toBeLessThan(
      requestsPage.indexOf('<RequestsSellCta'),
    );
    expect(requestsPage.indexOf('<RequestsSellCta')).toBeLessThan(requestsPage.indexOf('</main>'));
    expect(requestsPage).not.toMatch(/<\/main>[\s\S]*RequestsSellCta/);
  });

  const chrome = findChrome();
  const widths = [641, 700, 740, 768, 779];

  (chrome ? it : it.skip)(
    'keeps a two-column cabinet without horizontal overflow at 641–779px',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const files: Record<string, string> = {};
      for (const width of [...widths, 1280]) {
        files[`cabinet-${width}.html`] = fixtureHtml(css, width);
      }
      files['guest-700.html'] = fixtureHtml(css, null);
      const server = await startStaticServer(files);

      try {
        const measure = (path: string) => cdpEvaluate(launched.wsUrl, `${server.url}/${path}`);

        for (const width of widths) {
          const result = await measure(`cabinet-${width}.html`);
          expect({
            width,
            diff: result.diff,
            overflowers: result.overflowers,
            rowDir: result.rowDir,
            filterCols: result.filterCols,
          }).toEqual(
            expect.objectContaining({
              width,
              rowDir: 'column',
            }),
          );
          expect(result.diff).toBeLessThanOrEqual(1);
          expect(result.overflowers).toEqual([]);
          expect(result.filterCols.split(' ').length).toBe(1);
          expect(result.tipWidth).toBeLessThanOrEqual(result.client);
          expect(result.filterOverlap).toBe(false);
          expect(result.ctaCoversSearch).toBe(false);
          expect(result.ctaCoversFirst).toBe(false);
        }

        const desktop = await measure('cabinet-1280.html');
        expect(desktop.diff).toBeLessThanOrEqual(1);
        expect(desktop.rowDir).toBe('row');
        expect(desktop.filterCols.split(' ').length).toBeGreaterThan(1);
        expect(desktop.ctaPosition).toBe('fixed');
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    60000,
  );

  (chrome ? it : it.skip)(
    'reflows public guest filters at 700px instead of overlapping Search',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({
        'guest-700.html': fixtureHtml(css, null),
      });
      try {
        const result = await cdpEvaluate(launched.wsUrl, `${server.url}/guest-700.html`);
        expect(result.diff).toBeLessThanOrEqual(1);
        expect(result.overflowers).toEqual([]);
        expect(result.rowDir).toBe('row');
        expect(result.filterCols.split(' ').length).toBe(2);
        expect(result.ctaPosition).toBe('static');
        expect(result.ctaCoversSearch).toBe(false);
        expect(result.ctaCoversFirst).toBe(false);
        expect(result.filterOverlap).toBe(false);
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    30000,
  );

  const viewports = [
    { width: 320, height: 720 },
    { width: 360, height: 800 },
    { width: 375, height: 812 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 480, height: 853 },
    { width: 768, height: 1024 },
    { width: 834, height: 1112 },
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
  ];

  (chrome ? it : it.skip)(
    'keeps Search, filters, and the first card clear of the seller CTA from 320px through desktop',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({
        'guest.html': guestViewportHtml(css),
        'guest-ka.html': guestViewportHtml(css, { longCta: true }),
      });
      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(launched.wsUrl, `${server.url}/guest.html`, viewport);
          const filterCount = result.filterCols.split(' ').filter(Boolean).length;
          expect({
            viewport: viewport.width,
            overflowers: result.overflowers,
            ctaPosition: result.ctaPosition,
            ctaCoversSearch: result.ctaCoversSearch,
            ctaCoversFirst: result.ctaCoversFirst,
            filterOverlap: result.filterOverlap,
            horizontalOverflow: result.horizontalOverflow,
            searchClickable: result.searchClickable,
            firstCardClickable: result.firstCardClickable,
          }).toEqual({
            viewport: viewport.width,
            overflowers: [],
            ctaPosition: viewport.width <= 1024 ? 'static' : 'fixed',
            ctaCoversSearch: false,
            ctaCoversFirst: false,
            filterOverlap: false,
            horizontalOverflow: false,
            searchClickable: true,
            firstCardClickable: true,
          });
          expect(result.diff).toBeLessThanOrEqual(1);
          if (viewport.width <= 640) expect(filterCount).toBe(1);
          else if (viewport.width <= 1024) expect(filterCount).toBe(2);
          else expect(filterCount).toBeGreaterThan(1);
        }

        const georgian = await cdpEvaluate(launched.wsUrl, `${server.url}/guest-ka.html`, {
          width: 375,
          height: 812,
        });
        expect(georgian.ctaPosition).toBe('static');
        expect(georgian.ctaCoversSearch).toBe(false);
        expect(georgian.ctaCoversFirst).toBe(false);
        expect(georgian.filterOverlap).toBe(false);
        expect(georgian.horizontalOverflow).toBe(false);
        expect(georgian.searchClickable).toBe(true);
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    120000,
  );
});

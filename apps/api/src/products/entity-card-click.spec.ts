import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import { tmpdir } from 'os';
import { join } from 'path';

const WEB_SRC = join(__dirname, '../../../web/src');

function source(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

function readGlobalsCss(): string {
  return source('app/globals.css')
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

const PIXEL =
  'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function fixture(css: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>
  <main class="page__main">
    <ul class="product-list">
      <li id="catalog" class="product-list__item product-list__item--with-media entity-card">
        <img id="catalog-media" class="product-list__media" alt="" src="${PIXEL}" />
        <div>
          <a class="product-list__title" href="/products/p1">Organic honey</a>
          <p class="product-list__meta"><a class="farm-link" href="/farms/f1">Imereti farm</a></p>
          <p id="catalog-price" class="product-list__price">€ 4.50 / kg</p>
          <p id="catalog-desc" class="product-list__desc">Mountain honey from a small orchard.</p>
          <div class="product-list__rating">
            <a class="rating-stars__count-link" href="/users/u1/reviews">(4)</a>
          </div>
        </div>
      </li>
    </ul>
  </main>
  <div class="cabinet__content">
    <ul class="product-list">
      <li id="mine" class="product-list__item product-list__item--row product-list__item--mine entity-card">
        <div class="product-list__item-main">
          <a class="product-list__media-link" href="/products/p1" aria-label="Preview">
            <img class="product-list__media product-list__media--sm" alt="" src="${PIXEL}" />
          </a>
          <div class="product-list__item-body">
            <div class="product-list__identity">
              <a class="product-list__title" href="/products/p1">Organic honey</a>
              <p id="mine-status" class="product-list__status">Published</p>
              <p class="product-list__metrics"><span id="mine-metrics">12 views</span></p>
            </div>
            <p id="mine-meta" class="product-list__meta">Honey · 10 kg</p>
          </div>
        </div>
        <div class="product-list__actions">
          <a class="button button--primary product-list__action--primary" href="/dashboard/products/p1/edit">Update availability</a>
          <details class="mine-card-menu">
            <summary class="button button--ghost mine-card-menu__trigger" aria-label="More">⋯</summary>
            <div class="mine-card-menu__panel" role="menu">
              <a class="mine-card-menu__item edit-link" href="/dashboard/products/p1/edit">Edit</a>
              <button class="mine-card-menu__item sold-out" type="button">Mark sold out</button>
              <button class="mine-card-menu__item mine-card-menu__item--danger delete-link" type="button">Delete</button>
            </div>
          </details>
        </div>
      </li>
    </ul>
    <ul class="user-notifications">
      <li id="note" class="user-notifications__item user-notifications__item--unread entity-card">
        <div class="user-notifications__main">
          <a class="product-list__title" href="/requests/r1">New quote</a>
          <p id="note-body" class="product-list__meta">A buyer sent a quote on your request.</p>
          <p class="product-list__meta">28 Sep 2026</p>
        </div>
        <button type="button" class="button button--ghost mark-read">Read</button>
      </li>
      <li id="plain" class="user-notifications__item">
        <div class="user-notifications__main">
          <p class="product-list__title">Notice without a destination</p>
          <p id="plain-body" class="product-list__meta">Nothing to open.</p>
        </div>
      </li>
    </ul>
    <ul class="harvest-watches__list">
      <li id="watch" class="harvest-watches__item product-list__item--with-media entity-card">
        <img class="product-list__media" alt="" src="${PIXEL}" />
        <div class="harvest-watches__body">
          <a class="product-list__title" href="/products/p1">Mandarins</a>
          <p id="watch-meta" class="product-list__meta"><a class="watch-farm" href="/farms/f1">Farm</a></p>
          <div class="harvest-watches__actions">
            <button type="button" class="button button--ghost unwatch">Unwatch</button>
          </div>
        </div>
      </li>
    </ul>
    <ul class="product-list">
      <li id="closed-quote" class="product-list__item product-list__item--row product-list__item--quotes">
        <p class="product-list__title">Closed request</p>
        <p id="closed-price" class="product-list__price">12.00 GEL</p>
        <a class="profile-link" href="/users/buyer">Buyer</a>
      </li>
    </ul>
  </div>
</body>
</html>`;
}

type Hit = { tag: string; cls: string; href: string | null };

async function startStaticServer(html: string): Promise<{ url: string; close: () => Promise<void> }> {
  const server = createServer((req, res) => {
    if ((req.url ?? '/') !== '/') {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(html);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise((resolve, reject) => server.close((err) => (err ? reject(err) : resolve()))),
  };
}

async function launchChrome(chrome: string): Promise<{ wsUrl: string; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-entity-cards-'));
  const port = 22000 + Math.floor(Math.random() * 20000);
  const child: ChildProcess = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
      '--force-device-scale-factor=1',
      '--window-size=1280,1400',
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
  return { wsUrl, cleanup: () => child.kill('SIGKILL') };
}

function cdp(browserWs: string) {
  const httpBase = browserWs.replace(/^ws/, 'http').replace(/\/devtools\/browser\/.*$/, '');
  const tab = JSON.parse(
    execFileSync(
      'curl',
      ['-sS', '-X', 'PUT', `${httpBase}/json/new?${encodeURIComponent('about:blank')}`],
      { encoding: 'utf8', timeout: 5000 },
    ),
  ) as { webSocketDebuggerUrl: string };
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let nextId = 0;
  const pending = new Map<number, { resolve: (value: unknown) => void; reject: (err: Error) => void }>();
  const ready = new Promise<void>((resolve, reject) => {
    ws.addEventListener('open', () => resolve());
    ws.addEventListener('error', () => reject(new Error('CDP websocket failed')));
  });
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
  return {
    ready,
    send,
    close: () => ws.close(),
  };
}

async function evaluate<T>(send: (method: string, params?: Record<string, unknown>) => Promise<unknown>, expression: string): Promise<T> {
  const result = (await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })) as { result?: { value: T } };
  return result.result!.value;
}

describe('clickable entity cards', () => {
  const catalog = source('app/[locale]/catalog/page.tsx');
  const mine = source('app/[locale]/dashboard/products/page.tsx');
  const notifications = source('components/UserNotificationsList.tsx');
  const css = source('app/globals.css');

  it('stretches the existing title link and keeps other controls above it', () => {
    expect(css).toMatch(/\.entity-card\s*\{[^}]*position:\s*relative/);
    expect(css).toMatch(/\.entity-card \.product-list__title::after\s*\{[^}]*position:\s*absolute/);
    expect(css).toMatch(/\.entity-card \.product-list__title::after\s*\{[^}]*inset:\s*0/);
    expect(css).not.toMatch(/\.entity-card \.product-list__title\s*\{[^}]*position:\s*(relative|absolute)/);
    expect(css).toContain('.entity-card .product-list__actions');
    expect(css).toContain('.entity-card .mine-card-menu');
    expect(css).toContain('.entity-card .harvest-watches__actions');
    expect(css).toContain(':not(.product-list__title)');
  });

  it('applies the pattern only where a card already has one destination', () => {
    expect(catalog).toContain('product-list__item product-list__item--with-media entity-card');
    expect(catalog).toContain('href={`/products/${product.id}`}');
    expect(catalog).toContain('href={`/farms/${product.farm.id}`}');
    expect(catalog).toContain('reviewsHref={`/users/${product.owner.id}/reviews`}');

    expect(mine).toContain('product-list__item--mine entity-card');
    expect(mine).toContain('const previewHref = `/products/${product.id}`');
    expect(mine).toContain('className="product-list__title"');
    expect(mine).toContain('className="product-list__media-link"');
    expect(mine).toContain('<MyProductCardActions');

    expect(source('components/FarmProfileView.tsx')).toContain(
      'product-list__item product-list__item--with-media entity-card',
    );
    expect(source('components/HarvestWatchesList.tsx')).toContain('entity-card');
    expect(source('components/HarvestWatchesList.tsx')).toContain("method: 'DELETE'");
    expect(source('components/RfqList.tsx')).toContain("'entity-card'");
    expect(source('components/RfqList.tsx')).toContain('<DeleteRfqButton');
    expect(source('components/PurchaseRequestList.tsx')).toContain(
      'product-list__item--mine-requests entity-card',
    );
    expect(source('components/PurchaseRequestList.tsx')).toContain(
      'product-list__item product-list__item--row entity-card',
    );
    expect(source('components/PurchaseQuoteList.tsx')).toContain(
      "item.canOpenRequest ? 'entity-card' : ''",
    );
    expect(source('app/[locale]/users/[id]/page.tsx')).toContain(
      'product-list__item entity-card',
    );

    expect(source('app/[locale]/dashboard/admin/page.tsx')).not.toContain('entity-card');
    expect(source('components/CompletedDealsList.tsx')).not.toContain('entity-card');
    expect(source('components/SellerQuoteSummary.tsx')).not.toContain('entity-card');
    expect(source('components/ProductCertificatesManager.tsx')).not.toContain('entity-card');
    expect(source('components/FarmDocumentsManager.tsx')).not.toContain('entity-card');
    expect(source('app/[locale]/requests/[id]/page.tsx')).not.toContain('entity-card');
  });

  it('does not invent a notification destination and keeps read behavior', () => {
    expect(notifications).toContain('const destination = item.href.trim()');
    expect(notifications).toContain("destination ? 'entity-card' : ''");
    expect(notifications).toContain('href={destination}');
    expect(notifications).toContain('<p className="product-list__title">{item.title}</p>');
    expect(notifications).toContain('onClick={() => void markRead(item.id)}');
    expect(notifications).toContain("fetch(`/api/notifications/${id}/read`");
    expect(notifications).toContain("fetch('/api/notifications/read-all'");
    expect(notifications).toContain('user-notifications__item--unread');
    expect(notifications).not.toMatch(/item\.href\s*\|\|/);
    expect(notifications).not.toMatch(/href=\{[^}]*\|\|/);
    expect(notifications).not.toContain("href=\"/dashboard");
    expect(notifications).not.toContain("href=\"/products");
  });

  const chrome = findChrome();

  (chrome ? it : it.skip)(
    'sends card clicks to the existing destination and leaves inner controls alone',
    async () => {
      const launched = await launchChrome(chrome!);
      const server = await startStaticServer(fixture(readGlobalsCss()));
      const session = cdp(launched.wsUrl);
      try {
        await session.ready;
        await session.send('Runtime.enable');
        await session.send('Page.enable');

        const check = async (width: number) => {
          await session.send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 1400,
            deviceScaleFactor: 1,
            mobile: width <= 640,
          });
          await session.send('Page.navigate', { url: server.url });
          await new Promise((resolve) => setTimeout(resolve, 350));
          await evaluate(
            session.send,
            `(() => {
              window.__hits = [];
              document.addEventListener('click', (event) => {
                const node = event.target.closest('a, button, summary') || event.target;
                if (node.closest('a')) event.preventDefault();
                window.__hits.push({
                  tag: node.tagName,
                  cls: String(node.className || ''),
                  href: node.getAttribute ? node.getAttribute('href') : null,
                });
              }, true);
              return true;
            })()`,
          );

          const click = async (selector: string): Promise<Hit> => {
            const point = await evaluate<{ x: number; y: number; w: number; h: number }>(
              session.send,
              `(() => {
                const el = document.querySelector(${JSON.stringify(selector)});
                el.scrollIntoView({ block: 'center', inline: 'center' });
                const r = el.getBoundingClientRect();
                return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
              })()`,
            );
            expect(point.w).toBeGreaterThan(0);
            expect(point.h).toBeGreaterThan(0);
            await evaluate(session.send, 'window.__hits = []');
            await session.send('Input.dispatchMouseEvent', {
              type: 'mousePressed',
              x: point.x,
              y: point.y,
              button: 'left',
              clickCount: 1,
            });
            await session.send('Input.dispatchMouseEvent', {
              type: 'mouseReleased',
              x: point.x,
              y: point.y,
              button: 'left',
              clickCount: 1,
            });
            const hits = await evaluate<Hit[]>(session.send, 'window.__hits');
            expect(hits).toHaveLength(1);
            return hits[0];
          };

          const catalogPrice = await click('#catalog-price');
          expect(catalogPrice.tag).toBe('A');
          expect(catalogPrice.cls).toContain('product-list__title');
          expect(catalogPrice.href).toBe('/products/p1');

          const catalogTitle = await click('#catalog .product-list__title');
          expect(catalogTitle.href).toBe('/products/p1');

          const catalogDesc = await click('#catalog-desc');
          expect(catalogDesc.href).toBe('/products/p1');
          expect(catalogDesc.cls).toContain('product-list__title');

          const catalogMedia = await click('#catalog-media');
          expect(catalogMedia.href).toBe('/products/p1');
          expect(catalogMedia.cls).toContain('product-list__title');

          const farm = await click('.farm-link');
          expect(farm.href).toBe('/farms/f1');
          expect(farm.cls).toContain('farm-link');

          const reviews = await click('.rating-stars__count-link');
          expect(reviews.href).toBe('/users/u1/reviews');

          const mineStatus = await click('#mine-status');
          expect(mineStatus.href).toBe('/products/p1');
          expect(mineStatus.cls).toContain('product-list__title');

          const mineMeta = await click('#mine-meta');
          expect(mineMeta.href).toBe('/products/p1');

          const mineMetrics = await click('#mine-metrics');
          expect(mineMetrics.href).toBe('/products/p1');

          const mineMedia = await click('#mine .product-list__media-link');
          expect(mineMedia.href).toBe('/products/p1');
          expect(mineMedia.cls).toContain('product-list__media-link');

          const primary = await click('.product-list__action--primary');
          expect(primary.href).toBe('/dashboard/products/p1/edit');
          expect(primary.cls).toContain('product-list__action--primary');

          const menu = await click('.mine-card-menu__trigger');
          expect(menu.tag).toBe('SUMMARY');
          expect(menu.href).toBeNull();

          const edit = await click('.edit-link');
          expect(edit.href).toBe('/dashboard/products/p1/edit');
          expect(edit.cls).toContain('edit-link');

          const soldOut = await click('.sold-out');
          expect(soldOut.tag).toBe('BUTTON');
          expect(soldOut.href).toBeNull();

          const deleted = await click('.delete-link');
          expect(deleted.tag).toBe('BUTTON');
          expect(deleted.cls).toContain('delete-link');
          expect(deleted.href).toBeNull();

          const noteBody = await click('#note-body');
          expect(noteBody.href).toBe('/requests/r1');
          expect(noteBody.cls).toContain('product-list__title');

          const noteTitle = await click('#note .product-list__title');
          expect(noteTitle.href).toBe('/requests/r1');

          const markRead = await click('.mark-read');
          expect(markRead.tag).toBe('BUTTON');
          expect(markRead.cls).toContain('mark-read');
          expect(markRead.href).toBeNull();

          const plain = await click('#plain-body');
          expect(plain.tag).toBe('P');
          expect(plain.href).toBeNull();

          const watchMeta = await click('#watch .product-list__title');
          expect(watchMeta.href).toBe('/products/p1');

          const watchFarm = await click('.watch-farm');
          expect(watchFarm.href).toBe('/farms/f1');

          const unwatch = await click('.unwatch');
          expect(unwatch.tag).toBe('BUTTON');
          expect(unwatch.href).toBeNull();

          const closed = await click('#closed-price');
          expect(closed.tag).toBe('P');
          expect(closed.href).toBeNull();

          const buyer = await click('#closed-quote .profile-link');
          expect(buyer.href).toBe('/users/buyer');

          const layout = await evaluate<{
            catalogStable: boolean;
            mineStable: boolean;
            noteStable: boolean;
            nested: number;
            titleFocused: boolean;
            farmFocused: boolean;
            menuFocused: boolean;
            markFocused: boolean;
            unread: boolean;
            overflow: number;
            afterPosition: string;
          }>(
            session.send,
            `(() => {
              const stable = (id) => {
                const el = document.querySelector(id);
                const before = el.offsetHeight;
                el.classList.remove('entity-card');
                const after = el.offsetHeight;
                el.classList.add('entity-card');
                return before === after && before > 0;
              };
              const catalogTitle = document.querySelector('#catalog .product-list__title');
              const farmLink = document.querySelector('.farm-link');
              const menuTrigger = document.querySelector('.mine-card-menu__trigger');
              const mark = document.querySelector('.mark-read');
              catalogTitle.focus();
              const titleFocused = document.activeElement === catalogTitle;
              farmLink.focus();
              const farmFocused = document.activeElement === farmLink;
              menuTrigger.focus();
              const menuFocused = document.activeElement === menuTrigger;
              mark.focus();
              const markFocused = document.activeElement === mark;
              const nested = document.querySelectorAll('a a, a button, button a, button button, a summary').length;
              return {
                catalogStable: stable('#catalog'),
                mineStable: stable('#mine'),
                noteStable: stable('#note'),
                nested,
                titleFocused,
                farmFocused,
                menuFocused,
                markFocused,
                unread: document.querySelector('#note').classList.contains('user-notifications__item--unread'),
                overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
                afterPosition: getComputedStyle(catalogTitle, '::after').position,
              };
            })()`,
          );
          expect(layout.catalogStable).toBe(true);
          expect(layout.mineStable).toBe(true);
          expect(layout.noteStable).toBe(true);
          expect(layout.nested).toBe(0);
          expect(layout.titleFocused).toBe(true);
          expect(layout.farmFocused).toBe(true);
          expect(layout.menuFocused).toBe(true);
          expect(layout.markFocused).toBe(true);
          expect(layout.unread).toBe(true);
          expect(layout.overflow).toBeLessThanOrEqual(1);
          expect(layout.afterPosition).toBe('absolute');
        };

        await check(1280);
        await check(390);
      } finally {
        session.close();
        launched.cleanup();
        await server.close();
      }
    },
    30000,
  );
});

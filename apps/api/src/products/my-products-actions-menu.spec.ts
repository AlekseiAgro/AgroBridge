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

const PIXEL = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

function card(id: string) {
  return `
      <li id="${id}" class="product-list__item product-list__item--row product-list__item--mine entity-card">
        <div class="product-list__item-main">
          <a class="product-list__media-link" href="/products/${id}" aria-label="Preview">
            <img class="product-list__media product-list__media--sm" alt="" src="${PIXEL}" />
          </a>
          <div class="product-list__item-body">
            <div class="product-list__identity">
              <a class="product-list__title" href="/products/${id}">Honey</a>
              <p class="product-list__status">Published</p>
            </div>
          </div>
        </div>
        <div class="product-list__actions">
          <a class="button button--primary product-list__action--primary" href="/dashboard/products/${id}/edit#harvest-status">Update availability</a>
          <details class="mine-card-menu">
            <summary class="button button--ghost mine-card-menu__trigger" aria-label="More actions">⋯</summary>
            <div class="mine-card-menu__panel" role="menu">
              <a class="mine-card-menu__item" href="/dashboard/products/${id}/edit" role="menuitem">Edit</a>
              <button class="mine-card-menu__item" type="button" role="menuitem">Mark as out of stock</button>
              <button class="mine-card-menu__item mine-card-menu__item--danger" type="button" role="menuitem">Delete</button>
            </div>
          </details>
        </div>
      </li>`;
}

function fixture(css: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>
  <main class="cabinet-page">
    <ul class="product-list">${card('first')}${card('middle')}${card('last')}
    </ul>
  </main>
</body>
</html>`;
}

async function startStaticServer(
  html: string,
): Promise<{ url: string; close: () => Promise<void> }> {
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-card-menu-'));
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
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void }
  >();
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
  return { ready, send, close: () => ws.close() };
}

async function evaluate<T>(
  send: (method: string, params?: Record<string, unknown>) => Promise<unknown>,
  expression: string,
): Promise<T> {
  const result = (await send('Runtime.evaluate', {
    expression,
    returnByValue: true,
  })) as { result?: { value: T } };
  return result.result!.value;
}

type MenuCheck = {
  placement: 'below' | 'above' | 'overlapping';
  overlapsNeighbour: boolean;
  items: Array<{ text: string; topmost: boolean; hit: string }>;
};

describe('My Products card actions menu', () => {
  const css = source('app/globals.css');
  const actions = source('components/MyProductCardActions.tsx');

  it('lifts the card that owns the open menu above neighbouring cards', () => {
    expect(css).toMatch(/\.entity-card:has\(\.mine-card-menu\[open\]\)\s*\{[^}]*z-index:\s*2/);
    expect(css).toMatch(/\.mine-card-menu__panel\s*\{[^}]*z-index:\s*30/);
  });

  it('flips the panel above the trigger when the viewport has no room below', () => {
    expect(css).toMatch(
      /\.mine-card-menu\[data-placement='above'\] \.mine-card-menu__panel\s*\{[^}]*top:\s*auto;[^}]*bottom:\s*calc\(100% \+ 0\.3rem\)/,
    );
    expect(actions).toContain("import { chooseMenuPlacement } from '@/lib/menu-placement';");
    expect(actions).toContain('menu.dataset.placement = chooseMenuPlacement({');
    expect(actions).toContain('onClick={onTriggerClick}');
    expect(actions).toContain("window.addEventListener('scroll', onViewportChange");
    expect(actions).toContain("window.addEventListener('resize', onViewportChange)");
  });

  it('keeps the existing menu actions', () => {
    expect(actions).toContain('<details ref={menuRef} className="mine-card-menu">');
    expect(actions).toContain("{t('edit')}");
    expect(actions).toContain("t('markSoldOut')");
    expect(actions).toContain('<DeleteProductButton');
    expect(actions).toContain("{t('updateAvailability')}");
  });

  const chrome = findChrome();

  (chrome ? it : it.skip)(
    'keeps every open menu item above neighbouring cards at desktop and 375px',
    async () => {
      const launched = await launchChrome(chrome!);
      const server = await startStaticServer(fixture(readGlobalsCss()));
      const session = cdp(launched.wsUrl);
      try {
        await session.ready;
        await session.send('Runtime.enable');
        await session.send('Page.enable');

        const openMenu = (cardId: string, placement: 'below' | 'above') =>
          evaluate<MenuCheck>(
            session.send,
            `(() => {
              document.querySelectorAll('.mine-card-menu').forEach((menu) => {
                menu.removeAttribute('open');
                delete menu.dataset.placement;
              });
              const li = document.getElementById(${JSON.stringify(cardId)});
              const menu = li.querySelector('.mine-card-menu');
              if (${JSON.stringify(placement)} === 'above') menu.dataset.placement = 'above';
              menu.open = true;
              const panel = menu.querySelector('.mine-card-menu__panel');
              panel.scrollIntoView({ block: 'center' });
              const t = menu.getBoundingClientRect();
              const p = panel.getBoundingClientRect();
              const neighbour = ${JSON.stringify(placement)} === 'above'
                ? li.previousElementSibling
                : li.nextElementSibling;
              const n = neighbour.getBoundingClientRect();
              return {
                placement: p.top >= t.bottom - 1 ? 'below' : p.bottom <= t.top + 1 ? 'above' : 'overlapping',
                overlapsNeighbour: p.bottom > n.top && p.top < n.bottom,
                items: [...panel.querySelectorAll('.mine-card-menu__item')].map((item) => {
                  const r = item.getBoundingClientRect();
                  const points = [
                    [r.left + 4, r.top + 4],
                    [r.left + r.width / 2, r.top + r.height / 2],
                    [r.right - 4, r.bottom - 4],
                  ];
                  const misses = points
                    .map(([x, y]) => document.elementFromPoint(x, y))
                    .filter((hit) => !hit || !item.contains(hit));
                  return {
                    text: item.textContent.trim(),
                    topmost: misses.length === 0,
                    hit: misses.map((hit) => (hit ? String(hit.className || hit.tagName) : 'none')).join(','),
                  };
                }),
              };
            })()`,
          );

        for (const width of [1280, 768, 375]) {
          await session.send('Emulation.setDeviceMetricsOverride', {
            width,
            height: 900,
            deviceScaleFactor: 1,
            mobile: width <= 640,
          });
          await session.send('Page.navigate', { url: server.url });
          await new Promise((resolve) => setTimeout(resolve, 350));

          for (const [cardId, placement] of [
            ['first', 'below'],
            ['middle', 'below'],
            ['middle', 'above'],
            ['last', 'above'],
          ] as const) {
            const result = await openMenu(cardId, placement);
            expect({ width, cardId, placement: result.placement }).toEqual({
              width,
              cardId,
              placement,
            });
            expect(result.items.map((item) => item.text)).toEqual([
              'Edit',
              'Mark as out of stock',
              'Delete',
            ]);
            for (const item of result.items) {
              expect({ width, cardId, placement, ...item }).toEqual({
                width,
                cardId,
                placement,
                text: item.text,
                topmost: true,
                hit: '',
              });
            }
          }
        }
      } finally {
        session.close();
        launched.cleanup();
        await server.close();
      }
    },
    60000,
  );
});

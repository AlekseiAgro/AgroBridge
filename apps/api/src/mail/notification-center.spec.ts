import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { AddressInfo } from 'net';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web/src');
const MESSAGES_DIR = join(__dirname, '../../../web/messages');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    nav: { notifications: string; inbox: string; subscriptions: string };
    notifications: {
      title: string;
      subtitle: string;
      empty: string;
      emptyHint?: string;
      markAllRead: string;
      markRead: string;
    };
    rfq: { inboxTitle: string };
    subscriptions: { inboxTitle: string };
  };
}

function readGlobalsCss(): string {
  return readFileSync(join(WEB, 'app/globals.css'), 'utf8')
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

function notificationsFixture(css: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>
  <div class="cabinet">
    <aside class="cabinet__sidebar">
      <a class="cabinet__brand" href="/">AgroBridge</a>
      <nav class="cabinet__nav">
        <a href="/account">Account</a>
        <a href="/account/settings">Settings</a>
      </nav>
    </aside>
    <div class="cabinet__main">
      <div class="cabinet__content">
        <main class="cabinet-page">
          <div class="page__heading-row">
            <div>
              <h1>Уведомления</h1>
              <p class="page__subtitle">Здесь отображаются важные события, связанные с вашими запросами, предложениями и товарами.</p>
            </div>
          </div>
          <div class="user-notifications-wrap">
            <ul class="user-notifications">
              <li class="user-notifications__item user-notifications__item--unread">
                <div class="user-notifications__main">
                  <a class="product-list__title" href="#">Very long harvest availability title for overflow checks</a>
                  <p class="product-list__meta">Farm name · available</p>
                </div>
                <button type="button" class="button button--ghost">Прочитано</button>
              </li>
              <li class="user-notifications__item">
                <div class="user-notifications__main">
                  <a class="product-list__title" href="#">Read purchase quote event</a>
                  <p class="product-list__meta">Already read</p>
                </div>
              </li>
            </ul>
          </div>
        </main>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function notificationsEmptyFixture(css: string): string {
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${css}</style>
</head>
<body>
  <div class="cabinet">
    <aside class="cabinet__sidebar">
      <a class="cabinet__brand" href="/">AgroBridge</a>
      <nav class="cabinet__nav">
        <a href="/account">Account</a>
        <a href="/account/settings">Settings</a>
      </nav>
    </aside>
    <div class="cabinet__main">
      <div class="cabinet__content">
        <main class="cabinet-page">
          <div class="page__heading-row">
            <div>
              <h1>Уведомления</h1>
              <p class="page__subtitle">Здесь отображаются важные события, связанные с вашими запросами, предложениями и товарами.</p>
            </div>
          </div>
          <div class="empty-state">
            <p>Пока нет уведомлений</p>
          </div>
        </main>
      </div>
    </div>
  </div>
</body>
</html>`;
}

type OverflowMeasure = {
  diff: number;
  overflowers: Array<{ cls: string; extra: number }>;
  horizontalOverflow: boolean;
};

const MEASURE_JS = `(() => {
  const host = document.documentElement.getBoundingClientRect();
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
  return {
    diff: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    overflowers: overflowers.slice(0, 8),
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

async function launchChrome(
  chrome: string,
): Promise<{ wsUrl: string; process: ChildProcess; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-notify-chrome-'));
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
): Promise<OverflowMeasure> {
  const httpBase = browserWs.replace(/^ws/, 'http').replace(/\/devtools\/browser\/.*$/, '');
  const tab = JSON.parse(
    execFileSync(
      'curl',
      ['-sS', '-X', 'PUT', `${httpBase}/json/new?${encodeURIComponent('about:blank')}`],
      { encoding: 'utf8', timeout: 5000 },
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
  })) as { result: { value: OverflowMeasure } };
  ws.close();
  return result.result.value;
}

describe('dedicated Notification Center', () => {
  it('opens from the bell on /dashboard/notifications and not from RFQ or subscriptions', () => {
    const bell = readWeb('components/NotificationBell.tsx');
    const page = readWeb('app/[locale]/dashboard/notifications/page.tsx');
    const shell = readWeb('components/CabinetShell.tsx');

    expect(bell).toContain('href="/dashboard/notifications"');
    expect(bell).not.toContain('/dashboard/subscriptions');
    expect(bell).not.toContain('#inbox');
    expect(bell).not.toContain('/dashboard/inbox');
    expect(page).toContain("requireVerifiedUser(locale, '/dashboard/notifications')");
    expect(page).toContain("'/notifications?limit=30'");
    expect(shell).not.toContain('/dashboard/subscriptions');
    expect(shell).not.toContain("t('subscriptions')");
    expect(shell).not.toContain("href=\"/dashboard/notifications\">{t('notifications')}");
  });

  it('uses the existing UserNotification contract without RFQ or HarvestWatch creation', () => {
    const page = readWeb('app/[locale]/dashboard/notifications/page.tsx');
    const list = readWeb('components/UserNotificationsList.tsx');
    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    const watch = readWeb('components/HarvestWatchButton.tsx');
    const subscriptions = [
      readWeb('app/[locale]/dashboard/subscriptions/page.tsx'),
      readWeb('app/[locale]/dashboard/subscriptions/legacy-redirect.tsx'),
    ].join('\n');

    expect(page).toContain('UserNotificationsList');
    expect(page).toContain("copyNamespace=\"notifications\"");
    expect(page).toContain("{t('subtitle')}");
    expect(list).toContain("t('empty')");
    expect(list).not.toContain('emptyHint');
    expect(list).not.toContain('Здесь появятся важные события');
    expect(page).not.toContain('AlertSubscriptionForm');
    expect(page).not.toContain('HarvestWatchesList');
    expect(page).not.toContain('HarvestWatchButton');
    expect(page).not.toContain('/products/watches');
    expect(page).not.toContain('/products/');
    expect(page).not.toContain('/subscriptions/alerts');
    expect(page).not.toContain('rfqs/inbox');
    expect(page).not.toContain('/api/rfqs/inbox/unread-count');
    expect(page).not.toContain('InboxNavLink');
    expect(page).not.toContain('MarkSectionNotificationsRead');

    expect(list).toContain("fetch(`/api/notifications/${id}/read`");
    expect(list).toContain("fetch('/api/notifications/read-all'");
    expect(list).not.toContain('/api/rfqs/inbox/unread-count');
    expect(list).not.toContain('/api/products/');

    expect(product).toContain('HarvestWatchButton');
    expect(watch).toContain("fetch(`/api/products/${productId}/watch`");
    expect(subscriptions).toContain('/account/settings#notifications');
    expect(subscriptions).not.toContain('AlertSubscriptionForm');
    expect(subscriptions).not.toContain('HarvestWatchesList');
    expect(subscriptions).not.toContain('id="inbox"');
    expect(subscriptions).not.toContain('UserNotificationsList');
  });

  it('localizes the Notification Center without Inbox/RFQ collisions', () => {
    const expectedTitle: Record<(typeof LOCALES)[number], string> = {
      en: 'Notifications',
      ru: 'Уведомления',
      ka: 'შეტყობინებები',
      de: 'Benachrichtigungen',
      fr: 'Notifications',
      it: 'Notifiche',
      es: 'Avisos',
    };

    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      expect(messages.notifications.title).toBe(expectedTitle[locale]);
      expect(messages.notifications.subtitle.trim().length).toBeGreaterThan(0);
      expect(messages.notifications.empty.trim().length).toBeGreaterThan(0);
      expect(messages.notifications.emptyHint).toBeUndefined();
      expect(JSON.stringify(messages.notifications)).not.toContain('emptyHint');
      expect(messages.notifications.markAllRead.trim().length).toBeGreaterThan(0);
      expect(messages.notifications.markRead.trim().length).toBeGreaterThan(0);
      expect(messages.notifications.title).not.toBe(messages.nav.inbox);
      expect(messages.notifications.title).not.toBe(messages.rfq.inboxTitle);
      expect(messages.notifications.title.toLowerCase()).not.toContain('inbox');
      expect(messages.notifications.empty.toLowerCase()).not.toContain('inbox');
    }

    const ru = loadMessages('ru');
    expect(ru.notifications.empty).toBe('Пока нет уведомлений');
    expect(ru.notifications.subtitle).toBe(
      'Здесь отображаются важные события, связанные с вашими запросами, предложениями и товарами.',
    );
    expect(ru.notifications.subtitle).not.toBe(
      'Здесь появятся важные события, связанные с вашими запросами, предложениями и товарами.',
    );
    expect(ru.notifications.markAllRead).toBe('Прочитать все');
    expect(ru.notifications.markRead).toBe('Прочитано');
    const en = loadMessages('en');
    expect(en.notifications.empty).toBe('No notifications yet');
    expect(en.notifications.subtitle).toBe(
      'Important events about your purchase requests, quotes, and products appear here.',
    );
    expect(en.notifications.markAllRead).toBe('Mark all as read');
    expect(en.notifications.markRead).toBe('Read');
  });

  const chrome = findChrome();
  const viewports = [
    { width: 320, height: 720 },
    { width: 375, height: 812 },
    { width: 768, height: 1024 },
    { width: 1024, height: 768 },
    { width: 1280, height: 900 },
  ];

  (chrome ? it : it.skip)(
    'keeps the Notification Center free of horizontal overflow from 320px through 1280px',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const css = readGlobalsCss();
      const server = await startStaticServer({
        'notifications.html': notificationsFixture(css),
        'notifications-empty.html': notificationsEmptyFixture(css),
      });
      try {
        for (const page of ['notifications.html', 'notifications-empty.html'] as const) {
          for (const viewport of viewports) {
            const result = await cdpEvaluate(
              launched.wsUrl,
              `${server.url}/${page}`,
              viewport,
            );
            expect({
              page,
              viewport: viewport.width,
              diff: result.diff,
              overflowers: result.overflowers,
              horizontalOverflow: result.horizontalOverflow,
            }).toEqual({
              page,
              viewport: viewport.width,
              diff: expect.any(Number),
              overflowers: [],
              horizontalOverflow: false,
            });
            expect(result.diff).toBeLessThanOrEqual(1);
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

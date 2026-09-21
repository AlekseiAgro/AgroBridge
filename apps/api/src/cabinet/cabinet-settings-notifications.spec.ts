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
    cabinet: {
      notificationsSettingsTitle: string;
      notificationsSettingsSubtitle: string;
      emailNotificationsTitle: string;
      harvestNotificationsTitle: string;
      harvestNotificationsHint: string;
      harvestNotificationsEmpty: string;
      harvestNotificationsBrowse: string;
      settingsSubtitle: string;
    };
    harvest: { watch: string; unwatch: string; alertsTitle: string };
    notifications: { title: string };
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

function settingsNotificationsFixture(css: string, emptyWatches: boolean): string {
  const harvest = emptyWatches
    ? `<div class="empty-state">
            <p>Пока нет уведомлений об урожае.</p>
            <a class="button button--ghost" href="/catalog">Открыть каталог</a>
          </div>`
    : `<div class="harvest-watches">
            <ul class="harvest-watches__list">
              <li class="harvest-watches__item product-list__item--with-media">
                <div class="product-list__media"></div>
                <div class="harvest-watches__body">
                  <a class="product-list__title" href="#">Very long harvest product title for overflow checks mandarin orchard</a>
                  <p class="product-list__meta">Farm with a long regional name · Kakheti</p>
                  <p>Вы подписаны на уведомления об этом товаре.</p>
                  <div class="harvest-watches__actions">
                    <button type="button" class="button button--ghost">Отключить уведомления</button>
                  </div>
                </div>
              </li>
            </ul>
          </div>`;

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
        <main class="cabinet-page cabinet-page--settings">
          <section class="cabinet-profile">
            <div class="settings-section-head">
              <span class="settings-section-head__icon" aria-hidden></span>
              <div class="settings-section-head__copy">
                <h2 class="section-title">Профиль</h2>
                <p class="settings-section-head__desc">Измените имя, фото профиля и адрес электронной почты.</p>
              </div>
            </div>
          </section>
          <section class="cabinet-security">
            <div class="settings-section-head">
              <span class="settings-section-head__icon" aria-hidden></span>
              <div class="settings-section-head__copy">
                <h2 class="section-title">Безопасность</h2>
                <p class="settings-section-head__desc">Защита вашего аккаунта и доступ к нему.</p>
              </div>
            </div>
          </section>
          <section class="cabinet-notifications">
            <div class="settings-section-head">
              <span class="settings-section-head__icon" aria-hidden></span>
              <div class="settings-section-head__copy">
                <h2 class="section-title">Уведомления</h2>
                <p class="settings-section-head__desc">Выберите, какие письма получать, и управляйте уже созданными подписками на урожай.</p>
              </div>
            </div>
            <div class="settings-list">
              <div class="settings-row">
                <p class="settings-row__label">Email-уведомления</p>
                <div class="settings-row__body">
                  <p class="settings-row__value">Новые товары в каталоге · Новые запросы на покупку в выбранных категориях</p>
                  <button type="button" class="settings-row__action">Изменить</button>
                </div>
              </div>
              <div class="settings-row settings-row--stack">
                <p class="settings-row__label">Уведомления об урожае</p>
                <p class="settings-row__value">Здесь только товары, на которые вы уже подписаны. Новую подписку можно включить на странице товара.</p>
                ${harvest}
              </div>
            </div>
          </section>
          <section class="cabinet-legal">
            <div class="settings-section-head">
              <span class="settings-section-head__icon" aria-hidden></span>
              <div class="settings-section-head__copy">
                <h2 class="section-title">Юридическая информация</h2>
                <p class="settings-section-head__desc">Текущие опубликованные документы и принятие Условий использования.</p>
              </div>
            </div>
          </section>
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
): Promise<{ wsUrl: string; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-settings-notify-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child: ChildProcess = spawn(
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

describe('Settings → Notifications', () => {
  it('renders a Settings Notifications section over existing alert and watch contracts', () => {
    const settings = readWeb('app/[locale]/account/settings/page.tsx');
    const email = readWeb('components/SettingsEmailAlertsControl.tsx');
    const form = readWeb('components/AlertSubscriptionForm.tsx');
    const list = readWeb('components/HarvestWatchesList.tsx');
    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    const watch = readWeb('components/HarvestWatchButton.tsx');
    const center = readWeb('app/[locale]/dashboard/notifications/page.tsx');
    const subscriptions = [
      readWeb('app/[locale]/dashboard/subscriptions/page.tsx'),
      readWeb('app/[locale]/dashboard/subscriptions/legacy-redirect.tsx'),
    ].join('\n');

    expect(settings).toContain('cabinet-notifications');
    expect(settings).toContain('SettingsSectionHead');
    expect(settings).toContain('notificationsSettingsTitle');
    expect(settings).toContain('notificationsSettingsSubtitle');
    expect(settings).toContain('SettingsEmailAlertsControl');
    expect(settings).toContain("'/subscriptions/alerts'");
    expect(settings).toContain("'/products/watches'");
    expect(settings).toContain('HarvestWatchesList');
    expect(settings).toContain('harvestNotificationsEmpty');
    expect(settings).toContain('href="/catalog"');
    expect(settings).not.toContain('HarvestWatchButton');
    expect(settings).not.toContain("method: 'POST'");
    expect(settings).not.toContain('UserNotificationsList');
    expect(settings).not.toContain('/notifications?limit=');
    expect(settings).not.toContain('rfqs/inbox');
    expect(settings).toContain('cabinet-profile');
    expect(settings).toContain('cabinet-security');
    expect(settings).toContain('cabinet-legal');
    expect(settings).toContain('DeleteAccountButton');

    expect(email).toContain('const [open, setOpen] = useState(false)');
    expect(email).toContain('AlertSubscriptionForm');
    expect(email).toContain('settingsEdit');
    expect(form).toContain("fetch('/api/subscriptions/alerts'");
    expect(form).toContain("method: 'PUT'");
    expect(list).toContain("fetch(`/api/products/${productId}/watch`");
    expect(list).toContain("method: 'DELETE'");
    expect(list).not.toContain("method: 'POST'");

    expect(product).toContain('HarvestWatchButton');
    expect(watch).toContain("fetch(`/api/products/${productId}/watch`");
    expect(watch).toContain("'POST'");
    expect(watch).toContain("'DELETE'");

    expect(center).not.toContain('AlertSubscriptionForm');
    expect(center).not.toContain('HarvestWatchesList');
    expect(center).not.toContain('SettingsEmailAlertsControl');
    expect(center).toContain("copyNamespace=\"notifications\"");

    expect(settings).toContain('id="notifications"');
    expect(subscriptions).toContain('/account/settings#notifications');
    expect(subscriptions).not.toContain('AlertSubscriptionForm');
    expect(subscriptions).not.toContain('HarvestWatchesList');
    expect(subscriptions).not.toContain('id="inbox"');
  });

  it('localizes Settings Notifications without colliding with Notification Center', () => {
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
      expect(messages.cabinet.notificationsSettingsTitle).toBe(expectedTitle[locale]);
      expect(messages.cabinet.notificationsSettingsSubtitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.emailNotificationsTitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.harvestNotificationsTitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.harvestNotificationsHint.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.harvestNotificationsEmpty.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.harvestNotificationsBrowse.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.notificationsSettingsTitle).toBe(messages.notifications.title);
      expect(messages.cabinet.harvestNotificationsEmpty.toLowerCase()).not.toContain('inbox');
      expect(messages.cabinet.harvestNotificationsBrowse.toLowerCase()).not.toContain('notify me');
    }

    const ru = loadMessages('ru');
    expect(ru.cabinet.settingsSubtitle).toBe(
      'Профиль, пароль, безопасность аккаунта и юридические документы.',
    );
    expect(ru.cabinet.harvestNotificationsTitle).toBe('Уведомления об урожае');
    expect(ru.harvest.alertsTitle).toBe('Уведомления об урожае');
    expect(ru.harvest.watch).toBe('Уведомить меня');
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
    'keeps Settings Notifications free of horizontal overflow from 320px through 1280px',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const css = readGlobalsCss();
      const server = await startStaticServer({
        'settings-watches.html': settingsNotificationsFixture(css, false),
        'settings-empty.html': settingsNotificationsFixture(css, true),
      });
      try {
        for (const page of ['settings-watches.html', 'settings-empty.html'] as const) {
          for (const viewport of viewports) {
            const result = await cdpEvaluate(launched.wsUrl, `${server.url}/${page}`, viewport);
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

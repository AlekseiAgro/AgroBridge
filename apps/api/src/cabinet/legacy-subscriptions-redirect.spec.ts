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
    nav: Record<string, string>;
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

function cabinetNavFixture(css: string): string {
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
        <a href="/account">Аккаунт</a>
        <a href="/account/settings">Настройки</a>
      </nav>
    </aside>
    <div class="cabinet__main">
      <div class="cabinet__content">
        <main class="cabinet-page cabinet-page--settings">
          <section id="notifications" class="cabinet-notifications">
            <div class="settings-section-head">
              <span class="settings-section-head__icon" aria-hidden></span>
              <div class="settings-section-head__copy">
                <h2 class="section-title">Уведомления</h2>
                <p class="settings-section-head__desc">Выберите, какие письма получать, и управляйте уже созданными подписками на урожай.</p>
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

async function launchChrome(chrome: string): Promise<{ wsUrl: string; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-legacy-sub-'));
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

describe('legacy subscriptions cleanup', () => {
  it('redirects /dashboard/subscriptions to Settings Notifications and keeps locale-aware routing', () => {
    const page = readWeb('app/[locale]/dashboard/subscriptions/page.tsx');
    const redirector = readWeb('app/[locale]/dashboard/subscriptions/legacy-redirect.tsx');
    const settings = readWeb('app/[locale]/account/settings/page.tsx');

    expect(page).toContain("requireVerifiedUser(locale, '/account/settings')");
    expect(page).toContain('LegacySubscriptionsRedirect');
    expect(page).not.toContain('AlertSubscriptionForm');
    expect(page).not.toContain('HarvestWatchesList');
    expect(page).not.toContain('UserNotificationsList');
    expect(page).not.toContain('id="inbox"');

    expect(redirector).toContain("'/account/settings#notifications'");
    expect(redirector).toContain('router.replace');
    expect(redirector).toContain('href={SETTINGS_NOTIFICATIONS_HREF}');
    expect(redirector).not.toContain('#inbox');
    expect(settings).toContain('id="notifications"');
  });

  it('removes the subscriptions sidebar item without adding a Notification Center nav item', () => {
    const shell = readWeb('components/CabinetShell.tsx');
    const bell = readWeb('components/NotificationBell.tsx');
    const product = readWeb('app/[locale]/products/[id]/page.tsx');
    const watch = readWeb('components/HarvestWatchButton.tsx');
    const mail = readFileSync(join(__dirname, '../mail/notifications.service.ts'), 'utf8');

    expect(shell).not.toContain('/dashboard/subscriptions');
    expect(shell).not.toContain("t('subscriptions')");
    expect(shell).not.toContain("href=\"/dashboard/notifications\">{t('notifications')}");
    expect(shell).toContain("href=\"/account/settings\">{t('settings')}");
    expect(shell).toContain('NotificationBell');
    expect(bell).toContain('href="/dashboard/notifications"');
    expect(bell).not.toContain('/dashboard/subscriptions');
    expect(bell).not.toContain('#inbox');

    expect(product).toContain('HarvestWatchButton');
    expect(watch).toContain("'POST'");
    expect(watch).toContain("'DELETE'");

    expect(mail).toContain("'/account/settings#notifications'");
    expect(mail).not.toContain("'/dashboard/subscriptions'");
    expect(mail).not.toContain('#inbox');
  });

  it('does not leave unused nav.subscriptions keys after removing the sidebar label', () => {
    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      expect(messages.nav.subscriptions).toBeUndefined();
      expect(messages.nav.settings.trim().length).toBeGreaterThan(0);
    }
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
    'keeps cabinet navigation without subscriptions free of horizontal overflow',
    async () => {
      if (!chrome) return;
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({
        'cabinet.html': cabinetNavFixture(readGlobalsCss()),
      });
      try {
        for (const viewport of viewports) {
          const result = await cdpEvaluate(
            launched.wsUrl,
            `${server.url}/cabinet.html`,
            viewport,
          );
          expect({
            viewport: viewport.width,
            diff: result.diff,
            overflowers: result.overflowers,
            horizontalOverflow: result.horizontalOverflow,
          }).toEqual({
            viewport: viewport.width,
            diff: expect.any(Number),
            overflowers: [],
            horizontalOverflow: false,
          });
          expect(result.diff).toBeLessThanOrEqual(1);
        }
      } finally {
        launched.cleanup();
        await server.close();
      }
    },
    120000,
  );
});

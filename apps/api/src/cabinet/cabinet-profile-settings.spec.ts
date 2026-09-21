import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { createServer } from 'http';
import { tmpdir } from 'os';
import { AddressInfo } from 'net';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web/src');
const MESSAGES_DIR = join(__dirname, '../../../web/messages');
const API = join(__dirname, '..');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function readApi(path: string) {
  return readFileSync(join(API, path), 'utf8');
}

function loadMessages(locale: string) {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as {
    nav: { subscriptions: string; settings: string };
    cabinet: {
      profileSettingsTitle: string;
      profileSettingsHint: string;
      settingsTitle: string;
      settingsSubtitle: string;
      securityTitle: string;
      legalTitle: string;
    };
  };
}

function readGlobalsCss(): string {
  return readFileSync(join(WEB, 'app/globals.css'), 'utf8')
    .replace(/@import\s+['"]tailwindcss['"]\s*;/, '')
    .replace(/@theme\s+inline\s*\{[\s\S]*?\n\}/, '');
}

type OverflowMeasure = {
  client: number;
  scroll: number;
  diff: number;
  overflowers: Array<{ cls: string; extra: number }>;
  horizontalOverflow: boolean;
};

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

function cabinetFixture(css: string, page: 'account' | 'settings'): string {
  const accountMain = `
    <main class="cabinet-page">
      <div class="page__heading-row"><div><h1>Account</h1><p class="page__subtitle">Overview</p></div></div>
      <section class="user-card">
        <div class="user-card__identity">
          <div class="user-card__avatar" aria-hidden>A</div>
          <div>
            <h2 class="user-card__name">Very Long Display Name For Overflow Checks</h2>
            <p class="user-card__meta">very.long.email.address.for.overflow@example.com</p>
            <p class="user-card__meta">Farmer · Private farmer · Individual</p>
            <p class="user-card__meta">Member since September 2026</p>
            <p class="user-card__meta"><a class="profile-link" href="#">Public profile</a></p>
          </div>
        </div>
        <div class="user-card__rating">
          <p class="user-card__rating-label">Rating</p>
          <p class="user-card__rating-hint">Based on completed deals</p>
        </div>
      </section>
      <section class="activity-summary">
        <h2 class="section-title">Activity</h2>
        <ul class="activity-summary__grid">
          <li><a class="activity-summary__link" href="#"><span class="activity-summary__value"><strong>2</strong></span><span>Completed deals</span></a></li>
          <li><a class="activity-summary__link" href="#"><span class="activity-summary__value"><strong>1</strong></span><span>Open purchase requests</span></a></li>
          <li><a class="activity-summary__link" href="#"><span class="activity-summary__value"><strong>0</strong></span><span>Pending quotes</span></a></li>
        </ul>
      </section>
    </main>`;

  const settingsMain = `
    <main class="cabinet-page">
      <div class="page__heading-row"><div><h1>Settings</h1><p class="page__subtitle">Profile, password, account security, and legal documents.</p></div></div>
      <section class="cabinet-profile">
        <h2 class="section-title">Profile settings</h2>
        <p class="cabinet-profile__hint">Change your display name, profile photo, and email address.</p>
        <div class="cabinet-profile__identity">
          <div class="user-avatar-editor">
            <button type="button" class="user-card__avatar user-card__avatar--editable">A</button>
            <div class="user-avatar-editor__actions">
              <button type="button" class="button button--ghost user-avatar-editor__button">Upload photo</button>
            </div>
          </div>
          <div class="edit-profile">
            <div class="edit-profile__name-row">
              <h3 class="user-card__name">Very Long Display Name For Overflow Checks</h3>
            </div>
            <div class="edit-profile__panel">
              <form class="profile-edit-form">
                <label class="field"><span>Display name</span><input type="text" value="Very Long Display Name For Overflow Checks" /></label>
                <div class="how-it-works__actions">
                  <button class="button button--primary" type="submit">Save name</button>
                </div>
              </form>
              <div class="edit-profile__email">
                <p class="user-card__meta">very.long.email.address.for.overflow@example.com</p>
                <button type="button" class="button button--ghost profile-edit-row__button">Change email</button>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section class="cabinet-security">
        <h2 class="section-title">Security</h2>
        <p class="cabinet-security__hint">Use a strong password.</p>
        <form class="auth-form">
          <label class="field"><span>Current password</span><input type="password" value="password1" /></label>
          <label class="field"><span>New password</span><input type="password" /></label>
        </form>
      </section>
      <section class="cabinet-legal">
        <h2 class="section-title">Legal</h2>
        <p class="cabinet-legal__hint">Current published documents and your Terms of Use acceptance.</p>
      </section>
    </main>`;

  return `<!doctype html>
<html lang="en">
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
        <a href="/dashboard/subscriptions">Subscriptions</a>
        <a href="/account/settings">Settings</a>
      </nav>
    </aside>
    <div class="cabinet__main">
      <div class="cabinet__content">
        ${page === 'account' ? accountMain : settingsMain}
      </div>
    </div>
  </div>
</body>
</html>`;
}

const MEASURE_JS = `(() => {
  const client = document.documentElement.clientWidth;
  const scroll = document.documentElement.scrollWidth;
  const overflowers = [];
  for (const el of document.querySelectorAll('body *')) {
    const extra = Math.round(el.scrollWidth - el.clientWidth);
    if (extra > 1 && el.clientWidth > 0) {
      overflowers.push({ cls: el.className?.toString?.().slice(0, 80) || el.tagName, extra });
    }
  }
  return {
    client,
    scroll,
    diff: scroll - client,
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
  const dir = mkdtempSync(join(tmpdir(), 'ab-account-chrome-'));
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

describe('read-only account overview and settings profile editing', () => {
  it('keeps /account as a read-only identity and activity overview', () => {
    const overview = readWeb('app/[locale]/account/page.tsx');

    expect(overview).not.toContain('EditProfileControl');
    expect(overview).not.toContain('UserAvatarEditor');
    expect(overview).not.toContain('edit-profile__pencil');
    expect(overview).not.toContain('ChangePasswordForm');
    expect(overview).not.toContain('DeleteAccountButton');

    expect(overview).toContain('user-card__avatar');
    expect(overview).toContain('user.displayName');
    expect(overview).toContain('user.email');
    expect(overview).toContain('user.sellerType');
    expect(overview).toContain('user.buyerType');
    expect(overview).toContain('memberSince');
    expect(overview).toContain('RatingStars');
    expect(overview).toContain('viewPublicProfile');
    expect(overview).toContain('activity-summary');
    expect(overview).toContain("href: '/dashboard/deals'");
    expect(overview).toContain("href: '/dashboard/purchase-requests'");
    expect(overview).toContain("href: '/dashboard/quotes'");
  });

  it('moves profile, avatar, and email editing onto Account Settings without duplicating flows', () => {
    const settings = readWeb('app/[locale]/account/settings/page.tsx');
    const editor = readWeb('components/EditProfileControl.tsx');
    const avatar = readWeb('components/UserAvatarEditor.tsx');
    const password = readWeb('components/ChangePasswordForm.tsx');

    expect(settings).toContain('cabinet-profile');
    expect(settings).toContain('profileSettingsTitle');
    expect(settings).toContain('UserAvatarEditor');
    expect(settings).toContain('EditProfileControl');
    expect(settings).toContain('alwaysOpen');
    expect(settings).toContain('ChangePasswordForm');
    expect(settings).toContain('DeleteAccountButton');
    expect(settings).toContain('cabinet-legal');
    expect(settings).toContain('/legal/me');

    expect(editor).toContain("fetch('/api/cabinet/me/profile'");
    expect(editor).toContain("'/api/cabinet/me/email/request'");
    expect(editor).toContain("'/api/cabinet/me/email/confirm'");
    expect(editor).toContain("router.replace('/verify-email')");
    expect(avatar).toContain("fetch('/api/cabinet/me/avatar'");
    expect(avatar).toContain("method: 'POST'");
    expect(avatar).toContain("method: 'DELETE'");
    expect(password).toContain("fetch('/api/auth/change-password'");
  });

  it('does not change cabinet API contracts or sidebar destinations', () => {
    const controller = readApi('cabinet/cabinet.controller.ts');
    const shell = readWeb('components/CabinetShell.tsx');
    const bell = readWeb('components/NotificationBell.tsx');

    expect(controller).toContain("@Patch('me/profile')");
    expect(controller).toContain("@Post('me/email/request')");
    expect(controller).toContain("@Post('me/email/confirm')");
    expect(controller).toContain("@Post('me/avatar')");
    expect(controller).toContain("@Delete('me/avatar')");

    expect(shell).toContain("href=\"/dashboard/subscriptions\">{t('subscriptions')}");
    expect(shell).toContain("href=\"/account/settings\">{t('settings')}");
    expect(shell).toContain('NotificationBell');
    expect(bell).toContain('/dashboard/subscriptions');
  });

  it('localizes the Settings profile section in every locale', () => {
    const expectedSubtitle: Record<(typeof LOCALES)[number], string> = {
      en: 'Profile, password, account security, and legal documents.',
      ru: 'Профиль, пароль, безопасность аккаунта и юридические документы.',
      ka: 'პროფილი, პაროლი, ანგარიშის უსაფრთხოება და სამართლებრივი დოკუმენტები.',
      de: 'Profil, Passwort, Kontosicherheit und Rechtsdokumente.',
      fr: 'Profil, mot de passe, sécurité du compte et documents juridiques.',
      it: 'Profilo, password, sicurezza dell\'account e documenti legali.',
      es: 'Perfil, contraseña, seguridad de la cuenta y documentos legales.',
    };

    for (const locale of LOCALES) {
      const messages = loadMessages(locale);
      expect(messages.cabinet.profileSettingsTitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.profileSettingsHint.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.settingsTitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.settingsSubtitle).toBe(expectedSubtitle[locale]);
      expect(messages.cabinet.securityTitle.trim().length).toBeGreaterThan(0);
      expect(messages.cabinet.legalTitle.trim().length).toBeGreaterThan(0);
      expect(messages.nav.settings.trim().length).toBeGreaterThan(0);
      expect(messages.nav.subscriptions.trim().length).toBeGreaterThan(0);
    }

    const ru = loadMessages('ru');
    expect(ru.nav.settings).toBe('Настройки');
    expect(ru.nav.subscriptions).toBe('Подписки');
    expect(ru.cabinet.profileSettingsTitle).toBe('Настройки профиля');
  });

  it('keeps the Profile section visually aligned with Security and Legal', () => {
    const css = readWeb('app/globals.css');
    expect(css).toMatch(/\.cabinet-profile\s*\{[\s\S]*?margin-top:\s*3\.5rem/);
    expect(css).toMatch(/\.cabinet-profile\s*\{[\s\S]*?border-top:\s*1px solid var\(--line\)/);
    expect(css).toMatch(/\.cabinet-security\s*\{[\s\S]*?margin-top:\s*3\.5rem/);
    expect(css).toMatch(/\.cabinet-legal\s*\{[\s\S]*?margin-top:\s*3\.5rem/);
    expect(css).toContain('.cabinet-profile__hint');
    expect(css).toContain('.cabinet-profile__identity');
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
    'keeps /account and /account/settings free of horizontal overflow from 320px through 1280px',
    async () => {
      if (!chrome) return;
      const css = readGlobalsCss();
      const launched = await launchChrome(chrome);
      const server = await startStaticServer({
        'account.html': cabinetFixture(css, 'account'),
        'settings.html': cabinetFixture(css, 'settings'),
      });

      try {
        for (const page of ['account.html', 'settings.html'] as const) {
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

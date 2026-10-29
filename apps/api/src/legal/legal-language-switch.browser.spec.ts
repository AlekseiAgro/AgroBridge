import { ChildProcess, execFileSync, spawn } from 'child_process';
import { existsSync, mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Real-browser check of the public legal pages. It needs a running web server
 * (local production build or production) and is skipped without one:
 *
 *   LEGAL_E2E_BASE_URL=http://127.0.0.1:3000 npx jest src/legal/legal-language-switch.browser.spec.ts
 */
const BASE_URL = process.env.LEGAL_E2E_BASE_URL?.replace(/\/+$/, '') ?? '';
const ORIGIN = 'https://agrobridge.ge';

type LegalState = {
  path: string;
  canonical: string | null;
  alternates: string[];
  htmlLang: string;
  articleLang: string | null;
  pressed: string | null;
  label: string | null;
  title: string;
  ogUrl: string | null;
};

const STATE_JS = `(() => ({
  path: location.pathname,
  canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null,
  alternates: [...document.querySelectorAll('link[rel="alternate"][hreflang]')]
    .map((link) => link.getAttribute('hreflang') + '=' + link.getAttribute('href'))
    .sort(),
  htmlLang: document.documentElement.lang,
  articleLang: document.querySelector('.legal-page article.legal-document')?.getAttribute('lang') ?? null,
  pressed: document.querySelector('.legal-page .legal-lang-switch button[aria-pressed="true"]')?.getAttribute('lang') ?? null,
  label: document.querySelector('.legal-page .legal-lang-field__label')?.textContent ?? null,
  title: document.title,
  ogUrl: document.querySelector('meta[property="og:url"]')?.getAttribute('content') ?? null,
}))()`;

function findChrome(): string | null {
  const candidates = [
    process.env.CHROME_PATH,
    '/usr/local/bin/google-chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter((value): value is string => Boolean(value));
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

async function launchChrome(
  chrome: string,
): Promise<{ wsUrl: string; process: ChildProcess; cleanup: () => void }> {
  const dir = mkdtempSync(join(tmpdir(), 'ab-legal-switch-'));
  const port = 20000 + Math.floor(Math.random() * 20000);
  const child = spawn(
    chrome,
    [
      '--headless=new',
      '--disable-gpu',
      '--no-sandbox',
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

async function openTab(browserWs: string) {
  const httpBase = browserWs.replace(/^ws/, 'http').replace(/\/devtools\/browser\/.*$/, '');
  const tab = JSON.parse(
    execFileSync('curl', ['-sS', '-X', 'PUT', `${httpBase}/json/new?about:blank`], {
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
    width: 1280,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  const evaluate = async <T>(expression: string): Promise<T> => {
    const result = (await send('Runtime.evaluate', { expression, returnByValue: true })) as {
      result: { value: T };
    };
    return result.result.value;
  };
  const state = () => evaluate<LegalState>(STATE_JS);

  /** Polls until `done` holds, re-running `action` because hydration may lag the first paint. */
  const until = async (done: (s: LegalState) => boolean, action?: string): Promise<LegalState> => {
    const deadline = Date.now() + 20000;
    let last: LegalState | null = null;
    while (Date.now() < deadline) {
      if (action) await evaluate(action);
      await new Promise((resolve) => setTimeout(resolve, 400));
      last = await state().catch(() => null);
      if (last && done(last)) return last;
    }
    throw new Error(`Timed out waiting for legal page state: ${JSON.stringify(last)}`);
  };

  const navigate = async (path: string, legal = true) => {
    await send('Page.navigate', { url: `${BASE_URL}${path}` });
    return until((s) => s.path === path && (!legal || s.articleLang !== null));
  };

  const clickDocument = (lang: 'ka' | 'en') =>
    until(
      (s) => s.pressed === lang && s.articleLang === lang,
      `document.querySelector('.legal-page .legal-lang-switch button[lang="${lang}"]')?.click()`,
    );

  const clickLink = (selector: string, path: string) =>
    until(
      (s) => s.path === path && s.articleLang !== null,
      `(() => { if (location.pathname !== ${JSON.stringify(path)}) document.querySelector(${JSON.stringify(selector)})?.click(); })()`,
    );

  return { navigate, clickDocument, clickLink, state, close: () => ws.close() };
}

function realAlternates(path: string): string[] {
  return [`en=${ORIGIN}/en${path}`, `ka=${ORIGIN}/ka${path}`, `x-default=${ORIGIN}/en${path}`].sort();
}

describe('legal page language switching in a real browser', () => {
  const chrome = findChrome();
  const enabled = Boolean(BASE_URL && chrome);

  (enabled ? it : it.skip)(
    'switches the document language in place and keeps the canonical of the URL',
    async () => {
      const launched = await launchChrome(chrome!);
      const tab = await openTab(launched.wsUrl);
      try {
        let s = await tab.navigate('/es/terms');
        expect(s).toMatchObject({
          path: '/es/terms',
          canonical: `${ORIGIN}/en/terms`,
          htmlLang: 'es',
          articleLang: 'en',
          pressed: 'en',
          label: 'Idioma del documento',
          ogUrl: `${ORIGIN}/en/terms`,
        });
        expect(s.alternates).toEqual([]);
        expect(s.title).toContain('(en inglés)');

        s = await tab.clickDocument('ka');
        expect(s).toMatchObject({
          path: '/es/terms',
          canonical: `${ORIGIN}/en/terms`,
          htmlLang: 'es',
          articleLang: 'ka',
          pressed: 'ka',
        });
        expect(s.alternates).toEqual([]);

        s = await tab.clickDocument('en');
        expect(s).toMatchObject({
          path: '/es/terms',
          canonical: `${ORIGIN}/en/terms`,
          htmlLang: 'es',
          articleLang: 'en',
          pressed: 'en',
        });

        s = await tab.clickLink('.site-header a.language-switcher__option[href="/ka/terms"]', '/ka/terms');
        expect(s).toMatchObject({
          path: '/ka/terms',
          canonical: `${ORIGIN}/ka/terms`,
          htmlLang: 'ka',
          articleLang: 'ka',
          pressed: 'ka',
          label: 'დოკუმენტის ენა',
        });
        expect(s.alternates).toEqual(realAlternates('/terms'));

        s = await tab.clickDocument('en');
        expect(s).toMatchObject({
          path: '/ka/terms',
          canonical: `${ORIGIN}/ka/terms`,
          htmlLang: 'ka',
          articleLang: 'en',
          pressed: 'en',
        });
        expect(s.alternates).toEqual(realAlternates('/terms'));

        s = await tab.clickLink('.site-header a.language-switcher__option[href="/en/terms"]', '/en/terms');
        expect(s).toMatchObject({
          path: '/en/terms',
          canonical: `${ORIGIN}/en/terms`,
          htmlLang: 'en',
          articleLang: 'en',
          pressed: 'en',
          label: 'Document language',
        });
        expect(s.alternates).toEqual(realAlternates('/terms'));
      } finally {
        tab.close();
        launched.cleanup();
      }
    },
    180000,
  );

  (enabled ? it : it.skip)(
    'keeps footer navigation and the English fallback for every legal page',
    async () => {
      const launched = await launchChrome(chrome!);
      const tab = await openTab(launched.wsUrl);
      try {
        await tab.navigate('/ru/catalog', false);
        let s = await tab.clickLink('footer a[href="/ru/terms"]', '/ru/terms');
        expect(s).toMatchObject({
          path: '/ru/terms',
          canonical: `${ORIGIN}/en/terms`,
          htmlLang: 'ru',
          articleLang: 'en',
          pressed: 'en',
        });

        for (const locale of ['ru', 'de', 'fr', 'it', 'es']) {
          for (const page of ['legal', 'terms', 'privacy']) {
            s = await tab.navigate(`/${locale}/${page}`);
            expect(s).toMatchObject({
              canonical: `${ORIGIN}/en/${page}`,
              htmlLang: locale,
              articleLang: 'en',
              pressed: 'en',
              ogUrl: `${ORIGIN}/en/${page}`,
            });
            expect(s.alternates).toEqual([]);
          }
        }
        for (const locale of ['ka', 'en']) {
          for (const page of ['legal', 'terms', 'privacy']) {
            s = await tab.navigate(`/${locale}/${page}`);
            expect(s).toMatchObject({
              canonical: `${ORIGIN}/${locale}/${page}`,
              htmlLang: locale,
              articleLang: locale,
              pressed: locale,
              ogUrl: `${ORIGIN}/${locale}/${page}`,
            });
            expect(s.alternates).toEqual(realAlternates(`/${page}`));
          }
        }
      } finally {
        tab.close();
        launched.cleanup();
      }
    },
    240000,
  );
});

import { execFileSync } from 'child_process';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';
import { bareRootRedirectPath } from '../../../web/src/lib/bare-root-redirect';
import { localeSwitchHref, localeSwitchPathname } from '../../../web/src/lib/locale-switch-href';
import { publicPageHtmlMetadata } from '../../../web/src/lib/seo-html-metadata';
import { languageAlternates, localizedPublicUrl } from '../../../web/src/lib/seo-sitemap';

const WEB_ROOT = join(__dirname, '../../../web');
const WEB_SRC = join(WEB_ROOT, 'src');
const PRODUCT = '/products/abc12345';
const FARM = '/farms/farm12345';
const REQUEST = '/requests/req123456';

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

function jitiEntry(): string {
  const store = join(__dirname, '../../../../node_modules/.pnpm');
  const directory = readdirSync(store).find((name) => name.startsWith('jiti@'));
  if (!directory) {
    throw new Error('jiti is not installed');
  }
  const entry = join(store, directory, 'node_modules/jiti/lib/jiti.mjs');
  if (!existsSync(entry)) {
    throw new Error(`jiti entry is missing at ${entry}`);
  }
  return entry;
}

type MiddlewareCase = {
  path: string;
  cookie?: string;
};

type MiddlewareResult = {
  path: string;
  status: number;
  location: string | null;
  link: string | null;
  next: string | null;
  locale: string | null;
  pathname: string | null;
};

function invokeMiddleware(cases: MiddlewareCase[]): MiddlewareResult[] {
  const script = `
    import { createJiti } from ${JSON.stringify(jitiEntry())};
    const jiti = createJiti(import.meta.url);
    const { NextRequest } = await jiti.import('next/server');
    const middleware = (await jiti.import(${JSON.stringify(join(WEB_SRC, 'middleware.ts'))})).default;
    const cases = JSON.parse(process.env.MIDDLEWARE_CASES);
    const results = [];
    for (const item of cases) {
      const request = new NextRequest(new URL(item.path, 'https://agrobridge.ge'), {
        headers: item.cookie ? { cookie: item.cookie } : undefined,
      });
      const response = await middleware(request);
      results.push({
        path: item.path,
        status: response.status,
        location: response.headers.get('location'),
        link: response.headers.get('link'),
        next: response.headers.get('x-middleware-next'),
        locale: response.headers.get('x-middleware-request-x-next-intl-locale'),
        pathname: response.headers.get('x-middleware-request-x-agrobridge-pathname'),
      });
    }
    process.stdout.write(JSON.stringify(results));
  `;

  const stdout = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: WEB_ROOT,
    encoding: 'utf8',
    env: { ...process.env, MIDDLEWARE_CASES: JSON.stringify(cases) },
  });
  return JSON.parse(stdout) as MiddlewareResult[];
}

function expectEnglishDefault(suffix: string) {
  const metadata = publicPageHtmlMetadata('ru', `/ru${suffix}`);
  const languages = metadata?.alternates?.languages;
  expect(metadata?.alternates?.canonical).toBe(localizedPublicUrl('ru', suffix));
  expect(languages?.['x-default']).toBe(localizedPublicUrl(DEFAULT_LOCALE, suffix));
  expect(languages?.['x-default']).toBe(`https://agrobridge.ge/en${suffix}`);
  expect(languages?.['x-default']).not.toBe(`https://agrobridge.ge${suffix || '/'}`);
  for (const locale of LOCALES) {
    expect(languages?.[locale]).toBe(`https://agrobridge.ge/${locale}${suffix}`);
  }
  expect(Object.keys(languages ?? {}).sort()).toEqual([...LOCALES, 'x-default'].sort());
}

describe('HTML hreflang stays on the English URL', () => {
  it('covers the homepage, product, farm, and purchase request', () => {
    expect(LOCALES).toEqual(['ka', 'en', 'ru', 'de', 'fr', 'it', 'es']);
    expectEnglishDefault('');
    expectEnglishDefault(PRODUCT);
    expectEnglishDefault(FARM);
    expectEnglishDefault(REQUEST);
    expect(languageAlternates(PRODUCT)['x-default']).toBe(
      'https://agrobridge.ge/en/products/abc12345',
    );
  });

  it('keeps canonical on the current locale and leaves sitemap helpers in place', () => {
    expect(publicPageHtmlMetadata('en', '/en')?.alternates?.canonical).toBe(
      'https://agrobridge.ge/en',
    );
    expect(publicPageHtmlMetadata('ka', `/ka${FARM}`)?.alternates?.canonical).toBe(
      `https://agrobridge.ge/ka${FARM}`,
    );
    expect(readWeb('app/sitemap.ts')).toContain('buildPublicSitemap');
    expect(readWeb('app/robots.ts')).toContain('PRODUCTION_SITEMAP_URL');
    expect(readWeb('lib/seo-sitemap.ts')).toContain("languages['x-default']");
    expect(readWeb('lib/seo-html-metadata.ts')).toContain('canonical: localizedPublicUrl');
    expect(readWeb('app/sitemap.ts')).not.toContain('alternateLinks');
    expect(readWeb('lib/seo-sitemap.ts')).not.toContain('alternateLinks');
  });
});

describe('locale routing stays independent of the Link header', () => {
  it('keeps the locale prefix, English default, and root landing rule', () => {
    const routing = readWeb('i18n/routing.ts');
    expect(routing).toContain("localePrefix: 'always'");
    expect(routing).toContain('defaultLocale: DEFAULT_LOCALE');
    expect(routing).toContain('alternateLinks: false');
    expect(routing).not.toContain('localeDetection');
    expect(DEFAULT_LOCALE).toBe('en');
    expect(bareRootRedirectPath('/')).toBe('/ka');
    expect(bareRootRedirectPath('/', 'ru')).toBe('/ru');
    expect(localeSwitchPathname(`/de${PRODUCT}`)).toBe(PRODUCT);
    expect(localeSwitchHref(`/fr${REQUEST}`, '')).toBe(REQUEST);
  });
});

describe('HTTP Link header from middleware', () => {
  const responses = invokeMiddleware([
    { path: '/en' },
    { path: `/en${PRODUCT}` },
    { path: `/ka${FARM}` },
    { path: `/ru${REQUEST}` },
    { path: '/' },
    { path: '/', cookie: 'NEXT_LOCALE=de' },
    { path: PRODUCT },
    { path: '/catalog' },
  ]);

  it('does not emit a locale-less x-default on public pages', () => {
    for (const path of ['/en', `/en${PRODUCT}`, `/ka${FARM}`, `/ru${REQUEST}`]) {
      const response = responses.find((item) => item.path === path);
      expect(response?.status).toBe(200);
      expect(response?.location).toBeNull();
      expect(response?.next).toBe('1');
      expect(response?.link).toBeNull();
    }
  });

  it('keeps locale routing, the root redirect, and unprefixed redirects', () => {
    const home = responses.find((item) => item.path === '/en');
    const product = responses.find((item) => item.path === `/en${PRODUCT}`);
    const farm = responses.find((item) => item.path === `/ka${FARM}`);
    const request = responses.find((item) => item.path === `/ru${REQUEST}`);
    expect(home?.locale).toBe('en');
    expect(home?.pathname).toBe('/en');
    expect(product?.locale).toBe('en');
    expect(product?.pathname).toBe(`/en${PRODUCT}`);
    expect(farm?.locale).toBe('ka');
    expect(farm?.pathname).toBe(`/ka${FARM}`);
    expect(request?.locale).toBe('ru');
    expect(request?.pathname).toBe(`/ru${REQUEST}`);

    const root = responses.filter((item) => item.path === '/');
    expect(root[0]?.status).toBe(307);
    expect(root[0]?.location).toBe('https://agrobridge.ge/ka');
    expect(root[0]?.link).toBeNull();
    expect(root[1]?.status).toBe(307);
    expect(root[1]?.location).toBe('https://agrobridge.ge/de');
    expect(root[1]?.link).toBeNull();

    const unprefixedProduct = responses.find((item) => item.path === PRODUCT);
    const unprefixedCatalog = responses.find((item) => item.path === '/catalog');
    expect(unprefixedProduct?.status).toBe(307);
    expect(unprefixedProduct?.location).toBe(`https://agrobridge.ge/en${PRODUCT}`);
    expect(unprefixedProduct?.link).toBeNull();
    expect(unprefixedCatalog?.status).toBe(307);
    expect(unprefixedCatalog?.location).toBe('https://agrobridge.ge/en/catalog');
    expect(unprefixedCatalog?.link).toBeNull();
  });

  it('does not add another Link header', () => {
    const joined = responses.map((item) => item.link ?? '').join('\n');
    expect(joined).not.toContain('hreflang="x-default"');
    expect(joined).not.toContain('https://agrobridge.ge/;');
    expect(joined).not.toContain('https://agrobridge.ge/products/');
  });
});

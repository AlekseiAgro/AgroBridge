import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';
import { languageAlternates, localizedPublicUrl } from '../../../web/src/lib/seo-sitemap';
import { publicPageHtmlMetadata } from '../../../web/src/lib/seo-html-metadata';
import { localeSwitchHref, localeSwitchPathname } from '../../../web/src/lib/locale-switch-href';
import {
  BARE_ROOT_LANDING_LOCALE,
  NEXT_LOCALE_COOKIE,
  bareRootRedirectPath,
} from '../../../web/src/lib/bare-root-redirect';

const WEB = join(__dirname, '../../../web/src');

function readWeb(path: string): string {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('bare root landing locale', () => {
  it('sends first-time visitors on / to /ka regardless of Accept-Language', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(BARE_ROOT_LANDING_LOCALE).toBe('ka');
    expect(NEXT_LOCALE_COOKIE).toBe('NEXT_LOCALE');
    expect(bareRootRedirectPath('/')).toBe('/ka');
    expect(bareRootRedirectPath('/', null)).toBe('/ka');
    expect(bareRootRedirectPath('/', undefined)).toBe('/ka');
    expect(bareRootRedirectPath('/', '')).toBe('/ka');
  });

  it('honors a valid NEXT_LOCALE cookie on / and ignores invalid values', () => {
    for (const locale of LOCALES) {
      expect(bareRootRedirectPath('/', locale)).toBe(`/${locale}`);
    }

    expect(bareRootRedirectPath('/', 'invalid')).toBe('/ka');
    expect(bareRootRedirectPath('/', 'ru-RU')).toBe('/ka');
    expect(bareRootRedirectPath('/', 'EN')).toBe('/ka');
    expect(bareRootRedirectPath('/', ' uk ')).toBe('/ka');
  });

  it('does not use Accept-Language for the bare root decision', () => {
    const helper = readWeb('lib/bare-root-redirect.ts');
    const middleware = readWeb('middleware.ts');
    expect(helper).not.toMatch(/accept-language/i);
    expect(helper).toContain('isLocale');
    expect(middleware).not.toMatch(/accept-language/i);
    expect(middleware).toContain('cookies.get(NEXT_LOCALE_COOKIE)');
    expect(bareRootRedirectPath('/', undefined)).toBe('/ka');
  });

  it('does not rewrite explicit locale homes or prefixed public/auth paths', () => {
    for (const locale of LOCALES) {
      expect(bareRootRedirectPath(`/${locale}`, 'ru')).toBeNull();
      expect(bareRootRedirectPath(`/${locale}/catalog`, 'en')).toBeNull();
      expect(bareRootRedirectPath(`/${locale}/login`, 'ka')).toBeNull();
      expect(bareRootRedirectPath(`/${locale}/account`, 'de')).toBeNull();
    }

    expect(bareRootRedirectPath('/en/catalog')).toBeNull();
    expect(bareRootRedirectPath('/ru/catalog')).toBeNull();
    expect(bareRootRedirectPath('/ka/catalog')).toBeNull();
    expect(bareRootRedirectPath('/en/login')).toBeNull();
    expect(bareRootRedirectPath('/ru/login')).toBeNull();
    expect(bareRootRedirectPath('/ka/account')).toBeNull();
    expect(bareRootRedirectPath('/api/health')).toBeNull();
    expect(bareRootRedirectPath('/catalog')).toBeNull();
  });

  it('wires the root rule in middleware before next-intl and keeps the matcher', () => {
    const middleware = readWeb('middleware.ts');
    expect(middleware).toContain("from './lib/bare-root-redirect'");
    expect(middleware).toContain('bareRootRedirectPath(');
    expect(middleware).toContain('NextResponse.redirect(url)');
    expect(middleware).toContain('request.nextUrl.clone()');
    expect(middleware).toContain('return intlMiddleware(request)');
    expect(middleware).toContain('createMiddleware');
    expect(middleware).toContain("'/'");
    expect(middleware).toContain('/(ka|en|ru|de|fr|it|es)/:path*');
    expect(middleware).toContain('_next|_vercel|api');

    const helperIndex = middleware.indexOf('bareRootRedirectPath');
    const intlIndex = middleware.lastIndexOf('return intlMiddleware(request)');
    expect(helperIndex).toBeGreaterThan(-1);
    expect(intlIndex).toBeGreaterThan(helperIndex);
  });

  it('does not change DEFAULT_LOCALE, locale detection, or the locale list', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(LOCALES).toEqual(['ka', 'en', 'ru', 'de', 'fr', 'it', 'es']);

    const routing = readWeb('i18n/routing.ts');
    expect(routing).toContain('defaultLocale: DEFAULT_LOCALE');
    expect(routing).toContain("localePrefix: 'always'");
    expect(routing).not.toContain('localeDetection');
    expect(routing).not.toContain('localeCookie');

    const locales = readFileSync(join(WEB, '../../../packages/shared/src/locales.ts'), 'utf8');
    expect(locales).toContain("export const DEFAULT_LOCALE: Locale = 'en'");
  });

  it('leaves language switcher path rewriting unchanged', () => {
    expect(localeSwitchPathname('/')).toBe('/');
    expect(localeSwitchPathname('/ka')).toBe('/');
    expect(localeSwitchPathname('/en/catalog')).toBe('/catalog');
    expect(localeSwitchPathname('/ru/catalog')).toBe('/catalog');
    expect(localeSwitchHref('/en/login', '?next=%2Faccount')).toBe('/login?next=%2Faccount');

    const switcher = readWeb('components/LanguageSwitcher.tsx');
    expect(switcher).toContain('locale={code as Locale}');
    expect(switcher).toContain('localeSwitchHref');
  });

  it('leaves SEO canonical, hreflang, and sitemap x-default on DEFAULT_LOCALE', () => {
    expect(publicPageHtmlMetadata('en', '/en/catalog')?.alternates?.canonical).toBe(
      'https://agrobridge.ge/en/catalog',
    );
    expect(publicPageHtmlMetadata('ru', '/ru/catalog')?.alternates?.canonical).toBe(
      'https://agrobridge.ge/ru/catalog',
    );
    expect(publicPageHtmlMetadata('ka', '/ka/catalog')?.alternates?.canonical).toBe(
      'https://agrobridge.ge/ka/catalog',
    );
    expect(languageAlternates('/catalog')['x-default']).toBe(
      localizedPublicUrl(DEFAULT_LOCALE, '/catalog'),
    );
    expect(localizedPublicUrl(DEFAULT_LOCALE, '/catalog')).toBe('https://agrobridge.ge/en/catalog');
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';
import { languageAlternates, localizedPublicUrl } from '../../../web/src/lib/seo-sitemap';
import { publicPageHtmlMetadata } from '../../../web/src/lib/seo-html-metadata';
import { localeSwitchHref, localeSwitchPathname } from '../../../web/src/lib/locale-switch-href';
import {
  BARE_ROOT_LANDING_PATH,
  bareRootRedirectPath,
} from '../../../web/src/lib/bare-root-redirect';

const WEB = join(__dirname, '../../../web/src');

function readWeb(path: string): string {
  return readFileSync(join(WEB, path), 'utf8');
}

describe('bare root landing locale', () => {
  it('redirects only the unprefixed root to /ka', () => {
    expect(DEFAULT_LOCALE).toBe('en');
    expect(BARE_ROOT_LANDING_PATH).toBe('/ka');
    expect(bareRootRedirectPath('/')).toBe('/ka');
  });

  it('does not rewrite explicit locale homes or prefixed public/auth paths', () => {
    for (const locale of LOCALES) {
      expect(bareRootRedirectPath(`/${locale}`)).toBeNull();
      expect(bareRootRedirectPath(`/${locale}/catalog`)).toBeNull();
      expect(bareRootRedirectPath(`/${locale}/login`)).toBeNull();
      expect(bareRootRedirectPath(`/${locale}/account`)).toBeNull();
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
    expect(middleware).toContain('bareRootRedirectPath(request.nextUrl.pathname)');
    expect(middleware).toContain('NextResponse.redirect(url)');
    expect(middleware).toContain('return intlMiddleware(request)');
    expect(middleware).toContain('createMiddleware');
    expect(middleware).toContain("matcher: ['/', '/(ka|en|ru|de|fr|it|es)/:path*', '/((?!_next|_vercel|api|.*\\..*).*)']");

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

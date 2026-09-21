import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { LOCALES } from '@agrobridge/shared';
import { publicProductWhere } from '../products/public-product.where';
import {
  AUTH_CRAWLABLE_NOINDEX_SUFFIXES,
  PRODUCTION_SITEMAP_URL,
  PRODUCTION_WEB_ORIGIN,
  ROBOTS_DISALLOW_SUFFIXES,
  robotsDisallowPaths,
} from '../../../web/src/lib/seo-robots';

const WEB_SRC = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

const AUTH_NOINDEX_PAGES = [
  'app/[locale]/login/page.tsx',
  'app/[locale]/register/page.tsx',
  'app/[locale]/forgot-password/page.tsx',
  'app/[locale]/reset-password/page.tsx',
  'app/[locale]/verify-email/page.tsx',
  'app/[locale]/requests/new/page.tsx',
  'app/[locale]/account/layout.tsx',
  'app/[locale]/dashboard/layout.tsx',
] as const;

const PUBLIC_PAGE_SOURCES = [
  'app/[locale]/page.tsx',
  'app/[locale]/catalog/page.tsx',
  'app/[locale]/products/[id]/page.tsx',
  'app/[locale]/farms/[id]/page.tsx',
  'app/[locale]/requests/page.tsx',
  'app/[locale]/requests/[id]/page.tsx',
  'app/[locale]/legal/page.tsx',
  'app/[locale]/terms/page.tsx',
  'app/[locale]/privacy/page.tsx',
] as const;

describe('robots.txt rules', () => {
  it('exposes a Next metadata robots route', () => {
    expect(existsSync(join(WEB_SRC, 'app/robots.ts'))).toBe(true);
    expect(existsSync(join(WEB_SRC, 'app/sitemap.ts'))).toBe(true);
  });

  it('points crawlers at the production sitemap URL', () => {
    const source = readWeb('app/robots.ts');
    expect(PRODUCTION_WEB_ORIGIN).toBe('https://agrobridge.ge');
    expect(PRODUCTION_SITEMAP_URL).toBe('https://agrobridge.ge/sitemap.xml');
    expect(source).toContain('userAgent: \'*\'');
    expect(source).toContain('allow: \'/\'');
    expect(source).toContain('disallow: robotsDisallowPaths()');
    expect(source).toContain('sitemap: PRODUCTION_SITEMAP_URL');
    expect(source).not.toContain('agrobrid.ge');
    expect(source).not.toMatch(/\{ka,en/);
    expect(readWeb('lib/seo-robots.ts')).not.toContain('agrobrid.ge');
    expect(readWeb('lib/seo-robots.ts')).not.toMatch(/\{ka,en/);
  });

  it('emits explicit locale Disallow lines without brace-expansion syntax', () => {
    const disallow = robotsDisallowPaths();
    expect(disallow.join('\n')).not.toMatch(/[{}]/);
    expect(ROBOTS_DISALLOW_SUFFIXES).toEqual(['/dashboard', '/account', '/requests/new']);
    expect(disallow).toEqual(
      LOCALES.flatMap((locale) => [
        `/${locale}/dashboard`,
        `/${locale}/account`,
        `/${locale}/requests/new`,
      ]),
    );
  });

  it('disallows cabinet surfaces for every locale and leaves auth pages crawlable', () => {
    const disallow = robotsDisallowPaths();
    const blob = disallow.join('\n');
    for (const locale of LOCALES) {
      expect(disallow).toContain(`/${locale}/dashboard`);
      expect(disallow).toContain(`/${locale}/account`);
      expect(disallow).toContain(`/${locale}/requests/new`);
      for (const suffix of AUTH_CRAWLABLE_NOINDEX_SUFFIXES) {
        expect(disallow).not.toContain(`/${locale}${suffix}`);
      }
    }
    expect(blob).not.toContain('/login');
    expect(blob).not.toContain('/register');
    expect(blob).not.toContain('/forgot-password');
    expect(blob).not.toContain('/reset-password');
    expect(blob).not.toContain('/verify-email');
  });

  it('does not disallow public catalog, product, farm, request, or legal surfaces', () => {
    const blob = robotsDisallowPaths().join('\n');
    expect(blob).not.toMatch(/\/catalog$/m);
    expect(blob).not.toContain('/products');
    expect(blob).not.toContain('/farms');
    expect(blob).not.toContain('/legal');
    expect(blob).not.toContain('/terms');
    expect(blob).not.toContain('/privacy');
    expect(blob.split('\n').some((line) => line === '/en/requests' || line.endsWith('/requests'))).toBe(
      false,
    );
    expect(blob).toContain('/en/requests/new');
  });
});

describe('auth SEO metadata', () => {
  it('marks login, register, recovery, verify, and cabinet shells noindex', () => {
    for (const path of AUTH_NOINDEX_PAGES) {
      const source = readWeb(path);
      expect(source).toContain('noindexRobots');
      expect(source).toContain('robots: noindexRobots');
    }
  });

  it('does not apply global noindex in the locale layout', () => {
    const layout = readWeb('app/[locale]/layout.tsx');
    expect(layout).not.toContain('noindexRobots');
    expect(layout).not.toContain('index: false');
    expect(layout).toContain('title: t(\'title\')');
  });

  it('leaves public marketplace pages without noindex metadata', () => {
    for (const path of PUBLIC_PAGE_SOURCES) {
      const source = readWeb(path);
      expect(source).not.toContain('noindexRobots');
      expect(source).not.toContain('index: false');
    }
  });
});

describe('public product visibility regression', () => {
  it('keeps the shared public listing filter used by catalog and farms', () => {
    expect(publicProductWhere.isPublished).toBe(true);
    expect(publicProductWhere.moderationStatus).toBe('approved');
    expect(JSON.stringify(publicProductWhere)).toContain('Untitled product');
    expect(JSON.stringify(publicProductWhere)).toContain('Новый товар');
  });
});

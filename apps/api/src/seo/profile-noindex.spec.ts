import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';
import { publicPageHtmlMetadata } from '../../../web/src/lib/seo-html-metadata';
import {
  noindexFollowRobots,
  noindexRobots,
  robotsDisallowPaths,
} from '../../../web/src/lib/seo-robots';
import { languageAlternates, STATIC_PUBLIC_PATHS } from '../../../web/src/lib/seo-sitemap';

const WEB_SRC = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

const PROFILE_PAGES = [
  'app/[locale]/users/[id]/page.tsx',
  'app/[locale]/users/[id]/reviews/page.tsx',
] as const;

const INDEXABLE_PAGES = [
  'app/[locale]/page.tsx',
  'app/[locale]/catalog/page.tsx',
  'app/[locale]/products/[id]/page.tsx',
  'app/[locale]/farms/[id]/page.tsx',
  'app/[locale]/requests/page.tsx',
  'app/[locale]/requests/[id]/page.tsx',
] as const;

describe('public profile and review noindex', () => {
  it('marks profiles and standalone reviews noindex but follow', () => {
    expect(noindexFollowRobots).toEqual({ index: false, follow: true });
    expect(noindexRobots).toEqual({ index: false, follow: false });

    for (const path of PROFILE_PAGES) {
      const source = readWeb(path);
      expect(source).toContain('noindexFollowRobots');
      expect(source).toContain('robots: noindexFollowRobots');
      expect(source).not.toContain('noindexRobots');
      expect(source).not.toContain('seo-public-metadata');
    }
  });

  it('leaves marketplace pages indexable', () => {
    for (const path of INDEXABLE_PAGES) {
      const source = readWeb(path);
      expect(source).not.toContain('noindexFollowRobots');
      expect(source).not.toContain('noindexRobots');
      expect(source).not.toContain('index: false');
    }
    expect(readWeb('app/[locale]/layout.tsx')).not.toContain('index: false');
  });

  it('keeps canonical, hreflang, sitemap membership, and robots.txt crawl access', () => {
    expect(publicPageHtmlMetadata('en', '/en/products/abc12345')?.alternates?.canonical).toBe(
      'https://agrobridge.ge/en/products/abc12345',
    );
    expect(languageAlternates('/products/abc12345')['x-default']).toBe(
      'https://agrobridge.ge/en/products/abc12345',
    );
    expect(publicPageHtmlMetadata('en', '/en/catalog')?.alternates?.canonical).toBe(
      'https://agrobridge.ge/en/catalog',
    );
    expect(LOCALES).toEqual(['ka', 'en', 'ru', 'de', 'fr', 'it', 'es']);
    expect(DEFAULT_LOCALE).toBe('en');

    const sitemap = readWeb('lib/seo-sitemap.ts');
    expect(sitemap).not.toContain('/users');
    expect(sitemap).not.toContain('/reviews');
    expect(STATIC_PUBLIC_PATHS).not.toContain('/users');
    expect(readWeb('app/sitemap.ts')).toContain('buildPublicSitemap');
    expect(readWeb('app/robots.ts')).not.toContain('/users');

    const disallow = robotsDisallowPaths().join('\n');
    expect(disallow).not.toContain('/users');
    expect(disallow).not.toContain('/reviews');

    const routing = readWeb('i18n/routing.ts');
    expect(routing).toContain("localePrefix: 'always'");
    expect(routing).toContain('alternateLinks: false');
  });
});

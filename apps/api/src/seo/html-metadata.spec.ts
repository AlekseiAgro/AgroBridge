import { readFileSync } from 'fs';
import { join } from 'path';
import { DEFAULT_LOCALE, LOCALES } from '@agrobridge/shared';
import { PRODUCTION_WEB_ORIGIN } from '../../../web/src/lib/seo-robots';
import {
  isPrivateOrNoindexSuffix,
  isPublicIndexableSuffix,
  publicPageHtmlMetadata,
  publicPathSuffixFromPathname,
} from '../../../web/src/lib/seo-html-metadata';
import { languageAlternates, localizedPublicUrl } from '../../../web/src/lib/seo-sitemap';

const WEB_SRC = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB_SRC, path), 'utf8');
}

describe('public HTML path classification', () => {
  it('strips the locale prefix the same way locale switching does', () => {
    expect(publicPathSuffixFromPathname('/en')).toBe('');
    expect(publicPathSuffixFromPathname('/en/catalog')).toBe('/catalog');
    expect(publicPathSuffixFromPathname('/ru/requests')).toBe('/requests');
    expect(publicPathSuffixFromPathname('/ka/products/abc12345')).toBe('/products/abc12345');
    expect(publicPathSuffixFromPathname(null)).toBeNull();
  });

  it('treats sitemap public surfaces and public record pages as indexable', () => {
    expect(isPublicIndexableSuffix('')).toBe(true);
    expect(isPublicIndexableSuffix('/catalog')).toBe(true);
    expect(isPublicIndexableSuffix('/requests')).toBe(true);
    expect(isPublicIndexableSuffix('/products/cmsdawx9x0089p524j84r6e2i')).toBe(true);
    expect(isPublicIndexableSuffix('/farms/cmu61musi000bs301nxen98ah')).toBe(true);
    expect(isPublicIndexableSuffix('/requests/cmu9imypg0001n101usncw9l0')).toBe(true);
  });

  it('does not invent canonicals for private, auth, or malformed paths', () => {
    expect(isPrivateOrNoindexSuffix('/dashboard')).toBe(true);
    expect(isPrivateOrNoindexSuffix('/dashboard/quotes')).toBe(true);
    expect(isPrivateOrNoindexSuffix('/account')).toBe(true);
    expect(isPrivateOrNoindexSuffix('/account/settings')).toBe(true);
    expect(isPrivateOrNoindexSuffix('/requests/new')).toBe(true);
    expect(isPrivateOrNoindexSuffix('/login')).toBe(true);
    expect(isPrivateOrNoindexSuffix('/register')).toBe(true);
    expect(isPublicIndexableSuffix('/dashboard/quotes')).toBe(false);
    expect(isPublicIndexableSuffix('/account/settings')).toBe(false);
    expect(isPublicIndexableSuffix('/requests/new')).toBe(false);
    expect(isPublicIndexableSuffix('/login')).toBe(false);
    expect(isPublicIndexableSuffix('/products/../secret')).toBe(false);
    expect(isPublicIndexableSuffix('/products/abc')).toBe(false);
  });
});

describe('public HTML canonical and hreflang', () => {
  it('emits production canonical plus locale alternates and x-default', () => {
    const metadata = publicPageHtmlMetadata('en', '/en/catalog');
    expect(metadata?.alternates?.canonical).toBe(`${PRODUCTION_WEB_ORIGIN}/en/catalog`);
    expect(metadata?.alternates?.languages).toEqual(languageAlternates('/catalog'));
    expect(metadata?.alternates?.languages?.['x-default']).toBe(
      localizedPublicUrl(DEFAULT_LOCALE, '/catalog'),
    );
    for (const locale of LOCALES) {
      expect(metadata?.alternates?.languages?.[locale]).toBe(
        localizedPublicUrl(locale, '/catalog'),
      );
    }
  });

  it('uses the page locale for home, catalog, and requests', () => {
    expect(publicPageHtmlMetadata('en', '/en')?.alternates?.canonical).toBe(
      `${PRODUCTION_WEB_ORIGIN}/en`,
    );
    expect(publicPageHtmlMetadata('ru', '/ru')?.alternates?.canonical).toBe(
      `${PRODUCTION_WEB_ORIGIN}/ru`,
    );
    expect(publicPageHtmlMetadata('ka', '/ka/requests')?.alternates?.canonical).toBe(
      `${PRODUCTION_WEB_ORIGIN}/ka/requests`,
    );
  });

  it('omits HTML alternates on private and auth surfaces', () => {
    expect(publicPageHtmlMetadata('en', '/en/dashboard/quotes')).toBeNull();
    expect(publicPageHtmlMetadata('en', '/en/account')).toBeNull();
    expect(publicPageHtmlMetadata('en', '/en/account/settings')).toBeNull();
    expect(publicPageHtmlMetadata('ru', '/ru/login')).toBeNull();
    expect(publicPageHtmlMetadata('ka', '/ka/requests/new')).toBeNull();
    expect(publicPageHtmlMetadata('de', '/de/verify-email')).toBeNull();
  });

  it('never points canonical or hreflang at retired or API hosts', () => {
    const metadata = publicPageHtmlMetadata('en', '/en/catalog');
    const blob = JSON.stringify(metadata);
    expect(blob).toContain('https://agrobridge.ge');
    expect(blob).not.toContain('agrobrid.ge');
    expect(blob).not.toContain('api.agrobridge.ge');
    expect(blob).not.toContain('localhost');
  });
});

describe('locale layout HTML SEO wiring', () => {
  it('reuses the public HTML metadata helper and request pathname header', () => {
    const layout = readWeb('app/[locale]/layout.tsx');
    expect(layout).toContain('publicPageHtmlMetadata');
    expect(layout).toContain('REQUEST_PATHNAME_HEADER');
    expect(layout).toContain('title: t(\'title\')');
    expect(layout).toContain('description: t(\'description\')');
    expect(layout).not.toContain('agrobrid.ge');
  });

  it('leaves noindex robots on auth and cabinet shells', () => {
    for (const path of [
      'app/[locale]/login/page.tsx',
      'app/[locale]/account/layout.tsx',
      'app/[locale]/dashboard/layout.tsx',
      'app/[locale]/requests/new/page.tsx',
    ]) {
      expect(readWeb(path)).toContain('robots: noindexRobots');
    }
  });
});

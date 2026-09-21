import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web/src');
const MESSAGES_DIR = join(__dirname, '../../../web/messages');

type Nested = Record<string, unknown>;

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function messages(locale: string): Nested {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, `${locale}.json`), 'utf8')) as Nested;
}

function read(obj: Nested, path: string): string {
  const value = path.split('.').reduce<unknown>((acc, key) => {
    if (!acc || typeof acc !== 'object') return undefined;
    return (acc as Nested)[key];
  }, obj);
  if (typeof value !== 'string') {
    throw new Error(`Missing string ${path}`);
  }
  return value;
}

describe('public header marketplace discoverability', () => {
  it('adds Catalog and Purchase Requests to the shared public SiteHeader', () => {
    const header = readWeb('components/SiteHeader.tsx');
    const catalogIndex = header.indexOf("href=\"/catalog\">{t('catalog')}");
    const requestsIndex = header.indexOf("href=\"/requests\">{t('purchaseRequests')}");
    const howItWorksIndex = header.indexOf("href=\"/how-it-works\"");

    expect(catalogIndex).toBeGreaterThan(-1);
    expect(requestsIndex).toBeGreaterThan(catalogIndex);
    expect(howItWorksIndex).toBeGreaterThan(requestsIndex);
    expect(header).toContain("from '@/i18n/navigation'");
    expect(header).not.toContain('href="/buyers"');
    expect(header).not.toContain('href="/sellers"');
    expect(header).not.toContain('site-header__role-link');
    expect(header).not.toContain("t('forBuyers')");
    expect(header).not.toContain("t('forSellers')");
    expect(header).not.toContain('NotificationBell');
    expect(header).not.toContain("t('subscriptions')");
    expect(header).not.toContain("t('notifications')");
  });

  it('keeps homepage Hero buyer/seller CTAs outside the public header', () => {
    const home = readWeb('app/[locale]/page.tsx');
    expect(home).toContain('<SiteHeader tone="light" />');
    expect(home).toContain('home__actions');
    expect(home).toContain("href=\"/buyers\"");
    expect(home).toContain("href=\"/sellers\"");
    expect(home).toContain("{t('ctaBuyer')}");
    expect(home).toContain("{t('ctaSeller')}");
  });

  it('does not copy public marketplace links into a second header or cabinet chrome', () => {
    const header = readWeb('components/SiteHeader.tsx');
    const cabinet = readWeb('components/CabinetShell.tsx');
    const publicShell = readWeb('components/CabinetOrPublicShell.tsx');

    expect(header).toContain('SiteHeader');
    expect(header.split('href="/catalog"').length).toBe(2);
    expect(header.split('href="/requests"').length).toBe(2);

    expect(publicShell).toContain('SiteHeader');
    expect(publicShell).toContain('CabinetShell');
    expect(publicShell).toContain('emailVerified');

    expect(cabinet).not.toContain('site-header');
    expect(cabinet).toContain("href=\"/catalog\">{tCatalog('title')}");
    expect(cabinet).toContain("href=\"/requests\">{t('purchaseRequests')}");
    expect(cabinet).toContain('NotificationBell');
    expect(cabinet).not.toContain("href=\"/buyers\"");
    expect(cabinet).not.toContain("href=\"/sellers\"");
  });

  it('reuses existing nav labels in every locale with Russian marketplace wording', () => {
    const expected: Record<(typeof LOCALES)[number], { catalog: string; purchaseRequests: string }> =
      {
        en: { catalog: 'Catalog', purchaseRequests: 'Purchase requests' },
        ru: { catalog: 'Каталог', purchaseRequests: 'Запросы на покупку' },
        ka: { catalog: 'კატალოგი', purchaseRequests: 'შესყიდვის მოთხოვნები' },
        de: { catalog: 'Katalog', purchaseRequests: 'Kaufanfragen' },
        fr: { catalog: 'Catalogue', purchaseRequests: "Demandes d'achat" },
        it: { catalog: 'Catalogo', purchaseRequests: 'Richieste di acquisto' },
        es: { catalog: 'Catálogo', purchaseRequests: 'Solicitudes de compra' },
      };

    for (const locale of LOCALES) {
      const catalog = read(messages(locale), 'nav.catalog');
      const purchaseRequests = read(messages(locale), 'nav.purchaseRequests');
      expect(catalog).toBe(expected[locale].catalog);
      expect(purchaseRequests).toBe(expected[locale].purchaseRequests);
      expect(catalog.toLowerCase()).not.toContain('rfq');
      expect(purchaseRequests.toLowerCase()).not.toContain('rfq');
      expect(purchaseRequests.toLowerCase()).not.toContain('котиров');
      expect(purchaseRequests.toLowerCase()).not.toContain('quotation');
    }
  });

  it('lets the public header wrap instead of hiding overflow', () => {
    const css = readWeb('app/globals.css');
    const headerBlock = css.match(/\.site-header\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    const navBlock = css.match(/\.site-header__nav\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
    const linkBlock = css.match(/\.site-header__nav a\s*\{[\s\S]*?\n\}/)?.[0] ?? '';

    expect(headerBlock).toContain('min-width: 0');
    expect(navBlock).toContain('flex-wrap: wrap');
    expect(navBlock).toContain('min-width: 0');
    expect(linkBlock).toContain('overflow-wrap: break-word');
    expect(css).not.toMatch(/\.site-header[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/body[^{]*\{[^}]*overflow-x:\s*hidden/);
  });
});

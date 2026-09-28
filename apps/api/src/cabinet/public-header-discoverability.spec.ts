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

/** Top-level CSS declarations only, so a nested media-query rule cannot shadow the base selector. */
function topLevelRuleBodies(css: string, exactSelector: string): string[] {
  const bodies: string[] = [];
  let i = 0;
  let depth = 0;

  while (i < css.length) {
    if (css.startsWith('/*', i)) {
      const end = css.indexOf('*/', i + 2);
      i = end < 0 ? css.length : end + 2;
      continue;
    }
    if (css[i] === '{') {
      depth += 1;
      i += 1;
      continue;
    }
    if (css[i] === '}') {
      depth = Math.max(0, depth - 1);
      i += 1;
      continue;
    }
    if (depth !== 0) {
      i += 1;
      continue;
    }

    const brace = css.indexOf('{', i);
    if (brace < 0) break;
    const selectors = css
      .slice(i, brace)
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    if (!selectors.includes(exactSelector)) {
      i = brace;
      continue;
    }

    let nested = 1;
    let j = brace + 1;
    while (j < css.length && nested > 0) {
      if (css.startsWith('/*', j)) {
        const end = css.indexOf('*/', j + 2);
        j = end < 0 ? css.length : end + 2;
        continue;
      }
      if (css[j] === '{') nested += 1;
      else if (css[j] === '}') nested -= 1;
      j += 1;
    }
    bodies.push(css.slice(brace + 1, j - 1));
    i = j;
  }

  return bodies;
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
    const headerBlocks = topLevelRuleBodies(css, '.site-header');
    const navBlocks = topLevelRuleBodies(css, '.site-header__nav');
    const linkBlocks = topLevelRuleBodies(css, '.site-header__nav a');

    expect(headerBlocks).toHaveLength(1);
    expect(headerBlocks[0]).toContain('display: flex');
    expect(headerBlocks[0]).toContain('min-width: 0');
    expect(navBlocks.some((block) => block.includes('flex-wrap: wrap') && block.includes('min-width: 0'))).toBe(
      true,
    );
    expect(linkBlocks.some((block) => block.includes('overflow-wrap: break-word'))).toBe(true);
    expect(css).not.toMatch(/\.site-header[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/html[^{]*\{[^}]*overflow-x:\s*hidden/);
    expect(css).not.toMatch(/body[^{]*\{[^}]*overflow-x:\s*hidden/);
  });
});

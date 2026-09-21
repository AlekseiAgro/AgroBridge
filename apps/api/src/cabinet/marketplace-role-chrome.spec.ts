import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ka', 'ru', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web');
const MESSAGES_DIR = join(WEB, 'messages');

type Nested = Record<string, unknown>;

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

function source(relative: string): string {
  return readFileSync(join(WEB, 'src', relative), 'utf8');
}

describe('marketplace pages do not use buyer/seller role chrome', () => {
  it('identifies Catalog by the catalog title, not a buyer role eyebrow', () => {
    const page = source('app/[locale]/catalog/page.tsx');
    expect(page).toContain("<h1>{t('title')}</h1>");
    expect(page).toContain("t('subtitle')");
    expect(page).toContain('CatalogFilters');
    expect(page).not.toContain("forBuyers");
    expect(page).not.toContain("forSellers");
    expect(page).not.toContain('href="/buyers"');
    expect(page).not.toContain('href="/sellers"');
    expect(page).not.toContain('className="eyebrow"');
  });

  it('identifies the public Purchase Requests board by boardTitle, not role hubs', () => {
    const page = source('app/[locale]/requests/page.tsx');
    expect(page).toContain("<h1>{t('boardTitle')}</h1>");
    expect(page).toContain("t('boardSubtitle')");
    expect(page).toContain("href=\"/requests/new\"");
    expect(page).not.toContain("forBuyers");
    expect(page).not.toContain("forSellers");
    expect(page).not.toContain('href="/buyers"');
    expect(page).not.toContain('href="/sellers"');
    expect(page).not.toContain('className="eyebrow"');
    expect(page).not.toContain('mineTitle');
  });

  it('identifies New Purchase Request by createTitle, not a buyer role eyebrow', () => {
    const page = source('app/[locale]/requests/new/page.tsx');
    expect(page).toContain("<h1>{t('createTitle')}</h1>");
    expect(page).toContain("t('createSubtitle')");
    expect(page).toContain('PurchaseRequestForm');
    expect(page).not.toContain("forBuyers");
    expect(page).not.toContain("forSellers");
    expect(page).not.toContain('href="/buyers"');
    expect(page).not.toContain('className="eyebrow"');
  });

  it('keeps public buyer/seller hubs, Hero CTAs, footer, and header contract', () => {
    const buyers = source('app/[locale]/buyers/page.tsx');
    const sellers = source('app/[locale]/sellers/page.tsx');
    const home = source('app/[locale]/page.tsx');
    const header = source('components/SiteHeader.tsx');
    const footer = source('components/SiteFooter.tsx');

    expect(buyers).toContain("getTranslations('roleHubs.buyers')");
    expect(buyers).toContain("t('title')");
    expect(sellers).toContain("getTranslations('roleHubs.sellers')");
    expect(sellers).toContain("t('title')");
    expect(home).toContain("href=\"/buyers\"");
    expect(home).toContain("href=\"/sellers\"");
    expect(home).toContain("{t('ctaBuyer')}");
    expect(home).toContain("{t('ctaSeller')}");
    expect(header).not.toContain("t('forBuyers')");
    expect(header).not.toContain("t('forSellers')");
    expect(header).toContain("href=\"/catalog\">{t('catalog')}");
    expect(header).toContain("href=\"/requests\">{t('purchaseRequests')}");
    expect(footer).toContain("tn('forBuyers')");
    expect(footer).toContain("tn('forSellers')");
  });

  it('keeps role labels available for public onboarding in every locale', () => {
    expect(read(messages('en'), 'nav.forBuyers')).toBe("I'm a buyer");
    expect(read(messages('en'), 'nav.forSellers')).toBe("I'm a seller");
    expect(read(messages('ru'), 'nav.forBuyers')).toBe('Я покупатель');
    expect(read(messages('ru'), 'nav.forSellers')).toBe('Я продавец');
    expect(read(messages('en'), 'catalog.title')).toBe('Product catalog');
    expect(read(messages('ru'), 'catalog.title')).toBe('Каталог продукции');
    expect(read(messages('en'), 'purchaseRequests.boardTitle')).toBe('Purchase requests');
    expect(read(messages('ru'), 'purchaseRequests.boardTitle')).toBe('Запросы на покупку');
    expect(read(messages('en'), 'purchaseRequests.createTitle')).toBe('New purchase request');
    expect(read(messages('ru'), 'purchaseRequests.createTitle')).toBe('Новый запрос на покупку');

    for (const locale of LOCALES) {
      const keys = [
        'nav.forBuyers',
        'nav.forSellers',
        'home.ctaBuyer',
        'home.ctaSeller',
        'catalog.title',
        'purchaseRequests.boardTitle',
        'purchaseRequests.createTitle',
        'roleHubs.buyers.title',
        'roleHubs.sellers.title',
      ] as const;
      const values = keys.map((key) => read(messages(locale), key));
      for (const value of values) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
      const haystack = values.join('\n').toLowerCase();
      expect(haystack).not.toContain('котиров');
      expect(haystack).not.toContain('quotation');
      expect(haystack).not.toMatch(/\brfq\b/);
    }

    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      expect(read(messages(locale), 'nav.forBuyers')).not.toBe("I'm a buyer");
      expect(read(messages(locale), 'catalog.title')).not.toBe('Product catalog');
      expect(read(messages(locale), 'purchaseRequests.createTitle')).not.toBe(
        'New purchase request',
      );
    }
  });
});

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

const KEYS = [
  'notFound.title',
  'notFound.body',
  'notFound.home',
  'catalog.emptyTitle',
  'catalog.emptyFilteredTitle',
  'catalog.emptyUnfiltered',
  'catalog.emptyReset',
  'purchaseRequests.boardEmptyTitle',
  'purchaseRequests.boardEmptyFiltered',
  'purchaseRequests.boardEmptyReset',
  'purchaseRequests.mineEmptyTitle',
  'purchaseRequests.myQuotesEmptyTitle',
  'product.emptyMineTitle',
  'product.emptyPublishedTitle',
  'product.emptyPublished',
  'product.emptyPendingTitle',
  'product.emptyPending',
  'product.emptyShowAll',
] as const;

describe('branded 404 and empty states', () => {
  it('adds a locale-aware public 404 and nested shell-safe not-found pages', () => {
    const locale404 = readWeb('app/[locale]/not-found.tsx');
    const root404 = readWeb('app/not-found.tsx');
    const catchAll = readWeb('app/[locale]/[...rest]/page.tsx');
    const catalog404 = readWeb('app/[locale]/catalog/not-found.tsx');
    const dashboard404 = readWeb('app/[locale]/dashboard/not-found.tsx');

    expect(locale404).toContain('SiteHeader');
    expect(locale404).toContain('NotFoundPanel');
    expect(locale404).not.toContain('href="/buyers"');
    expect(root404).toContain('NotFoundPanel');
    expect(root404).toContain('DEFAULT_LOCALE');
    expect(catchAll).toContain('notFound()');
    expect(catalog404).toContain('NotFoundPanel');
    expect(catalog404).not.toContain('SiteHeader');
    expect(dashboard404).toContain('cabinet-page');
    expect(dashboard404).not.toContain('SiteHeader');

    const panel = readWeb('components/NotFoundPanel.tsx');
    expect(panel).toContain("href=\"/\"");
    expect(panel).toContain("href=\"/catalog\"");
    expect(panel).toContain("href=\"/requests\"");
    expect(panel).toContain("from '@/i18n/navigation'");
    expect(panel).not.toMatch(/stack|digest|debug/i);
  });

  it('localizes 404 and empty-state copy in every locale without RFQ wording', () => {
    expect(read(messages('en'), 'notFound.title')).toBe('Page not found');
    expect(read(messages('ru'), 'notFound.title')).toBe('Страница не найдена');
    expect(read(messages('ru'), 'purchaseRequests.mineEmptyTitle').toLowerCase()).toContain('запрос');
    expect(read(messages('ru'), 'purchaseRequests.myQuotesEmptyTitle').toLowerCase()).toContain('предложен');

    for (const locale of LOCALES) {
      for (const key of KEYS) {
        expect(read(messages(locale), key).trim().length).toBeGreaterThan(0);
      }
      const haystack = KEYS.map((key) => read(messages(locale), key)).join('\n').toLowerCase();
      expect(haystack).not.toMatch(/\brfq\b/);
      expect(haystack).not.toContain('quotation');
      expect(haystack).not.toContain('котиров');
    }
  });

  it('gives catalog and purchase-request empty results a next action', () => {
    const catalog = readWeb('app/[locale]/catalog/page.tsx');
    const board = readWeb('app/[locale]/requests/page.tsx');
    const mine = readWeb('app/[locale]/dashboard/purchase-requests/page.tsx');
    const quotes = readWeb('app/[locale]/dashboard/quotes/page.tsx');
    const products = readWeb('app/[locale]/dashboard/products/page.tsx');

    expect(catalog).toContain('EmptyState');
    expect(catalog).toContain('hasFilters');
    expect(catalog).toContain("href=\"/requests/new\"");
    expect(board).toContain('EmptyState');
    expect(board).toContain('boardEmptyFiltered');
    expect(mine).toContain('mineEmptyTitle');
    expect(mine).toContain("href=\"/requests/new\"");
    expect(quotes).toContain('myQuotesEmptyTitle');
    expect(quotes).toContain("href=\"/requests\"");
    expect(quotes).toContain('EmptyState');
    expect(products).toContain('EmptyState');
    expect(products).toContain('emptyPublishedTitle');
    expect(products).toContain("href=\"/dashboard/products/new\"");
  });
});

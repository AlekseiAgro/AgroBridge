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

const MINE_PAGE = 'app/[locale]/dashboard/purchase-requests/page.tsx';
const QUOTES_PAGE = 'app/[locale]/dashboard/quotes/page.tsx';

describe('My Purchase Requests page chrome', () => {
  it('does not use My Quotes as the purchase-requests eyebrow', () => {
    const page = source(MINE_PAGE);
    expect(page).toContain("<h1>{t('mineTitle')}</h1>");
    expect(page).toContain("t('mineSubtitle')");
    expect(page).toContain("t('boardTitle')");
    expect(page).toContain("t('createCta')");
    expect(page).not.toContain("t('myQuotesTitle')");
    expect(page).not.toContain('/dashboard/quotes');
    expect(page).not.toContain("forBuyers");
    expect(page).not.toContain("forSellers");
    expect(page).toMatch(
      /<Link href="\/requests">\{t\('boardTitle'\)\}<\/Link>\s*\{\s*' · '\s*\}\s*\{t\('mineTitle'\)\}/,
    );
  });

  it('keeps catalog navigation as an RFQ-section action, not page identity', () => {
    const page = source(MINE_PAGE);
    const eyebrow = page.slice(
      page.indexOf('className="eyebrow"'),
      page.indexOf('PurchaseRequestList'),
    );
    expect(eyebrow).not.toContain('/catalog');
    expect(eyebrow).not.toContain('browseCatalog');

    const rfqSection = page.slice(page.indexOf('id="my-requests"'));
    expect(rfqSection).toContain("t('productRfqsLink')");
    expect(rfqSection).toContain("tr('mineSubtitle')");
    expect(rfqSection).toContain('href="/catalog"');
    expect(rfqSection).toContain("tr('browseCatalog')");
    expect(rfqSection).toContain('detailBasePath="/dashboard/rfqs"');
  });

  it('preserves compact purchase-request list markup and empty actions', () => {
    const page = source(MINE_PAGE);
    const list = source('components/PurchaseRequestList.tsx');
    expect(page).toContain('PurchaseRequestList');
    expect(page).toContain('mineEmptyTitle');
    expect(page).toContain('href="/requests/new"');
    expect(list).toContain('product-list__item--row');
    expect(list).toContain("t('view')");
  });

  it('leaves My Quotes chrome from #155 unchanged', () => {
    const page = source(QUOTES_PAGE);
    expect(page).toContain("<h1>{t('myQuotesTitle')}</h1>");
    expect(page).toContain("t('browseBoard')");
    expect(page).not.toContain("t('mineTitle')");
    expect(page).not.toContain('/dashboard/purchase-requests');
    expect(page).toMatch(
      /<Link href="\/requests">\{t\('boardTitle'\)\}<\/Link>\s*\{\s*' · '\s*\}\s*\{t\('myQuotesTitle'\)\}/,
    );
  });

  it('keeps product RFQ copy distinct from My Purchase Requests in every locale', () => {
    expect(read(messages('en'), 'purchaseRequests.mineTitle')).toBe('My purchase requests');
    expect(read(messages('en'), 'purchaseRequests.boardTitle')).toBe('Purchase requests');
    expect(read(messages('en'), 'purchaseRequests.productRfqsLink')).toBe(
      'Product quote requests',
    );
    expect(read(messages('en'), 'rfq.mineSubtitle').toLowerCase()).toContain('catalog');
    expect(read(messages('ru'), 'purchaseRequests.mineTitle')).toBe('Мои запросы на покупку');
    expect(read(messages('ru'), 'purchaseRequests.mineSubtitle')).toBe(
      'Запросы на покупку, которые вы опубликовали.',
    );
    expect(read(messages('ru'), 'purchaseRequests.productRfqsLink')).toBe(
      'Запросы предложений по товарам',
    );
    expect(read(messages('ru'), 'rfq.mineSubtitle')).toBe(
      'Запросы предложений по конкретным товарам каталога.',
    );

    for (const locale of LOCALES) {
      const board = read(messages(locale), 'purchaseRequests.boardTitle');
      const mine = read(messages(locale), 'purchaseRequests.mineTitle');
      const mineSubtitle = read(messages(locale), 'purchaseRequests.mineSubtitle');
      const quotes = read(messages(locale), 'purchaseRequests.myQuotesTitle');
      const rfqHeading = read(messages(locale), 'purchaseRequests.productRfqsLink');
      const rfqSubtitle = read(messages(locale), 'rfq.mineSubtitle');
      const browseCatalog = read(messages(locale), 'rfq.browseCatalog');

      expect(board.trim().length).toBeGreaterThan(0);
      expect(mine.trim().length).toBeGreaterThan(0);
      expect(mineSubtitle.trim().length).toBeGreaterThan(0);
      expect(quotes.trim().length).toBeGreaterThan(0);
      expect(rfqHeading.trim().length).toBeGreaterThan(0);
      expect(rfqSubtitle.trim().length).toBeGreaterThan(0);
      expect(browseCatalog.trim().length).toBeGreaterThan(0);
      expect(mine).not.toBe(quotes);
      expect(mine).not.toBe(rfqHeading);
      expect(mineSubtitle).not.toBe(rfqSubtitle);

      const haystack = [board, mine, mineSubtitle, quotes, rfqHeading, rfqSubtitle, browseCatalog]
        .join('\n')
        .toLowerCase();
      expect(haystack).not.toContain('котиров');
      expect(haystack).not.toContain('quotation');
      expect(haystack).not.toMatch(/\brfq\b/);
    }

    for (const locale of LOCALES) {
      if (locale === 'en') continue;
      expect(read(messages(locale), 'purchaseRequests.mineTitle')).not.toBe(
        'My purchase requests',
      );
      expect(read(messages(locale), 'purchaseRequests.productRfqsLink')).not.toBe(
        'Product quote requests',
      );
    }
  });
});

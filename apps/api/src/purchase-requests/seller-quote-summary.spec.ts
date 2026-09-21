import { readFileSync } from 'fs';
import { join } from 'path';
import {
  formatQuotePrice,
  formatQuoteQuantity,
  quoteStatusBadgeClass,
  sellerQuoteActions,
} from '../../../web/src/lib/quote-card-presentation';

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

const COPY_KEYS = [
  'purchaseRequests.yourQuote',
  'purchaseRequests.quotedQuantity',
  'purchaseRequests.sentAt',
  'purchaseRequests.quoteStatuses.pending',
  'purchaseRequests.quoteStatuses.accepted',
  'purchaseRequests.quoteStatuses.declined',
  'purchaseRequests.quoteStatuses.withdrawn',
  'purchaseRequests.quoteStatusHints.pending',
  'purchaseRequests.quoteStatusHints.accepted',
  'purchaseRequests.quoteStatusHints.declined',
  'purchaseRequests.quoteStatusHints.withdrawn',
  'purchaseRequests.messageBuyer',
  'purchaseRequests.actions.withdraw',
] as const;

describe('seller quote summary on purchase request detail', () => {
  it('restores the compact pre-#153 My Quotes list markup', () => {
    const list = readWeb('components/PurchaseQuoteList.tsx');
    expect(list).toContain('product-list__item--row');
    expect(list).toContain('product-list__item-main');
    expect(list).toContain('item.priceAmount');
    expect(list).toContain('item.currency');
    expect(list).toContain("t(`quoteStatuses.${item.status}`)");
    expect(list).toContain("t('openRequest')");
    expect(list).not.toContain('quote-list');
    expect(list).not.toContain('OpenChatButton');
    expect(list).not.toContain('PurchaseRequestActionButton');
    expect(list).not.toContain('quoteStatusHints');
  });

  it('does not show the My Quotes empty state when the API failed', () => {
    const page = readWeb('app/[locale]/dashboard/quotes/page.tsx');
    expect(page).toContain('myQuotesLoadError');
    expect(page).toMatch(
      /loadError \? \(\s*<p className="form-error">\{loadError\}<\/p>\s*\) : \(/,
    );
    const errorBranch = page.slice(page.indexOf('{loadError ? ('));
    expect(errorBranch.indexOf('PurchaseQuoteList')).toBeGreaterThan(-1);
    expect(errorBranch.indexOf('EmptyState')).toBeGreaterThan(
      errorBranch.indexOf('PurchaseQuoteList'),
    );
    expect(page).not.toContain("href=\"/catalog\"");
  });

  it('renders stored price and currency without converting them', () => {
    expect(formatQuotePrice('3.00', 'GEL')).toBe('3.00 GEL');
    expect(formatQuotePrice('12.50', 'USD')).toBe('12.50 USD');

    const summary = readWeb('components/SellerQuoteSummary.tsx');
    expect(summary).toContain('formatQuotePrice(quote.priceAmount, quote.currency)');
    expect(summary).toContain('seller-quote__price');
    expect(summary).not.toMatch(/exchange|fx|convert/i);
  });

  it('shows quote quantity and created date only when the detail payload already has them', () => {
    expect(formatQuoteQuantity('100', 'kg')).toBe('100 kg');
    expect(formatQuoteQuantity(null, 'kg')).toBeNull();

    const summary = readWeb('components/SellerQuoteSummary.tsx');
    expect(summary).toContain('quotedQuantity');
    expect(summary).toContain('quote.quantity');
    expect(summary).toContain('quote.createdAt');
    expect(summary).toContain('sentAt');
  });

  it('exposes only already-legal seller actions', () => {
    expect(
      sellerQuoteActions({ canMessageBuyer: true, canWithdraw: true }),
    ).toEqual({ showMessageBuyer: true, showWithdraw: true });
    expect(
      sellerQuoteActions({ canMessageBuyer: true, canWithdraw: false }),
    ).toEqual({ showMessageBuyer: true, showWithdraw: false });
    expect(
      sellerQuoteActions({ canMessageBuyer: false, canWithdraw: false }),
    ).toEqual({ showMessageBuyer: false, showWithdraw: false });

    const summary = readWeb('components/SellerQuoteSummary.tsx');
    expect(summary).toContain("label={t('messageBuyer')}");
    expect(summary).toContain('variant="primary"');
    expect(summary).toContain('action="withdraw"');
    expect(summary).toContain('variant="danger-quiet"');
    expect(summary).not.toContain('action="accept"');
    expect(summary).not.toContain('action="decline"');

    const detail = readWeb('app/[locale]/requests/[id]/page.tsx');
    expect(detail).toContain('SellerQuoteSummary');
    expect(detail).toContain('canMessageBuyer={request.canMessageBuyer}');
    expect(detail).toContain('canMessageBuyer && !request.myQuote');
  });

  it('renders existing quote statuses with harvest-badge language', () => {
    expect(quoteStatusBadgeClass('pending')).toBe(
      'harvest-badge quote-status quote-status--pending',
    );
    const summary = readWeb('components/SellerQuoteSummary.tsx');
    expect(summary).toContain('quoteStatuses.${quote.status}');
    expect(summary).toContain('quoteStatusHints.${quote.status}');
    expect(summary).toContain('data-quote-status={quote.status}');
  });

  it('keeps withdraw confirmation behavior unchanged', () => {
    const button = readWeb('components/PurchaseRequestActionButton.tsx');
    expect(button).toContain('danger-quiet');
    expect(button).toContain('resolvePurchaseRequestActionRequest');
    expect(button).not.toContain('confirm.withdraw');

    const action = readWeb('lib/purchase-request-action.ts');
    expect(action).not.toMatch(/CONFIRMED_PURCHASE_REQUEST_ACTIONS = \[[^\]]*withdraw/);
    expect(action).toContain("'withdraw'");
  });

  it('localizes the seller quote summary without котировка or RFQ', () => {
    expect(read(messages('en'), 'purchaseRequests.yourQuote')).toBe('Your quote');
    expect(read(messages('ru'), 'purchaseRequests.yourQuote')).toBe('Ваше предложение');
    expect(read(messages('en'), 'purchaseRequests.quoteStatusHints.pending')).toBe(
      'Awaiting buyer decision',
    );

    for (const locale of LOCALES) {
      for (const key of COPY_KEYS) {
        expect(read(messages(locale), key).trim().length).toBeGreaterThan(0);
      }
      expect(read(messages(locale), 'purchaseRequests.sentAt')).toContain('{date}');
      const haystack = COPY_KEYS.map((key) => read(messages(locale), key)).join('\n').toLowerCase();
      expect(haystack).not.toMatch(/\brfq\b/);
      expect(haystack).not.toContain('котиров');
      expect(haystack).not.toContain('quotation');
    }

    const ru = COPY_KEYS.map((key) => read(messages('ru'), key)).join('\n');
    expect(ru.toLowerCase()).toContain('предложен');
    expect(ru).not.toContain('котиров');
  });

  it('uses a compact existing-card layout without leftover list redesign CSS', () => {
    const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
    const summary = readWeb('components/SellerQuoteSummary.tsx');
    expect(summary).toContain('product-list__item');
    expect(summary).toContain('seller-quote__card');
    expect(css).toContain('.seller-quote__card');
    expect(css).toContain('.quote-status--pending');
    expect(css).not.toContain('.quote-list__item');
    expect(css).not.toContain('.quote-list__price-label');
    expect(css).not.toMatch(/linear-gradient.*quote/);
  });

  it('does not change quote lifecycle, API contracts, or dual-capability architecture', () => {
    const list = readWeb('components/PurchaseQuoteList.tsx');
    const detail = readWeb('app/[locale]/requests/[id]/page.tsx');
    const shared = readFileSync(
      join(__dirname, '../../../../packages/shared/src/purchase-request.ts'),
      'utf8',
    );

    expect(list).not.toContain('canAccept');
    expect(detail).toContain("apiRequest<PurchaseRequestDetail>(`/purchase-requests/${id}`");
    expect(detail).not.toContain('createPurchaseQuote');
    expect(shared).toContain("'pending', 'accepted', 'declined', 'withdrawn'");
    expect(shared).toContain('canWithdraw: boolean');
    expect(shared).toContain('canMessageBuyer: boolean');
  });
});

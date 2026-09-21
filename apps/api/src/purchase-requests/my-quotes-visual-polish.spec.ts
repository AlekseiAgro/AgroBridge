import { readFileSync } from 'fs';
import { join } from 'path';
import {
  formatQuotePrice,
  formatQuoteQuantity,
  quoteCardActions,
  quoteStatusBadgeClass,
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
  'purchaseRequests.myQuotesTitle',
  'purchaseRequests.myQuotesSubtitle',
  'purchaseRequests.myQuotesEmpty',
  'purchaseRequests.myQuotesEmptyTitle',
  'purchaseRequests.myQuotesLoadError',
  'purchaseRequests.quotedQuantity',
  'purchaseRequests.requestedQuantity',
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
  'purchaseRequests.openRequest',
  'purchaseRequests.actions.withdraw',
  'purchaseRequests.requestUnavailable',
] as const;

describe('My Quotes visual polish', () => {
  it('renders stored price and currency without converting them', () => {
    expect(formatQuotePrice('12.50', 'GEL')).toBe('12.50 GEL');
    expect(formatQuotePrice('1000.00', 'USD')).toBe('1000.00 USD');
    expect(formatQuotePrice('8.00', 'EUR')).toBe('8.00 EUR');

    const list = readWeb('components/PurchaseQuoteList.tsx');
    expect(list).toContain('formatQuotePrice(item.priceAmount, item.currency)');
    expect(list).toContain('product-list__price');
    expect(list).toContain('quote-list__price');
    expect(list).not.toMatch(/exchange|fx|convert/i);
  });

  it('shows offered and requested quantity when the payload already has them', () => {
    expect(formatQuoteQuantity('200', 'kg')).toBe('200 kg');
    expect(formatQuoteQuantity('1t', null)).toBe('1t');
    expect(formatQuoteQuantity(null, 'kg')).toBeNull();

    const list = readWeb('components/PurchaseQuoteList.tsx');
    expect(list).toContain('quotedQuantity');
    expect(list).toContain('requestedQuantity');
    expect(list).toContain('item.quantity');
    expect(list).toContain('item.request.quantity');
  });

  it('exposes only already-legal actions per quote flags', () => {
    expect(
      quoteCardActions({ canOpenRequest: true, canWithdraw: true }),
    ).toEqual({
      showMessageBuyer: true,
      showOpenRequest: true,
      showWithdraw: true,
    });
    expect(
      quoteCardActions({ canOpenRequest: true, canWithdraw: false }),
    ).toEqual({
      showMessageBuyer: true,
      showOpenRequest: true,
      showWithdraw: false,
    });
    expect(
      quoteCardActions({ canOpenRequest: false, canWithdraw: false }),
    ).toEqual({
      showMessageBuyer: false,
      showOpenRequest: false,
      showWithdraw: false,
    });

    const list = readWeb('components/PurchaseQuoteList.tsx');
    expect(list).toContain('quoteCardActions(item)');
    expect(list).toContain('showMessageBuyer');
    expect(list).toContain("label={t('messageBuyer')}");
    expect(list).toContain('variant="primary"');
    expect(list).toContain("action=\"withdraw\"");
    expect(list).toContain('variant="danger-quiet"');
    expect(list).not.toContain("action=\"accept\"");
    expect(list).not.toContain("action=\"decline\"");
  });

  it('renders existing quote statuses with the harvest-badge visual language', () => {
    expect(quoteStatusBadgeClass('pending')).toBe(
      'harvest-badge quote-status quote-status--pending',
    );
    expect(quoteStatusBadgeClass('accepted')).toContain('quote-status--accepted');
    expect(quoteStatusBadgeClass('declined')).toContain('quote-status--declined');
    expect(quoteStatusBadgeClass('withdrawn')).toContain('quote-status--withdrawn');

    const list = readWeb('components/PurchaseQuoteList.tsx');
    expect(list).toContain('quoteStatuses.${item.status}');
    expect(list).toContain('quoteStatusHints.${item.status}');
    expect(list).toContain('data-quote-status={item.status}');
    expect(list).toContain('item.createdAt');
    expect(list).toContain('item.request.title');
  });

  it('does not show the empty state when My Quotes failed to load', () => {
    const page = readWeb('app/[locale]/dashboard/quotes/page.tsx');
    expect(page).toContain('myQuotesLoadError');
    expect(page).toContain('form-error');
    expect(page).toContain('EmptyState');
    expect(page).toMatch(
      /loadError \? \(\s*<p className="form-error">\{loadError\}<\/p>\s*\) : \(/,
    );
    expect(page).toContain('<PurchaseQuoteList');
    const errorBranch = page.slice(page.indexOf('{loadError ? ('));
    const emptyIdx = errorBranch.indexOf('EmptyState');
    const listIdx = errorBranch.indexOf('PurchaseQuoteList');
    expect(listIdx).toBeGreaterThan(-1);
    expect(emptyIdx).toBeGreaterThan(listIdx);
  });

  it('keeps withdraw confirmation behavior unchanged', () => {
    const button = readWeb('components/PurchaseRequestActionButton.tsx');
    expect(button).toContain('danger-quiet');
    expect(button).toContain('resolvePurchaseRequestActionRequest');
    expect(button).not.toContain("confirm.withdraw");

    const action = readWeb('lib/purchase-request-action.ts');
    expect(action).toContain("'accept'");
    expect(action).toContain("'withdraw'");
    expect(action).not.toMatch(/CONFIRMED_PURCHASE_REQUEST_ACTIONS = \[[^\]]*withdraw/);
  });

  it('localizes My Quotes chrome in every locale without котировка or RFQ', () => {
    expect(read(messages('en'), 'purchaseRequests.myQuotesTitle')).toBe('My quotes');
    expect(read(messages('ru'), 'purchaseRequests.myQuotesTitle')).toBe('Мои предложения');
    expect(read(messages('en'), 'purchaseRequests.quoteStatusHints.pending')).toBe(
      'Awaiting buyer decision',
    );
    expect(read(messages('en'), 'purchaseRequests.myQuotesEmpty').toLowerCase()).toContain(
      'appear here',
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

  it('uses responsive-safe quote card markup and existing AgroBridge classes', () => {
    const list = readWeb('components/PurchaseQuoteList.tsx');
    const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');

    expect(list).toContain('product-list');
    expect(list).toContain('product-list__item-body');
    expect(list).toContain('quote-list__actions');
    expect(list).toContain('quote-list__item');
    expect(css).toContain('.quote-list__item');
    expect(css).toContain('overflow-wrap: anywhere');
    expect(css).toContain('flex-wrap: wrap');
    expect(css).toContain('@media (max-width: 768px)');
    expect(css).toContain('.quote-list__actions');
    expect(css).not.toMatch(/linear-gradient.*quote/);
  });

  it('does not change quote lifecycle, API contracts, or dual-capability architecture', () => {
    const page = readWeb('app/[locale]/dashboard/quotes/page.tsx');
    const list = readWeb('components/PurchaseQuoteList.tsx');
    const shared = readFileSync(
      join(__dirname, '../../../packages/shared/src/purchase-request.ts'),
      'utf8',
    );

    expect(page).toContain("apiRequestAuthed<PurchaseQuoteMineItem[]>('/purchase-requests/my-quotes')");
    expect(page).toContain("href=\"/dashboard/purchase-requests\"");
    expect(page).not.toContain('createPurchaseQuote');
    expect(list).not.toContain('canAccept');
    expect(shared).toContain("'pending', 'accepted', 'declined', 'withdrawn'");
    expect(shared).toContain('priceAmount: string');
    expect(shared).toContain('canWithdraw: boolean');
  });
});

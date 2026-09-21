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

function flattenStrings(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [`${prefix}:${value}`];
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value as Nested).flatMap(([key, child]) =>
    flattenStrings(child, prefix ? `${prefix}.${key}` : key),
  );
}

function source(relative: string): string {
  return readFileSync(join(WEB, 'src', relative), 'utf8');
}

describe('dual-capability and quote terminology', () => {
  it('does not tell users to log in as a buyer', () => {
    expect(read(messages('en'), 'rfq.loginToRequest')).toBe('Log in to request a quote');
    expect(read(messages('ru'), 'rfq.loginToRequest')).toBe(
      'Войдите, чтобы запросить предложение',
    );

    const roleLogin = [
      'log in as a buyer',
      'sign in as a buyer',
      'login as buyer',
      'войдите как покупатель',
      'als käufer an',
      'en tant qu’acheteur',
      'en tant qu\'acheteur',
      'come acquirente',
      'como comprador',
      'შედით მყიდველად',
    ];

    for (const locale of LOCALES) {
      const login = read(messages(locale), 'rfq.loginToRequest').toLowerCase();
      for (const phrase of roleLogin) {
        expect(login).not.toContain(phrase);
      }
      expect(read(messages(locale), 'rfq.loginToRequest').trim().length).toBeGreaterThan(0);
    }
  });

  it('describes the product action as requesting a quote, not creating a purchase request', () => {
    expect(read(messages('en'), 'rfq.requestTitle')).toBe('Request a quote');
    expect(read(messages('en'), 'rfq.submitRequest')).toBe('Request a quote');
    expect(read(messages('ru'), 'rfq.requestTitle')).toBe('Запросить предложение');
    expect(read(messages('ru'), 'rfq.submitRequest')).toBe('Запросить предложение');

    const productPage = source('app/[locale]/products/[id]/page.tsx');
    expect(productPage).toContain("tr('submitRequest')");
    expect(productPage).toContain("tr('loginToRequest')");
    expect(productPage).not.toContain("t('createTitle')");
    expect(productPage).not.toContain('Create Purchase Request');

    for (const locale of LOCALES) {
      const title = read(messages(locale), 'rfq.requestTitle').toLowerCase();
      const submit = read(messages(locale), 'rfq.submitRequest').toLowerCase();
      expect(title).not.toContain('purchase request');
      expect(submit).not.toContain('purchase request');
      expect(title).not.toContain('запрос на покупку');
      expect(submit).not.toContain('запрос на покупку');
    }
  });

  it('keeps product quote requests distinct from My Purchase Requests', () => {
    const page = source('app/[locale]/dashboard/purchase-requests/page.tsx');
    expect(page).toContain("t('mineTitle')");
    expect(page).toContain("t('productRfqsLink')");
    expect(page).toContain("tr('mineSubtitle')");
    expect(page).not.toContain("tn('myRequests')");
    expect(read(messages('en'), 'purchaseRequests.mineTitle')).toBe('My purchase requests');
    expect(read(messages('en'), 'purchaseRequests.productRfqsLink')).toBe(
      'Product quote requests',
    );
    expect(read(messages('en'), 'rfq.mineSubtitle').toLowerCase()).toContain('catalog');
    expect(read(messages('ru'), 'purchaseRequests.mineTitle')).toBe('Мои запросы на покупку');
  });

  it('uses Quote / Предложение for My Quotes and does not say котировка', () => {
    expect(read(messages('en'), 'purchaseRequests.myQuotesTitle')).toBe('My quotes');
    expect(read(messages('en'), 'purchaseRequests.myQuotesSubtitle').toLowerCase()).toContain(
      'quote',
    );
    expect(read(messages('en'), 'purchaseRequests.myQuotesSubtitle').toLowerCase()).not.toContain(
      'offer',
    );
    expect(read(messages('ru'), 'purchaseRequests.myQuotesTitle')).toBe('Мои предложения');

    const ruHaystack = flattenStrings(messages('ru'))
      .map((entry) => entry.split(':').slice(1).join(':'))
      .join('\n')
      .toLowerCase();
    expect(ruHaystack).toContain('запрос на покупку');
    expect(ruHaystack).toContain('предложен');
    expect(ruHaystack).not.toContain('котиров');
  });

  it('removes user-facing RFQ acronyms from marketplace copy', () => {
    for (const locale of LOCALES) {
      const entries = flattenStrings(messages(locale));
      for (const entry of entries) {
        expect(entry).not.toMatch(/\bRFQ\b/);
      }
    }

    expect(read(messages('en'), 'admin.deals.kinds.rfq')).toBe('Product quote request');
    expect(read(messages('en'), 'rfq.offerSummary')).toContain('Quote:');
    expect(read(messages('en'), 'rfq.statuses.offered')).toBe('Quote received');
    expect(read(messages('en'), 'rfq.actions.accept')).toBe('Accept quote');
  });

  it('keeps registration dual-capability copy and does not imply exclusive accounts', () => {
    expect(read(messages('en'), 'auth.dualCapabilityHint').toLowerCase()).toContain(
      'one account',
    );
    expect(read(messages('ru'), 'auth.dualCapabilityHint')).toContain('Один аккаунт');
    expect(read(messages('en'), 'auth.loginSubtitle').toLowerCase()).not.toContain('as a buyer');
    expect(read(messages('en'), 'auth.loginSubtitle').toLowerCase()).not.toContain('as a farmer');
    expect(read(messages('en'), 'purchaseRequests.buyerOnly').toLowerCase()).toContain(
      'buy and sell',
    );

    for (const locale of LOCALES) {
      expect(read(messages(locale), 'auth.dualCapabilityHint').trim().length).toBeGreaterThan(0);
      expect(read(messages(locale), 'auth.registerSubtitle').trim().length).toBeGreaterThan(0);
      const registerAs = read(messages(locale), 'purchaseRequests.registerAsBuyer').toLowerCase();
      expect(registerAs).not.toContain('as a buyer');
      expect(registerAs).not.toContain('как покупатель');
    }
  });

  it('keeps accepted quotes distinct from a completed transaction', () => {
    expect(read(messages('en'), 'purchaseRequests.agreementTitle')).toBe('Agreement reached');
    const body = read(messages('en'), 'purchaseRequests.agreementBody').toLowerCase();
    expect(body).not.toContain('purchase completed');
    expect(body).not.toContain('deal completed');
    expect(body).not.toContain('transaction completed');
    expect(read(messages('en'), 'purchaseRequests.confirm.accept').toLowerCase()).toContain(
      'does not complete payment',
    );
  });

  it.each(LOCALES)('%s localizes quote-request chrome without English leakage', (locale) => {
    const keys = [
      'rfq.loginToRequest',
      'rfq.requestTitle',
      'rfq.submitRequest',
      'rfq.mineTitle',
      'purchaseRequests.mineTitle',
      'purchaseRequests.myQuotesTitle',
      'purchaseRequests.productRfqsLink',
      'admin.deals.kinds.rfq',
    ] as const;
    for (const key of keys) {
      expect(read(messages(locale), key).trim().length).toBeGreaterThan(0);
    }
    if (locale !== 'en') {
      expect(read(messages(locale), 'rfq.loginToRequest')).not.toBe('Log in to request a quote');
      expect(read(messages(locale), 'rfq.submitRequest')).not.toBe('Request a quote');
      expect(read(messages(locale), 'admin.deals.kinds.rfq')).not.toBe('Product RFQ');
    }
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';

const LOCALES = ['en', 'ru', 'ka', 'de', 'fr', 'it', 'es'] as const;
const WEB = join(__dirname, '../../../web');

function readWeb(path: string) {
  return readFileSync(join(WEB, 'src', path), 'utf8');
}

function messages(locale: string) {
  return JSON.parse(readFileSync(join(WEB, 'messages', `${locale}.json`), 'utf8')) as {
    cabinet: { loadError: string; deals: { loadError: string; empty: string } };
    rfq: { loadError: string; inboxEmpty: string; mineEmpty: string };
    purchaseRequests: { loadError: string; mineEmpty: string };
  };
}

const ERROR_TERNARY =
  /loadError \? \(\s*<p className="form-error">\{loadError\}<\/p>\s*\) : \(/;

describe('cabinet inline load errors', () => {
  const account = readWeb('app/[locale]/account/page.tsx');
  const inbox = readWeb('app/[locale]/dashboard/inbox/page.tsx');
  const rfqs = readWeb('app/[locale]/dashboard/rfqs/page.tsx');
  const deals = readWeb('app/[locale]/dashboard/deals/page.tsx');
  const mine = readWeb('app/[locale]/dashboard/purchase-requests/page.tsx');

  it('keeps Account shell and hides activity cards when overview fails', () => {
    expect(account).toContain("t('loadError')");
    expect(account).toContain('className="form-error"');
    expect(account).toContain('if (loadError || !overview)');
    const errorReturn = account.slice(
      account.indexOf('if (loadError || !overview)'),
      account.indexOf('const { user, activity'),
    );
    expect(errorReturn).toContain('form-error');
    expect(errorReturn).not.toContain('user-card');
    expect(errorReturn).not.toContain('activity-summary');
    expect(account).toContain('className="user-card"');
    expect(account).toContain('className="activity-summary"');
  });

  it('shows a Product RFQ Inbox load error instead of inboxEmpty', () => {
    expect(inbox).toMatch(ERROR_TERNARY);
    expect(inbox).toContain("t('loadError')");
    const errorBranch = inbox.slice(inbox.indexOf('{loadError ? ('));
    expect(errorBranch.indexOf('RfqList')).toBeGreaterThan(errorBranch.indexOf('form-error'));
    expect(inbox).toContain("emptyLabel={t('inboxEmpty')}");
  });

  it('shows an RFQs load error instead of mineEmpty', () => {
    expect(rfqs).toMatch(ERROR_TERNARY);
    expect(rfqs).toContain("t('loadError')");
    const errorBranch = rfqs.slice(rfqs.indexOf('{loadError ? ('));
    expect(errorBranch.indexOf('RfqList')).toBeGreaterThan(errorBranch.indexOf('form-error'));
    expect(rfqs).toContain("emptyLabel={t('mineEmpty')}");
  });

  it('shows a Deals load error instead of deals.empty', () => {
    expect(deals).toMatch(ERROR_TERNARY);
    expect(deals).toContain("t('deals.loadError')");
    const errorBranch = deals.slice(deals.indexOf('{loadError ? ('));
    expect(errorBranch.indexOf('CompletedDealsList')).toBeGreaterThan(
      errorBranch.indexOf('form-error'),
    );
    expect(deals).toContain("emptyLabel={t('deals.empty')}");
  });

  it('shows a Purchase Requests load error instead of mine empty states', () => {
    expect(mine).toMatch(ERROR_TERNARY);
    expect(mine).toContain("t('loadError')");
    expect(mine).toContain('{loadError ? null : <MarkSectionNotificationsRead');
    const errorBranch = mine.slice(mine.indexOf('{loadError ? ('));
    expect(errorBranch.indexOf('PurchaseRequestList')).toBeGreaterThan(
      errorBranch.indexOf('form-error'),
    );
    expect(errorBranch.indexOf('EmptyState')).toBeGreaterThan(
      errorBranch.indexOf('PurchaseRequestList'),
    );
    expect(mine).toContain("title={t('mineEmptyTitle')}");
    expect(mine).toContain("emptyLabel={tr('mineEmpty')}");
  });

  it('localizes cabinet and RFQ load errors in every locale without English leftovers', () => {
    const en = messages('en');
    expect(en.cabinet.loadError).toBe('Could not load your cabinet.');
    expect(en.cabinet.deals.loadError).toBe('Could not load completed deals.');
    expect(en.rfq.loadError).toBe('Could not load quote requests.');
    expect(en.purchaseRequests.loadError).toContain('purchase requests');

    for (const locale of LOCALES) {
      const data = messages(locale);
      for (const value of [
        data.cabinet.loadError,
        data.cabinet.deals.loadError,
        data.rfq.loadError,
        data.purchaseRequests.loadError,
      ]) {
        expect(value.trim().length).toBeGreaterThan(0);
      }
      if (locale === 'en') continue;
      expect(data.cabinet.loadError).not.toBe(en.cabinet.loadError);
      expect(data.cabinet.deals.loadError).not.toBe(en.cabinet.deals.loadError);
      expect(data.rfq.loadError).not.toBe(en.rfq.loadError);
      expect(data.purchaseRequests.loadError).not.toBe(en.purchaseRequests.loadError);
    }
  });
});

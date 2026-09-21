import { readFileSync } from 'fs';
import { join } from 'path';
import type { RfqSummary } from '@agrobridge/shared';
import { filterRfqsForCabinet } from '../../../web/src/lib/rfq-cabinet-filters';

const WEB = join(__dirname, '../../../web/src');

function readWeb(path: string) {
  return readFileSync(join(WEB, path), 'utf8');
}

function deal(overrides: Partial<RfqSummary> & Pick<RfqSummary, 'id' | 'canRate'>): RfqSummary {
  return {
    status: 'completed',
    quantity: '10',
    unit: 'kg',
    message: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
    completedAt: '2026-01-02T00:00:00.000Z',
    product: { id: 'p1', title: 'Hazelnuts' },
    farm: null,
    buyer: { id: 'buyer_1', displayName: 'Buyer', email: 'buyer@example.com' },
    seller: { id: 'seller_1', displayName: 'Seller', email: 'seller@example.com' },
    offer: null,
    canComplete: false,
    myRating: null,
    counterpartyRating: null,
    ...overrides,
  };
}

describe('awaiting rating account card', () => {
  const account = readWeb('app/[locale]/account/page.tsx');
  const deals = readWeb('app/[locale]/dashboard/deals/page.tsx');

  it('sends every marketplace role to Deals, not Product RFQ inbox', () => {
    expect(account).toContain("key: 'awaitingMyRating'");
    expect(account).toContain('activity.awaitingMyRating');
    expect(account).toContain("href: '/dashboard/deals?needsRating=1'");
    expect(account).not.toContain("user.role === 'farmer' ? '/dashboard/inbox'");
    expect(account).not.toContain('/dashboard/inbox');
    expect(account).not.toContain("dealsBase");
  });

  it('filters completed deals to those the current user can rate', () => {
    expect(deals).toContain('filterRfqsForCabinet');
    expect(deals).toContain("'/rfqs/completed'");
    expect(deals).toContain('needsRating');
    expect(deals).toContain('<CompletedDealsList');
    expect(readWeb('components/CompletedDealsList.tsx')).toContain('item.canRate');
    expect(readWeb('components/CompletedDealsList.tsx')).toContain('<RateDealForm');

    const buyerPending = deal({ id: 'buyer', canRate: true, buyer: { id: 'me', displayName: 'Me', email: 'me@x' } });
    const sellerPending = deal({ id: 'seller', canRate: true, seller: { id: 'me', displayName: 'Me', email: 'me@x' } });
    const alreadyRated = deal({
      id: 'rated',
      canRate: false,
      myRating: { score: 5, comment: null, createdAt: '2026-01-03T00:00:00.000Z' },
    });
    const open = deal({ id: 'open', canRate: false, status: 'accepted' });

    const filtered = filterRfqsForCabinet(
      [buyerPending, sellerPending, alreadyRated, open],
      { needsRating: '1' },
    );

    expect(filtered.map((item) => item.id)).toEqual(['buyer', 'seller']);
    expect(filtered.every((item) => item.canRate)).toBe(true);
  });

  it('keeps the card at zero and leaves the unfiltered deals list intact', () => {
    expect(account).toContain("key: 'awaitingMyRating'");
    expect(filterRfqsForCabinet([], { needsRating: '1' })).toEqual([]);
    expect(
      filterRfqsForCabinet([deal({ id: 'rated', canRate: false })], { needsRating: '1' }),
    ).toEqual([]);

    const allCompleted = [
      deal({ id: 'needs', canRate: true }),
      deal({ id: 'done', canRate: false }),
    ];
    expect(filterRfqsForCabinet(allCompleted, {}).map((item) => item.id)).toEqual([
      'needs',
      'done',
    ]);
  });
});

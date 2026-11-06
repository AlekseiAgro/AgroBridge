import { conversationIdFromCreate, parseMineQuotes } from './quotes';

describe('my quotes', () => {
  it('reads the seller quote list returned by the API', () => {
    const [quote] = parseMineQuotes([
      {
        id: 'q1',
        status: 'pending',
        priceAmount: '4.50',
        currency: 'GEL',
        quantity: '2 t',
        unit: 'ton',
        createdAt: '2026-10-01T00:00:00.000Z',
        canOpenRequest: true,
        canWithdraw: true,
        request: {
          id: 'r1',
          title: 'Peaches',
          quantity: '2 t',
          unit: 'ton',
          status: 'open',
          buyer: { id: 'b1', displayName: 'Buyer' },
        },
      },
    ]);
    expect(quote).toMatchObject({
      id: 'q1',
      status: 'pending',
      canOpenRequest: true,
      requestId: 'r1',
      requestTitle: 'Peaches',
      buyerName: 'Buyer',
    });
  });

  it('reads the conversation id created from a purchase request', () => {
    expect(conversationIdFromCreate({ id: 'c1' })).toBe('c1');
    expect(conversationIdFromCreate({})).toBeNull();
  });
});

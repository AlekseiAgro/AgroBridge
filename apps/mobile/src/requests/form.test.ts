import { emptyRequestDraft, quotePayload, requestActionNeedsConfirm, requestPayload } from './form';

describe('purchase request form', () => {
  it('builds the create payload from the web fields', () => {
    expect(
      requestPayload({
        ...emptyRequestDraft(),
        title: '  Peaches  ',
        category: 'fruits',
        quantity: '2 t',
        unit: 'ton',
        variety: 'Kakheti',
        packaging: 'Box',
        destinationCountry: 'Germany',
        message: 'Need August fruit',
      }),
    ).toEqual({
      title: 'Peaches',
      category: 'fruits',
      quantity: '2 t',
      unit: 'ton',
      variety: 'Kakheti',
      packaging: 'Box',
      destinationCountry: 'Germany',
      message: 'Need August fruit',
    });
  });

  it('rejects a missing category and keeps optional fields off the payload', () => {
    expect(requestPayload({ ...emptyRequestDraft(), title: 'Tea', category: '', quantity: '10' })).toBeNull();
    expect(
      requestPayload({ ...emptyRequestDraft(), title: 'Tea', category: 'tea', quantity: '10', unit: 'crate' }),
    ).toEqual({ title: 'Tea', category: 'tea', quantity: '10' });
  });

  it('builds a quote with the same optional fields the web form sends', () => {
    expect(
      quotePayload({
        priceAmount: '12.50',
        currency: 'EUR',
        quantity: '1 t',
        unit: 'ton',
        message: 'Ready in August',
      }),
    ).toEqual({
      priceAmount: '12.50',
      currency: 'EUR',
      quantity: '1 t',
      unit: 'ton',
      message: 'Ready in August',
    });
    expect(quotePayload({ priceAmount: '12.50', currency: 'GEL' })).toEqual({
      priceAmount: '12.50',
      currency: 'GEL',
    });
    expect(quotePayload({ priceAmount: 'free', currency: 'GEL' })).toBeNull();
    expect(quotePayload({ priceAmount: '12.50', currency: 'GEL', unit: 'crate' })?.unit).toBeUndefined();
  });

  it('asks for confirmation on the same request actions as the web app', () => {
    expect(requestActionNeedsConfirm('cancel')).toBe(true);
    expect(requestActionNeedsConfirm('close')).toBe(true);
    expect(requestActionNeedsConfirm('accept')).toBe(true);
    expect(requestActionNeedsConfirm('decline')).toBe(true);
    expect(requestActionNeedsConfirm('withdraw')).toBe(false);
  });
});

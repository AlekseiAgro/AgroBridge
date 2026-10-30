import { ApiError } from '../api/errors';
import { submitHarvestUpdate } from './availability';
import { productsAfterHarvestUpdate, type SellerProduct } from './products';

const product = {
  id: 'p1',
  title: 'Tea',
  harvestStatus: 'available',
  viewCount: 12,
  watchCount: 3,
} as SellerProduct;

describe('update availability', () => {
  it('sends the selected harvest status and keeps counts the response omits', async () => {
    const calls: unknown[] = [];
    const result = await submitHarvestUpdate({
      current: 'available',
      next: 'limited',
      gate: { pending: false },
      apply: async (body) => {
        calls.push(body);
        return { ...product, harvestStatus: 'limited', viewCount: null, watchCount: null };
      },
      onPending: () => undefined,
    });
    expect(calls).toEqual([{ harvestStatus: 'limited' }]);
    expect(result.status).toBe('updated');
    if (result.status === 'updated') {
      expect(productsAfterHarvestUpdate([product], result.product)[0]).toMatchObject({
        harvestStatus: 'limited',
        viewCount: 12,
        watchCount: 3,
      });
    }
  });

  it('does not call the API when the sheet is dismissed or the current status is chosen', async () => {
    const apply = jest.fn(async () => product);
    expect(
      (
        await submitHarvestUpdate({
          current: 'available',
          next: 'dismiss',
          gate: { pending: false },
          apply,
          onPending: () => undefined,
        })
      ).status,
    ).toBe('unchanged');
    expect(
      (
        await submitHarvestUpdate({
          current: null,
          next: null,
          gate: { pending: false },
          apply,
          onPending: () => undefined,
        })
      ).status,
    ).toBe('unchanged');
    expect(apply).not.toHaveBeenCalled();
  });

  it('keeps the previous product when the update fails', async () => {
    const result = await submitHarvestUpdate({
      current: 'growing',
      next: 'soldOut',
      gate: { pending: false },
      apply: async () => {
        throw new ApiError({ message: 'missing', status: 404, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(result).toEqual({ status: 'failed', failure: 'notFound' });
    expect(product.harvestStatus).toBe('available');
  });
});

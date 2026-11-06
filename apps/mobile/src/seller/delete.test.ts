import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { DraftGate } from './draft';
import {
  beginProductDelete,
  canDeleteSellerProduct,
  deletePrompt,
  destinationAfterDelete,
  productsAfterDelete,
  takeDeletedProductId,
  type DeleteChoice,
} from './delete';
import { myProductsPhase } from './products';
import { deleteSellerProduct } from './products-api';

const statuses = [
  { moderationStatus: 'draft', isPublished: false },
  { moderationStatus: 'pending', isPublished: true },
  { moderationStatus: 'rejected', isPublished: true },
  { moderationStatus: 'approved', isPublished: true },
  { moderationStatus: 'approved', isPublished: false },
];

function product(id: string, title: string) {
  return { id, title };
}

describe('delete product', () => {
  it('offers delete for every owned lifecycle state', () => {
    for (const status of statuses) {
      expect(canDeleteSellerProduct({ id: 'p1', ...status })).toBe(true);
    }
    expect(canDeleteSellerProduct({ id: '  ' })).toBe(false);
  });

  it('names the product in a confirmation whose destructive action is not the default', () => {
    const prompt = deletePrompt({ title: '  Green tea  ' });
    expect(prompt).toEqual({
      productTitle: 'Green tea',
      namesProduct: true,
      irreversible: true,
      confirmStyle: 'destructive',
      cancelStyle: 'cancel',
    });
  });

  it('does not delete when the seller cancels', async () => {
    const remove = jest.fn(async () => undefined);
    const result = await beginProductDelete({
      product: product('p1', 'Green tea'),
      ask: async (prompt) => {
        expect(prompt.productTitle).toBe('Green tea');
        expect(prompt.irreversible).toBe(true);
        return 'cancel';
      },
      gate: { pending: false },
      remove,
      onPending: () => undefined,
    });
    expect(result).toEqual({ status: 'cancelled' });
    expect(remove).not.toHaveBeenCalled();
    expect(takeDeletedProductId()).toBeNull();
  });

  it('sends DELETE /products/:id with the access token and no body or media calls', async () => {
    const calls: { method: string; url: string; body: string | undefined; authorization: string | null }[] = [];
    const api = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          method: init?.method ?? 'GET',
          url: String(input),
          body: typeof init?.body === 'string' ? init.body : undefined,
          authorization: headers.get('Authorization'),
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    const unsaved = { title: 'Changed tea', price: '9,5' };
    const save = jest.fn(async () => unsaved);
    const result = await beginProductDelete({
      product: product('p1', 'Green tea'),
      ask: async () => 'confirm',
      gate: { pending: false },
      remove: (productId) => deleteSellerProduct(api, productId),
      onPending: () => undefined,
    });
    expect(save).not.toHaveBeenCalled();
    expect(unsaved).toEqual({ title: 'Changed tea', price: '9,5' });
    expect(calls).toEqual([
      {
        method: 'DELETE',
        url: 'https://api.agrobridge.ge/api/products/p1',
        body: undefined,
        authorization: 'Bearer token',
      },
    ]);
    expect(calls.some((call) => /\/(images|videos|certificates)\//.test(call.url))).toBe(false);
    expect(result).toEqual({ status: 'deleted', productId: 'p1' });
    expect(takeDeletedProductId()).toBe('p1');
    expect(takeDeletedProductId()).toBeNull();
  });

  it('removes the row, keeps order, and shows the empty state when it was the last product', () => {
    const remaining = productsAfterDelete(
      [
        product('p1', 'Green tea'),
        product('p2', 'Honey'),
        product('p3', 'Wine'),
      ],
      'p2',
    );
    expect(remaining.map((item) => item.id)).toEqual(['p1', 'p3']);
    const last = productsAfterDelete([product('p1', 'Green tea')], 'p1');
    expect(last).toEqual([]);
    expect(
      myProductsPhase({
        authStatus: 'authenticated',
        user: { emailVerified: true },
        profileUnavailable: false,
        loadStatus: 'ready',
        count: last.length,
      }),
    ).toBe('empty');
  });

  it('stays on My Products from the list and returns there from the editor', () => {
    expect(destinationAfterDelete('list')).toBeNull();
    expect(destinationAfterDelete('editor')).toBe('MyProducts');
  });

  it('deletes a draft, a pending product, a rejected product, and a published product', async () => {
    const removed: string[] = [];
    for (const status of statuses) {
      const result = await beginProductDelete({
        product: { id: `id-${status.moderationStatus}-${status.isPublished}`, title: 'Green tea', ...status },
        ask: async () => 'confirm',
        gate: { pending: false },
        remove: async (productId) => {
          removed.push(productId);
        },
        onPending: () => undefined,
      });
      expect(result.status).toBe('deleted');
      takeDeletedProductId();
    }
    expect(removed).toEqual([
      'id-draft-false',
      'id-pending-true',
      'id-rejected-true',
      'id-approved-true',
      'id-approved-false',
    ]);
  });

  it('ignores a second delete while the confirmation or request is open', async () => {
    const gate: DraftGate = { pending: false };
    let release: (choice: DeleteChoice) => void = () => undefined;
    const ask = jest.fn(
      () =>
        new Promise<DeleteChoice>((resolve) => {
          release = resolve;
        }),
    );
    const remove = jest.fn(async () => undefined);
    const first = beginProductDelete({
      product: product('p1', 'Green tea'),
      ask,
      gate,
      remove,
      onPending: () => undefined,
    });
    const second = await beginProductDelete({
      product: product('p1', 'Green tea'),
      ask: jest.fn(async (): Promise<DeleteChoice> => 'confirm'),
      gate,
      remove,
      onPending: () => undefined,
    });
    expect(second).toEqual({ status: 'ignored' });
    expect(ask).toHaveBeenCalledTimes(1);
    release('confirm');
    await expect(first).resolves.toEqual({ status: 'deleted', productId: 'p1' });
    expect(remove).toHaveBeenCalledTimes(1);
    takeDeletedProductId();
  });

  it('keeps the product when deletion fails', async () => {
    const rows = [product('p1', 'Green tea'), product('p2', 'Honey')];
    const cases: [ApiError, string][] = [
      [new ApiError({ message: 'Sign in', status: 401, kind: 'http' }), 'unauthorized'],
      [new ApiError({ message: 'Forbidden', status: 403, kind: 'http' }), 'forbidden'],
      [new ApiError({ message: 'Product not found', status: 404, kind: 'http' }), 'notFound'],
      [new ApiError({ message: 'Conflict', status: 409, kind: 'http' }), 'conflict'],
      [new ApiError({ message: 'offline', status: 0, kind: 'network' }), 'network'],
      [new ApiError({ message: 'nope', status: 500, kind: 'http' }), 'generic'],
    ];
    for (const [error, failure] of cases) {
      const result = await beginProductDelete({
        product: product('p1', 'Green tea'),
        ask: async () => 'confirm',
        gate: { pending: false },
        remove: async () => {
          throw error;
        },
        onPending: () => undefined,
      });
      expect(result).toEqual({ status: 'failed', failure });
      expect(rows.map((row) => row.id)).toEqual(['p1', 'p2']);
      expect(result.status).not.toBe('deleted');
    }
    expect(takeDeletedProductId()).toBeNull();
  });

  it('propagates an API error from the delete helper', async () => {
    const api = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async () =>
        new Response(JSON.stringify({ message: 'Product not found' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    });
    await expect(deleteSellerProduct(api, 'missing')).rejects.toMatchObject({ status: 404 });
  });
});

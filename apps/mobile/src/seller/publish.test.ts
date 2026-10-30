import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { DraftGate } from './draft';
import {
  editRequestBody,
  parseSellerProductDetail,
  publishActionKind,
  publishActionVisible,
  publishBlocks,
  publishStatusNote,
  routeAfterPublish,
  sellerFormFromDetail,
  submitProductPublish,
  type SellerProductDetail,
} from './edit';
import { myProductsLoadMode } from './products';
import { updateSellerProduct } from './products-api';

const photo = { id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true };

function loaded(overrides: Record<string, unknown> = {}): SellerProductDetail {
  const product = parseSellerProductDetail({
    id: 'p1',
    isOwner: true,
    title: 'Green tea',
    category: 'tea',
    unit: 'kg',
    priceFrom: 6.5,
    priceCurrency: 'GEL',
    isPublished: false,
    moderationStatus: 'draft',
    moderationNote: null,
    images: [photo],
    ...overrides,
  });
  if (!product) {
    throw new Error('fixture');
  }
  return product;
}

function publishedResponse(moderationStatus: string, moderationNote: string | null = null) {
  return {
    id: 'p1',
    isOwner: true,
    title: 'Linden honey',
    category: 'honey',
    unit: 'kg',
    priceFrom: 12.75,
    priceCurrency: 'GEL',
    isPublished: true,
    moderationStatus,
    moderationNote,
    images: [photo],
  };
}

describe('publish product', () => {
  it('shows publish for a draft, a rejected product, and an approved unpublished product', () => {
    expect(publishActionVisible(loaded())).toBe(true);
    expect(publishActionKind(loaded())).toBe('publish');
    expect(publishActionVisible(loaded({ moderationStatus: 'rejected', moderationNote: 'Unclear' }))).toBe(true);
    expect(publishActionKind(loaded({ moderationStatus: 'rejected' }))).toBe('resubmit');
    expect(publishActionVisible(loaded({ moderationStatus: 'approved', isPublished: false }))).toBe(true);
    expect(publishActionKind(loaded({ moderationStatus: 'approved', isPublished: false }))).toBe('publish');
    expect(publishStatusNote(loaded())).toBeNull();
  });

  it('hides publish while moderation is pending or the listing is already live', () => {
    const pending = loaded({ moderationStatus: 'pending', isPublished: true });
    const live = loaded({ moderationStatus: 'approved', isPublished: true });
    expect(publishActionVisible(pending)).toBe(false);
    expect(publishStatusNote(pending)).toBe('pending');
    expect(publishActionVisible(live)).toBe(false);
    expect(publishStatusNote(live)).toBe('live');
  });

  it('blocks publish until title, category, unit, price, currency, and a first photo are present', () => {
    const draft = loaded();
    const ready = sellerFormFromDetail(draft);
    expect(publishBlocks({ ...ready, title: '' }, draft)).toEqual(['titleRequired']);
    expect(publishBlocks({ ...ready, title: 'Untitled product' }, draft)).toEqual(['title']);
    expect(publishBlocks({ ...ready, category: null }, draft)).toEqual(['category']);
    expect(publishBlocks({ ...ready, unit: null }, draft)).toEqual(['unit']);
    expect(publishBlocks({ ...ready, price: '' }, draft)).toEqual(['priceFrom']);
    expect(publishBlocks({ ...ready, currency: null }, draft)).toEqual(['priceCurrency']);
    expect(publishBlocks(ready, loaded({ images: [] }))).toEqual(['photoRequired']);
    expect(publishBlocks(ready, loaded({ images: [], isPublished: true, moderationStatus: 'rejected' }))).toEqual(
      [],
    );
  });

  it('patches the current form with isPublished true and does not send moderation fields', async () => {
    const draft = loaded();
    const values = { ...sellerFormFromDetail(draft), title: '  Linden honey  ', price: '12,75', category: 'honey' as const };
    let method = '';
    let url = '';
    let sent: Record<string, unknown> | null = null;
    const api = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        method = init?.method ?? 'GET';
        url = String(input);
        sent = JSON.parse(String(init?.body)) as Record<string, unknown>;
        return new Response(JSON.stringify(publishedResponse('pending')), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const result = await submitProductPublish({
      values,
      loaded: draft,
      gate: { pending: false },
      update: (body) => updateSellerProduct(api, draft.id, body),
      onPending: () => undefined,
    });

    expect(method).toBe('PATCH');
    expect(url).toBe('https://api.agrobridge.ge/api/products/p1');
    expect(sent).toMatchObject({
      title: 'Linden honey',
      category: 'honey',
      priceFrom: 12.75,
      isPublished: true,
    });
    expect(sent).not.toHaveProperty('moderationStatus');
    expect(sent).not.toHaveProperty('moderationNote');
    expect(sent).not.toHaveProperty('farmId');
    expect(draft.title).toBe('Green tea');
    expect(result.status).toBe('published');
    if (result.status === 'published') {
      expect(result.product.moderationStatus).toBe('pending');
      expect(result.product.moderationNote).toBeNull();
      expect(result.product.isPublished).toBe(true);
      expect(publishActionVisible(result.product)).toBe(false);
    }
    expect(routeAfterPublish()).toBeNull();
    expect(myProductsLoadMode(true)).toBe('refresh');
  });

  it('clears a rejection note from the publish response and keeps a normal save unpublished', async () => {
    const rejected = loaded({
      moderationStatus: 'rejected',
      moderationNote: 'Photos are unclear',
      isPublished: false,
    });
    const values = sellerFormFromDetail(rejected);
    const result = await submitProductPublish({
      values,
      loaded: rejected,
      gate: { pending: false },
      update: async () => {
        const product = parseSellerProductDetail(publishedResponse('pending', null));
        if (!product) {
          throw new Error('fixture');
        }
        return product;
      },
      onPending: () => undefined,
    });
    expect(result.status).toBe('published');
    if (result.status === 'published') {
      expect(result.product.moderationNote).toBeNull();
      expect(result.product.moderationStatus).toBe('pending');
    }
    expect(editRequestBody(values, rejected)?.isPublished).toBe(false);
  });

  it('does not send isPublished true when a requirement is missing', async () => {
    const update = jest.fn(async () => loaded());
    const draft = loaded({ images: [] });
    const result = await submitProductPublish({
      values: sellerFormFromDetail(draft),
      loaded: draft,
      gate: { pending: false },
      update,
      onPending: () => undefined,
    });
    expect(result).toEqual({ status: 'invalid', blocks: ['photoRequired'] });
    expect(update).not.toHaveBeenCalled();
  });

  it('ignores a second publish while the first is running and a publish on a pending product', async () => {
    const gate: DraftGate = { pending: false };
    let release: (product: SellerProductDetail) => void = () => undefined;
    const update = jest.fn(
      () =>
        new Promise<SellerProductDetail>((resolve) => {
          release = resolve;
        }),
    );
    const draft = loaded();
    const values = sellerFormFromDetail(draft);
    const first = submitProductPublish({
      values,
      loaded: draft,
      gate,
      update,
      onPending: () => undefined,
    });
    const second = await submitProductPublish({
      values,
      loaded: draft,
      gate,
      update,
      onPending: () => undefined,
    });
    expect(second).toEqual({ status: 'ignored' });
    expect(update).toHaveBeenCalledTimes(1);
    release(loaded({ moderationStatus: 'pending', isPublished: true }));
    await expect(first).resolves.toMatchObject({ status: 'published' });

    const pending = await submitProductPublish({
      values,
      loaded: loaded({ moderationStatus: 'pending', isPublished: true }),
      gate: { pending: false },
      update,
      onPending: () => undefined,
    });
    expect(pending).toEqual({ status: 'ignored' });
    expect(update).toHaveBeenCalledTimes(1);
  });

  it('keeps the form values when publish fails', async () => {
    const draft = loaded();
    const values = { ...sellerFormFromDetail(draft), title: 'Linden honey' };
    const cases: [ApiError, string][] = [
      [new ApiError({ message: 'Published listings require a real title', status: 400, kind: 'http' }), 'validation'],
      [new ApiError({ message: 'Sign in', status: 401, kind: 'http' }), 'unauthorized'],
      [new ApiError({ message: 'Confirm your email', status: 403, kind: 'http' }), 'forbidden'],
      [new ApiError({ message: 'Product not found', status: 404, kind: 'http' }), 'notFound'],
      [new ApiError({ message: 'offline', status: 0, kind: 'network' }), 'network'],
      [new ApiError({ message: 'nope', status: 500, kind: 'http' }), 'generic'],
    ];
    for (const [error, failure] of cases) {
      const result = await submitProductPublish({
        values,
        loaded: draft,
        gate: { pending: false },
        update: async () => {
          throw error;
        },
        onPending: () => undefined,
      });
      expect(result).toEqual({ status: 'failed', failure });
      expect(values.title).toBe('Linden honey');
      expect(draft.title).toBe('Green tea');
    }
  });
});

import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import { editorAfterDraft, submitProductDraft, type DraftGate } from './draft';
import { parseSellerProductDetail, type SellerProductDetail } from './edit';
import {
  deleteProductImage,
  setProductImagePrimary,
  uploadProductImage,
} from './photos-api';
import {
  classifyImageBytes,
  fillProductImageForm,
  lastPublishedPhotoBlocked,
  readLocalPhotoMime,
  multipartFileValue,
  photoFileIssue,
  photoSelection,
  PRODUCT_IMAGE_FIELD,
  PRODUCT_IMAGE_KIND,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_COUNT,
  productAfterMediaChange,
  productImageDeletePath,
  productImagePart,
  productImagePrimaryPath,
  productImageUploadPath,
  remainingPhotoSlots,
  submitProductPhotoDelete,
  submitProductPhotoPrimary,
  submitProductPhotoUpload,
  type ProductPhotoFile,
} from './photos';

const jpeg: ProductPhotoFile = {
  uri: 'file:///tea.jpg',
  name: 'tea.jpg',
  mimeType: 'image/jpeg',
  fileSize: 1200,
};

function ownerBody(images: unknown[], extra: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    isOwner: true,
    title: 'Tea',
    description: '',
    isPublished: false,
    moderationStatus: 'draft',
    moderationNote: null,
    images,
    ...extra,
  };
}

function detailFrom(images: unknown[], extra: Record<string, unknown> = {}): SellerProductDetail {
  const product = parseSellerProductDetail(ownerBody(images, extra));
  if (!product) {
    throw new Error('fixture');
  }
  return product;
}

describe('product photos', () => {
  it('parses existing photos and ignores rows without an id', () => {
    const product = parseSellerProductDetail(
      ownerBody([
        { id: 'img-2', url: '/api/uploads/products/p1/b.jpg', sortOrder: 1, isPrimary: false },
        { url: '/api/uploads/products/p1/missing.jpg', isPrimary: false, sortOrder: 2 },
        { id: 'img-1', url: 'https://media.agrobridge.ge/products/p1/a.jpg', sortOrder: 0, isPrimary: true },
      ]),
    );
    expect(product?.images).toEqual([
      {
        id: 'img-2',
        url: '/api/uploads/products/p1/b.jpg',
        sortOrder: 1,
        isPrimary: false,
      },
      {
        id: 'img-1',
        url: 'https://media.agrobridge.ge/products/p1/a.jpg',
        sortOrder: 0,
        isPrimary: true,
      },
    ]);
  });

  it('allows zero photos and rejects the sixth', () => {
    expect(remainingPhotoSlots(0)).toBe(5);
    expect(photoFileIssue(jpeg, 0)).toBeNull();
    expect(photoSelection(0, 1)).toEqual({ take: 1, overflow: false });
    expect(photoSelection(4, 1)).toEqual({ take: 1, overflow: false });
    expect(remainingPhotoSlots(PRODUCT_IMAGE_MAX_COUNT)).toBe(0);
    expect(photoFileIssue(jpeg, 5)).toBe('maxReached');
    expect(photoSelection(4, 3)).toEqual({ take: 1, overflow: true });
    expect(photoSelection(5, 1)).toEqual({ take: 0, overflow: true });
  });

  it('identifies JPEG, PNG, and WebP from file bytes', async () => {
    const jpegBytes = Uint8Array.from([0xff, 0xd8, 0xff, 0x00]);
    const pngBytes = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const webpBytes = Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);
    const gifBytes = Uint8Array.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    expect(classifyImageBytes(jpegBytes)).toBe('image/jpeg');
    expect(classifyImageBytes(pngBytes)).toBe('image/png');
    expect(classifyImageBytes(webpBytes)).toBe('image/webp');
    expect(classifyImageBytes(gifBytes)).toBeNull();

    const fetchImpl = jest.fn(async () => new Response(jpegBytes));
    await expect(readLocalPhotoMime('file:///tea.jpg', fetchImpl)).resolves.toBe('image/jpeg');
    const failedFetch = jest.fn(async () => {
      throw new Error('unreadable');
    });
    await expect(readLocalPhotoMime('file:///tea.jpg', failedFetch)).resolves.toBeUndefined();
  });

  it('accepts jpeg, png, and webp and rejects other types and oversized files', () => {
    expect(photoFileIssue({ ...jpeg, mimeType: 'image/png' }, 0)).toBeNull();
    expect(photoFileIssue({ ...jpeg, mimeType: 'image/webp' }, 0)).toBeNull();
    expect(photoFileIssue({ ...jpeg, mimeType: 'image/jpg' }, 0)).toBeNull();
    expect(photoFileIssue({ ...jpeg, mimeType: 'image/gif' }, 0)).toBe('unsupported');
    expect(photoFileIssue({ ...jpeg, mimeType: null, name: 'scan.gif' }, 0)).toBeNull();
    expect(photoFileIssue({ ...jpeg, fileSize: PRODUCT_IMAGE_MAX_BYTES }, 1)).toBeNull();
    expect(photoFileIssue({ ...jpeg, fileSize: PRODUCT_IMAGE_MAX_BYTES + 1 }, 1)).toBe('tooLarge');
    expect(photoFileIssue({ ...jpeg, fileSize: null }, 1)).toBeNull();
  });

  it('builds a multipart file part without inventing a type from the filename', () => {
    expect(productImagePart(jpeg)).toEqual({
      uri: 'file:///tea.jpg',
      name: 'tea.jpg',
      type: 'image/jpeg',
    });
    expect(productImagePart({ uri: 'file:///scan', name: 'photo.jpg' })).toEqual({
      uri: 'file:///scan',
      name: 'photo.jpg',
    });
    expect(multipartFileValue(jpeg, true)).toEqual({
      uri: 'file:///tea.jpg',
      name: 'tea.jpg',
      type: 'image/jpeg',
    });
    const form = new FormData();
    fillProductImageForm(form, jpeg, false);
    expect(form.get('kind')).toBe(PRODUCT_IMAGE_KIND);
    const file = form.get(PRODUCT_IMAGE_FIELD);
    expect(file).toBeInstanceOf(File);
    expect((file as File).name).toBe('tea.jpg');
    expect((file as File).type).toBe('image/jpeg');
  });

  it('posts the image to the product images endpoint and refreshes from the response', async () => {
    const calls: { url: string; method: string; body: BodyInit | null | undefined; contentType: string | null }[] = [];
    const client = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          body: init?.body,
          contentType: headers.get('content-type'),
        });
        return new Response(JSON.stringify(ownerBody([{ id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true }])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });

    const product = await uploadProductImage(client, 'p1', jpeg);
    expect(calls[0]?.url).toBe('https://api.agrobridge.ge/api/products/p1/images');
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.contentType).toBeNull();
    expect(calls[0]?.body).toBeInstanceOf(FormData);
    expect((calls[0]?.body as FormData).get('kind')).toBe('overview');
    expect((calls[0]?.body as FormData).get('file')).toBeInstanceOf(File);
    expect(product.images).toEqual([
      { id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true },
    ]);
    expect(productImageUploadPath('p1')).toBe('/products/p1/images');
  });

  it('keeps uploaded photos when a later upload fails and allows a retry', async () => {
    const gate: DraftGate = { pending: false };
    const uploaded = detailFrom([{ id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true }]);
    let calls = 0;
    const upload = jest.fn(async () => {
      calls += 1;
      if (calls === 1) {
        throw new ApiError({ message: 'Could not upload the photo.', status: 500, kind: 'http' });
      }
      return detailFrom([
        { id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true },
        { id: 'img-2', url: '/api/uploads/products/p1/b.jpg', sortOrder: 1, isPrimary: false },
      ]);
    });
    const pending: boolean[] = [];
    const failed = await submitProductPhotoUpload({
      productId: 'p1',
      file: jpeg,
      currentCount: 1,
      gate,
      upload,
      onPending: (value) => pending.push(value),
    });
    expect(failed).toEqual({ status: 'failed', failure: 'generic' });
    expect(uploaded.images).toHaveLength(1);
    expect(gate.pending).toBe(false);
    expect(pending).toEqual([true, false]);

    const retried = await submitProductPhotoUpload({
      productId: 'p1',
      file: jpeg,
      currentCount: uploaded.images.length,
      gate,
      upload,
      onPending: () => undefined,
    });
    expect(retried.status).toBe('uploaded');
    if (retried.status === 'uploaded') {
      expect(retried.product.images).toHaveLength(2);
    }
  });

  it('ignores a second upload while the first is still running', async () => {
    const gate: DraftGate = { pending: false };
    let release: (product: SellerProductDetail) => void = () => undefined;
    const upload = jest.fn(
      () =>
        new Promise<SellerProductDetail>((resolve) => {
          release = resolve;
        }),
    );
    const first = submitProductPhotoUpload({
      productId: 'p1',
      file: jpeg,
      currentCount: 0,
      gate,
      upload,
      onPending: () => undefined,
    });
    const second = await submitProductPhotoUpload({
      productId: 'p1',
      file: jpeg,
      currentCount: 0,
      gate,
      upload,
      onPending: () => undefined,
    });
    expect(second).toEqual({ status: 'ignored' });
    expect(upload).toHaveBeenCalledTimes(1);
    release(detailFrom([{ id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true }]));
    await expect(first).resolves.toMatchObject({ status: 'uploaded' });
  });

  it('does not call upload for an unsupported file or a sixth photo', async () => {
    const gate: DraftGate = { pending: false };
    const upload = jest.fn(async () => detailFrom([]));
    await expect(
      submitProductPhotoUpload({
        productId: 'p1',
        file: { ...jpeg, mimeType: 'image/gif' },
        currentCount: 0,
        gate,
        upload,
        onPending: () => undefined,
      }),
    ).resolves.toEqual({ status: 'invalid', issue: 'unsupported' });
    await expect(
      submitProductPhotoUpload({
        productId: 'p1',
        file: jpeg,
        currentCount: 5,
        gate,
        upload,
        onPending: () => undefined,
      }),
    ).resolves.toEqual({ status: 'invalid', issue: 'maxReached' });
    expect(upload).not.toHaveBeenCalled();
    expect(gate.pending).toBe(false);
  });

  it('deletes a photo and blocks the last photo on a published product', async () => {
    const calls: string[] = [];
    const client = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
        return new Response(JSON.stringify(ownerBody([])), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      },
    });
    const removed = await deleteProductImage(client, 'p1', 'img-1');
    expect(calls).toEqual(['DELETE https://api.agrobridge.ge/api/products/p1/images/img-1']);
    expect(productImageDeletePath('p1', 'img-1')).toBe('/products/p1/images/img-1');
    expect(removed.images).toEqual([]);

    const gate: DraftGate = { pending: false };
    const remove = jest.fn(async () => detailFrom([]));
    const draftDelete = await submitProductPhotoDelete({
      productId: 'p1',
      imageId: 'img-1',
      isPublished: false,
      currentCount: 1,
      gate,
      remove,
      onPending: () => undefined,
    });
    expect(draftDelete.status).toBe('deleted');
    expect(lastPublishedPhotoBlocked(false, 1)).toBe(false);
    expect(lastPublishedPhotoBlocked(true, 1)).toBe(true);
    expect(lastPublishedPhotoBlocked(true, 2)).toBe(false);

    const blocked = await submitProductPhotoDelete({
      productId: 'p1',
      imageId: 'img-1',
      isPublished: true,
      currentCount: 1,
      gate,
      remove,
      onPending: () => undefined,
    });
    expect(blocked).toEqual({ status: 'blocked', issue: 'lastPublished' });
    expect(remove).toHaveBeenCalledTimes(1);

    remove.mockRejectedValueOnce(new ApiError({ message: 'Could not delete the photo.', status: 500, kind: 'http' }));
    const failed = await submitProductPhotoDelete({
      productId: 'p1',
      imageId: 'img-2',
      isPublished: false,
      currentCount: 2,
      gate,
      remove,
      onPending: () => undefined,
    });
    expect(failed).toEqual({ status: 'failed', failure: 'generic' });
    expect(gate.pending).toBe(false);
  });

  it('sets the catalog cover through the primary endpoint', async () => {
    const calls: string[] = [];
    const client = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        calls.push(`${init?.method ?? 'GET'} ${String(input)}`);
        return new Response(
          JSON.stringify(
            ownerBody(
              [
                { id: 'img-2', url: '/api/uploads/products/p1/b.jpg', sortOrder: 1, isPrimary: true },
                { id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: false },
              ],
              { isPublished: true, moderationStatus: 'approved' },
            ),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    const product = await setProductImagePrimary(client, 'p1', 'img-2');
    expect(calls).toEqual(['PATCH https://api.agrobridge.ge/api/products/p1/images/img-2/primary']);
    expect(productImagePrimaryPath('p1', 'img-2')).toBe('/products/p1/images/img-2/primary');
    expect(product.isPublished).toBe(true);
    expect(product.moderationStatus).toBe('approved');
    expect(product.images.find((image) => image.isPrimary)?.id).toBe('img-2');

    const current = detailFrom(
      [{ id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true }],
      { isPublished: true, moderationStatus: 'approved' },
    );
    const next = productAfterMediaChange(current, product);
    expect(next.title).toBe(current.title);
    expect(next.images).toEqual(product.images);
    expect(next.isPublished).toBe(true);
  });

  it('uploads only after the draft save returns a product id', async () => {
    const gate: DraftGate = { pending: false };
    const created = await submitProductDraft({
      title: 'Green tea',
      description: '',
      gate,
      create: async () => ({
        id: 'p-new',
        title: 'Green tea',
        priceFrom: null,
        priceCurrency: null,
        unit: null,
        isPublished: false,
        moderationStatus: 'draft',
        moderationNote: null,
        harvestStatus: null,
        images: [],
      }),
      onPending: () => undefined,
    });
    const productId = editorAfterDraft(created);
    expect(productId).toBe('p-new');
    expect(created.status === 'created' ? created.product.isPublished : null).toBe(false);

    const upload = jest.fn(async (id: string) =>
      detailFrom([{ id: 'img-1', url: '/api/uploads/products/p-new/a.jpg', sortOrder: 0, isPrimary: true }], {
        id,
      }),
    );
    const result = await submitProductPhotoUpload({
      productId: productId ?? '',
      file: jpeg,
      currentCount: 0,
      gate,
      upload,
      onPending: () => undefined,
    });
    expect(upload).toHaveBeenCalledWith('p-new', jpeg);
    expect(result.status).toBe('uploaded');
  });

  it('refreshes a rejected published listing when the photo response changes moderation', async () => {
    const gate: DraftGate = { pending: false };
    const current = detailFrom(
      [{ id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true }],
      { isPublished: true, moderationStatus: 'rejected', moderationNote: 'Unclear' },
    );
    const next = detailFrom(
      [
        { id: 'img-1', url: '/api/uploads/products/p1/a.jpg', sortOrder: 0, isPrimary: true },
        { id: 'img-2', url: '/api/uploads/products/p1/b.jpg', sortOrder: 1, isPrimary: false },
      ],
      { isPublished: true, moderationStatus: 'pending', moderationNote: null },
    );
    const result = await submitProductPhotoUpload({
      productId: 'p1',
      file: jpeg,
      currentCount: 1,
      gate,
      upload: async () => next,
      onPending: () => undefined,
    });
    expect(result.status).toBe('uploaded');
    if (result.status !== 'uploaded') {
      return;
    }
    const refreshed = productAfterMediaChange(current, result.product);
    expect(refreshed.moderationStatus).toBe('pending');
    expect(refreshed.moderationNote).toBeNull();
    expect(refreshed.isPublished).toBe(true);
    expect(refreshed.images).toHaveLength(2);
    expect(refreshed.title).toBe('Tea');
  });

  it('surfaces a primary-photo failure without dropping the gallery', async () => {
    const gate: DraftGate = { pending: false };
    const setPrimary = jest.fn(async () => {
      throw new ApiError({ message: 'Could not update the catalog cover.', status: 500, kind: 'http' });
    });
    const result = await submitProductPhotoPrimary({
      productId: 'p1',
      imageId: 'img-2',
      gate,
      setPrimary,
      onPending: () => undefined,
    });
    expect(result).toEqual({ status: 'failed', failure: 'generic' });
    expect(gate.pending).toBe(false);
  });
});

import { readFileSync } from 'fs';
import { join } from 'path';
import { PRODUCT_IMAGE_MAX_COUNT, PRODUCT_VIDEO_MAX_BYTES } from '@agrobridge/shared';
import {
  addStagedPhotos,
  discardStagedPhoto,
  moveStagedPhoto,
  removeStagedPhoto,
  revokeStagedPreviews,
  selectStagedCover,
  stagedImageIssue,
  stagedVideoIssue,
  uploadStagedProductMedia,
  type StagedPhoto,
  type StagedVideo,
} from '../../../web/src/lib/staged-product-media';

const WEB = join(__dirname, '../../../web/src');

function source(name: string): string {
  return readFileSync(join(WEB, name), 'utf8');
}

function photo(clientId: string, uploadedImageId?: string): StagedPhoto {
  return {
    clientId,
    file: new File(['photo'], `${clientId}.jpg`, { type: 'image/jpeg' }),
    previewUrl: `blob:${clientId}`,
    uploadedImageId,
  };
}

function video(clientId: string, uploadedVideoId?: string): StagedVideo {
  return {
    clientId,
    file: new File(['video'], `${clientId}.mp4`, { type: 'video/mp4' }),
    previewUrl: `blob:${clientId}`,
    uploadedVideoId,
  };
}

describe('staged product media', () => {
  it('stages photos without a product id and keeps a single cover', () => {
    const first = addStagedPhotos([], null, [photo('a'), photo('b')]);
    expect(first.photos.map((item) => item.clientId)).toEqual(['a', 'b']);
    expect(first.coverClientId).toBe('a');
    expect(first.photos.every((item) => item.uploadedImageId == null)).toBe(true);

    const covered = selectStagedCover(first.photos, 'b');
    expect(covered).toBe('b');
    expect(selectStagedCover(first.photos, 'missing')).toBeNull();

    const kept = addStagedPhotos(first.photos, covered, [photo('c')]);
    expect(kept.coverClientId).toBe('b');
    expect(kept.photos).toHaveLength(3);
  });

  it('removes a staged photo and moves the cover to the next photo', () => {
    const removed = removeStagedPhoto([photo('a'), photo('b')], 'a', 'a');
    expect(removed.photos.map((item) => item.clientId)).toEqual(['b']);
    expect(removed.coverClientId).toBe('b');
  });

  it('reorders staged photos without changing the cover', () => {
    const moved = moveStagedPhoto([photo('a'), photo('b'), photo('c')], 'c', -1);
    expect(moved.map((item) => item.clientId)).toEqual(['a', 'c', 'b']);
    expect(selectStagedCover(moved, 'a')).toBe('a');
  });

  it('rejects a sixth photo and invalid files', () => {
    const existing = Array.from({ length: PRODUCT_IMAGE_MAX_COUNT }, (_, index) =>
      photo(String(index)),
    );
    const overflow = addStagedPhotos(existing, '0', [photo('extra')]);
    expect(overflow.photos).toHaveLength(PRODUCT_IMAGE_MAX_COUNT);
    expect(overflow.overflow).toBe(1);
    expect(stagedImageIssue({ name: 'notes.txt', type: 'text/plain', size: 10 })).toBe('type');
    expect(stagedImageIssue({ name: 'big.jpg', type: 'image/jpeg', size: 6 * 1024 * 1024 })).toBe(
      'size',
    );
    expect(stagedImageIssue({ name: 'ok.webp', type: 'image/webp', size: 100 })).toBeNull();
  });

  it('treats video as optional and enforces the existing video limits', () => {
    expect(stagedVideoIssue({ name: 'clip.mp4', type: 'video/mp4', size: 100 })).toBeNull();
    expect(stagedVideoIssue({ name: 'clip.avi', type: 'video/avi', size: 100 })).toBe('type');
    expect(
      stagedVideoIssue({ name: 'clip.mp4', type: 'video/mp4', size: PRODUCT_VIDEO_MAX_BYTES + 1 }),
    ).toBe('size');
  });

  it('uploads staged media in order, persists the selected cover, and never publishes', async () => {
    const calls: Array<{ url: string; method: string; kind?: string }> = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      let kind: string | undefined;
      if (init?.body instanceof FormData) kind = String(init.body.get('kind') ?? '');
      calls.push({ url, method, kind });
      if (url.endsWith('/images') && method === 'POST') {
        const index = calls.filter(
          (call) => call.url.endsWith('/images') && call.method === 'POST',
        ).length;
        const images = [
          { id: 'img-a', isPrimary: index === 1 },
          ...(index > 1 ? [{ id: 'img-b', isPrimary: false }] : []),
        ];
        return new Response(JSON.stringify({ images }), { status: 200 });
      }
      if (url.endsWith('/primary')) {
        return new Response(JSON.stringify({ images: [{ id: 'img-b', isPrimary: true }] }), {
          status: 200,
        });
      }
      if (url.endsWith('/videos')) {
        return new Response(JSON.stringify({ videos: [{ id: 'vid-1' }] }), { status: 200 });
      }
      return new Response('{}', { status: 500 });
    }) as typeof fetch;

    const result = await uploadStagedProductMedia({
      productId: 'prod-1',
      photos: [photo('a'), photo('b')],
      coverClientId: 'b',
      video: video('clip'),
      fetchImpl,
    });

    expect(result.failedPhotoClientIds).toEqual([]);
    expect(result.videoFailed).toBe(false);
    expect(result.coverPersisted).toBe(true);
    expect(result.photos.map((item) => item.uploadedImageId)).toEqual(['img-a', 'img-b']);
    expect(result.video?.uploadedVideoId).toBe('vid-1');
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/products/prod-1/images',
      'POST /api/products/prod-1/images',
      'PATCH /api/products/prod-1/images/img-b/primary',
      'POST /api/products/prod-1/videos',
    ]);
    expect(
      calls.some((call) => call.url === '/api/products/prod-1' && call.method === 'PATCH'),
    ).toBe(false);
    expect(calls[0]?.kind).toBe('overview');
  });

  it('does not upload a photo again and does not publish when a later upload fails', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      calls.push(`${init?.method ?? 'GET'} ${url}`);
      if (calls.length === 1) {
        return new Response(JSON.stringify({ images: [{ id: 'img-b', isPrimary: false }] }), {
          status: 500,
        });
      }
      return new Response('{}', { status: 500 });
    }) as typeof fetch;

    const result = await uploadStagedProductMedia({
      productId: 'prod-1',
      photos: [photo('a', 'img-a'), photo('b')],
      coverClientId: 'a',
      video: null,
      fetchImpl,
    });

    expect(result.photos[0]?.uploadedImageId).toBe('img-a');
    expect(result.failedPhotoClientIds).toContain('b');
    expect(calls.filter((call) => call.startsWith('POST'))).toEqual([
      'POST /api/products/prod-1/images',
    ]);
    expect(calls.some((call) => call.includes('isPublished'))).toBe(false);
  });
});

describe('new product form media wiring', () => {
  const form = source('components/ProductForm.tsx');
  const staged = source('components/ProductStagedMedia.tsx');
  const edit = source('app/[locale]/dashboard/products/[id]/edit/page.tsx');
  const page = source('app/[locale]/dashboard/products/new/page.tsx');

  it('renders local staged media on the create form and keeps edit managers', () => {
    expect(page).toContain('<ProductForm mode="create" />');
    expect(page).not.toContain('apiRequestAuthed');
    expect(form).toContain('<ProductStagedMedia');
    expect(form).toContain("mode === 'create'");
    expect(staged).toContain('URL.createObjectURL');
    expect(staged).toContain('previewUrl');
    expect(staged).toContain("t('images.setCover')");
    expect(staged).toContain("t('images.coverSelected')");
    expect(staged).toContain("t('images.deletePhoto')");
    expect(staged).not.toContain('moveStagedPhoto');
    expect(staged).not.toContain("t('images.moveEarlier')");
    expect(staged).not.toContain("t('images.moveLater')");
    expect(staged).toContain('PRODUCT_IMAGE_MAX_COUNT');
    expect(staged).toContain("t('videos.optionalLabel')");
    expect(edit).toContain('ProductImagesManager');
    expect(edit).toContain('ProductVideosManager');
    expect(edit).toContain('productId={product.id}');
    expect(form).toContain('submitNewProduct(');
    expect(form).toContain("mode === 'create'\n          ? false");
    expect(form).toContain('rememberCreatedProduct(result.productId)');
    expect(form).toContain('stagedMediaError');
    const submit = source('lib/submit-new-product.ts');
    expect(submit).toContain('uploadStagedProductMedia');
    expect(submit.indexOf('uploadStagedProductMedia')).toBeLessThan(
      submit.indexOf('isPublished: true'),
    );
  });
});

describe('staged preview cleanup', () => {
  it('revokes only the removed photo preview', () => {
    const revoked: string[] = [];
    const next = discardStagedPhoto([photo('a'), photo('b')], 'b', photo('a'), (url) =>
      revoked.push(url),
    );
    expect(revoked).toEqual(['blob:a']);
    expect(next.photos.map((item) => item.clientId)).toEqual(['b']);
    expect(next.coverClientId).toBe('b');
  });

  it('revokes every preview still held on unmount', () => {
    const revoked: string[] = [];
    revokeStagedPreviews([photo('a'), photo('b')], video('clip'), (url) => revoked.push(url));
    expect(revoked).toEqual(['blob:a', 'blob:b', 'blob:clip']);
  });
});

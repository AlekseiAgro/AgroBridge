import { ApiClient } from '../api/client';
import { ApiError } from '../api/errors';
import type { DraftGate } from './draft';
import { editRequestBody, parseSellerProductDetail, sellerFormFromDetail } from './edit';
import {
  classifyVideoBytes,
  PRODUCT_VIDEO_MAX_BYTES,
  publicVideoUrl,
  submitProductVideoDelete,
  submitProductVideoReplace,
  submitProductVideoUpload,
  videoFileIssue,
  type ProductVideoFile,
  type VideoChoice,
} from './video';
import { uploadProductVideo } from './video-api';

const mp4: ProductVideoFile = {
  uri: 'file:///clip.mp4',
  name: 'clip.mp4',
  mimeType: 'video/mp4',
  fileSize: 1024,
};

function owner(extra: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    isOwner: true,
    title: 'Green tea',
    moderationStatus: 'approved',
    isPublished: true,
    moderationNote: null,
    videos: [],
    ...extra,
  };
}

function ftyp(brand: string): Uint8Array {
  const bytes = new Uint8Array(12);
  bytes.set([0x66, 0x74, 0x79, 0x70], 4);
  bytes.set(Array.from(brand).map((char) => char.charCodeAt(0)), 8);
  return bytes;
}

describe('product video', () => {
  it('accepts MP4, WebM, and QuickTime and rejects other files and files over 80 MB', () => {
    expect(classifyVideoBytes(ftyp('isom'))).toBe('video/mp4');
    expect(classifyVideoBytes(ftyp('qt  '))).toBe('video/quicktime');
    expect(classifyVideoBytes(new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]))).toBe('video/webm');
    expect(videoFileIssue(mp4)).toBeNull();
    expect(videoFileIssue({ ...mp4, name: 'clip.webm', mimeType: 'video/webm' })).toBeNull();
    expect(videoFileIssue({ ...mp4, name: 'clip.mov', mimeType: 'video/quicktime' })).toBeNull();
    expect(videoFileIssue({ ...mp4, name: 'clip.mov', mimeType: 'video/mov' })).toBeNull();
    expect(videoFileIssue({ ...mp4, name: 'clip.txt', mimeType: 'text/plain' })).toBe('unsupported');
    expect(videoFileIssue({ ...mp4, name: 'clip', mimeType: null })).toBe('unsupported');
    expect(videoFileIssue({ ...mp4, fileSize: PRODUCT_VIDEO_MAX_BYTES + 1 })).toBe('tooLarge');
    expect(videoFileIssue({ ...mp4, fileSize: PRODUCT_VIDEO_MAX_BYTES })).toBeNull();
    expect(videoFileIssue({ ...mp4, uri: '  ' })).toBe('missingFile');
  });

  it('posts multipart file to the video endpoint and does not patch the product', async () => {
    const calls: { url: string; method: string; contentType: string | null; body: BodyInit | null | undefined }[] = [];
    const save = jest.fn();
    const api = new ApiClient({
      baseUrl: 'https://api.agrobridge.ge/api',
      getAccessToken: async () => 'token',
      onUnauthorized: () => undefined,
      fetchImpl: async (input, init) => {
        const headers = new Headers(init?.headers);
        calls.push({
          url: String(input),
          method: init?.method ?? 'GET',
          contentType: headers.get('content-type'),
          body: init?.body,
        });
        return new Response(
          JSON.stringify(
            owner({
              videos: [{ id: 'v1', url: 'https://cdn.example/clip.mp4', fileName: 'clip.mp4', mimeType: 'video/mp4' }],
            }),
          ),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      },
    });
    const product = await uploadProductVideo(api, 'p1', mp4);
    expect(save).not.toHaveBeenCalled();
    expect(calls).toEqual([
      expect.objectContaining({
        method: 'POST',
        url: 'https://api.agrobridge.ge/api/products/p1/videos',
        contentType: null,
      }),
    ]);
    expect(calls[0]?.body).toBeInstanceOf(FormData);
    expect((calls[0]?.body as FormData).get('file')).toBeInstanceOf(File);
    expect((calls[0]?.body as FormData).get('kind')).toBeNull();
    expect(product.videos).toEqual([
      {
        id: 'v1',
        url: 'https://cdn.example/clip.mp4',
        fileName: 'clip.mp4',
        mimeType: 'video/mp4',
        durationSeconds: null,
      },
    ]);
    expect(publicVideoUrl(product.videos[0]?.url ?? '', 'https://api.agrobridge.ge/api')).toBe(
      'https://cdn.example/clip.mp4',
    );
  });

  it('does not upload a second video and replaces by deleting first', async () => {
    const upload = jest.fn(async () => parseSellerProductDetail(owner({ videos: [{ id: 'v2', url: 'https://cdn.example/new.mp4', fileName: 'new.mp4', mimeType: 'video/mp4' }] }))!);
    const blocked = await submitProductVideoUpload({
      productId: 'p1',
      file: mp4,
      currentCount: 1,
      gate: { pending: false },
      upload,
      onPending: () => undefined,
    });
    expect(blocked).toEqual({ status: 'invalid', issue: 'maxReached' });
    expect(upload).not.toHaveBeenCalled();

    const order: string[] = [];
    const removed = parseSellerProductDetail(owner({ videos: [], moderationStatus: 'pending', moderationNote: null }))!;
    const replaced = await submitProductVideoReplace({
      productId: 'p1',
      file: mp4,
      existingVideoId: 'v1',
      ask: async () => 'confirm',
      gate: { pending: false },
      remove: async () => {
        order.push('delete');
        return removed;
      },
      upload: async () => {
        order.push('upload');
        return upload.mock.results[0] ? removed : (await upload());
      },
      onPending: () => undefined,
    });
    expect(order).toEqual(['delete', 'upload']);
    expect(replaced.status).toBe('replaced');
  });

  it('keeps the current video when replacement is cancelled and reports a failed upload after delete', async () => {
    const remove = jest.fn(async () => parseSellerProductDetail(owner())!);
    const cancelled = await submitProductVideoReplace({
      productId: 'p1',
      file: mp4,
      existingVideoId: 'v1',
      ask: async () => 'cancel',
      gate: { pending: false },
      remove,
      upload: jest.fn(),
      onPending: () => undefined,
    });
    expect(cancelled).toEqual({ status: 'cancelled' });
    expect(remove).not.toHaveBeenCalled();

    const cleared = parseSellerProductDetail(owner({ videos: [] }))!;
    const failed = await submitProductVideoReplace({
      productId: 'p1',
      file: mp4,
      existingVideoId: 'v1',
      ask: async () => 'confirm',
      gate: { pending: false },
      remove: async () => cleared,
      upload: async () => {
        throw new ApiError({ message: 'offline', status: 0, kind: 'network' });
      },
      onPending: () => undefined,
    });
    expect(failed).toEqual({ status: 'failed', failure: 'network', product: cleared });
  });

  it('confirms before delete and ignores a second tap', async () => {
    const remove = jest.fn();
    const cancelled = await submitProductVideoDelete({
      productId: 'p1',
      videoId: 'v1',
      ask: async () => 'cancel',
      gate: { pending: false },
      remove,
      onPending: () => undefined,
    });
    expect(cancelled).toEqual({ status: 'cancelled' });
    expect(remove).not.toHaveBeenCalled();

    const gate: DraftGate = { pending: false };
    let release: (choice: VideoChoice) => void = () => undefined;
    const first = submitProductVideoDelete({
      productId: 'p1',
      videoId: 'v1',
      ask: () =>
        new Promise((resolve) => {
          release = resolve;
        }),
      gate,
      remove: async () => parseSellerProductDetail(owner({ videos: [] }))!,
      onPending: () => undefined,
    });
    const second = await submitProductVideoDelete({
      productId: 'p1',
      videoId: 'v1',
      ask: async () => 'confirm',
      gate,
      remove: async () => parseSellerProductDetail(owner())!,
      onPending: () => undefined,
    });
    expect(second).toEqual({ status: 'ignored' });
    release('confirm');
    await expect(first).resolves.toMatchObject({ status: 'deleted' });
  });

  it('maps upload and delete failures and leaves the product form unpublished flag to the response', async () => {
    const failed = await submitProductVideoUpload({
      productId: 'p1',
      file: mp4,
      currentCount: 0,
      gate: { pending: false },
      upload: async () => {
        throw new ApiError({ message: 'Video is too large', status: 400, kind: 'http' });
      },
      onPending: () => undefined,
    });
    expect(failed).toEqual({ status: 'failed', failure: 'validation' });
    const loaded = parseSellerProductDetail(owner())!;
    const body = editRequestBody(sellerFormFromDetail(loaded), loaded);
    expect(body).not.toHaveProperty('videos');
    expect(body?.isPublished).toBe(true);
  });
});

import {
  submitNewProduct,
  type CreateProductSession,
  type SubmitNewProductArgs,
} from '../../../web/src/lib/submit-new-product';
import type { StagedPhoto, StagedVideo } from '../../../web/src/lib/staged-product-media';

type Call = { url: string; method: string; body?: unknown };

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

function session(): CreateProductSession {
  return { productId: null, locked: false };
}

function args(overrides: Partial<SubmitNewProductArgs> = {}): SubmitNewProductArgs {
  return {
    intent: 'save',
    payload: { title: 'Apples' },
    photos: [],
    coverClientId: null,
    video: null,
    ...overrides,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function record(calls: Call[]): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    calls.push({ url: String(url), method, body });
    return json({ message: 'unhandled' }, 500);
  }) as typeof fetch;
}

function published(calls: Call[]): Call[] {
  return calls.filter((call) => {
    const body = call.body as { isPublished?: boolean } | undefined;
    return body?.isPublished === true;
  });
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('new product submit', () => {
  it('ignores a second submit while the first create is in flight', async () => {
    const calls: Call[] = [];
    const gate = deferred();
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ url: String(url), method, body });
      if (method === 'POST' && url === '/api/products') {
        await gate.promise;
        return json({ id: 'prod-1' });
      }
      return json({});
    }) as typeof fetch;

    const current = session();
    const first = submitNewProduct(current, args(), fetchImpl);
    const second = await submitNewProduct(current, args(), fetchImpl);
    expect(second.status).toBe('ignored');
    expect(
      calls.filter((call) => call.method === 'POST' && call.url === '/api/products'),
    ).toHaveLength(1);

    gate.resolve();
    const done = await first;
    expect(done).toMatchObject({ status: 'saved', productId: 'prod-1' });
    expect(current.locked).toBe(true);

    const third = await submitNewProduct(current, args(), fetchImpl);
    expect(third.status).toBe('ignored');
    expect(
      calls.filter((call) => call.method === 'POST' && call.url === '/api/products'),
    ).toHaveLength(1);
  });

  it('reuses the created product id when a later upload is retried', async () => {
    const calls: Call[] = [];
    let imagePosts = 0;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ url: String(url), method, body });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      if (method === 'PATCH' && url === '/api/products/prod-1') return json({ id: 'prod-1' });
      if (method === 'POST' && url.endsWith('/images')) {
        imagePosts += 1;
        if (imagePosts === 1) return json({ images: [{ id: 'img-a', isPrimary: true }] });
        if (imagePosts === 2) return json({ message: 'upload failed' }, 500);
        return json({
          images: [
            { id: 'img-a', isPrimary: true },
            { id: 'img-b', isPrimary: false },
          ],
        });
      }
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const current = session();
    const staged = args({
      photos: [photo('a'), photo('b')],
      coverClientId: 'a',
    });
    const failed = await submitNewProduct(current, staged, fetchImpl);
    expect(failed.status).toBe('media-failed');
    expect(failed.productId).toBe('prod-1');
    expect(failed.photos[0]?.uploadedImageId).toBe('img-a');
    expect(failed.photos[1]?.uploadedImageId).toBeUndefined();

    const retried = await submitNewProduct(
      current,
      args({ photos: failed.photos, coverClientId: 'a' }),
      fetchImpl,
    );
    expect(retried).toMatchObject({ status: 'saved', productId: 'prod-1' });
    expect(retried.photos.map((item) => item.uploadedImageId)).toEqual(['img-a', 'img-b']);
    expect(
      calls.filter((call) => call.method === 'POST' && call.url === '/api/products'),
    ).toHaveLength(1);
    expect(
      calls.filter((call) => call.method === 'PATCH' && call.url === '/api/products/prod-1'),
    ).toHaveLength(1);
    expect(
      calls.filter((call) => call.method === 'POST' && call.url.endsWith('/images')),
    ).toHaveLength(3);
    const imagePostsOnRetry = calls
      .filter((call) => call.method === 'POST' && call.url.endsWith('/images'))
      .slice(2);
    expect(imagePostsOnRetry).toHaveLength(1);
    expect(published(calls)).toEqual([]);
  });

  it('does not upload a video again after it succeeded and a photo failed', async () => {
    const calls: Call[] = [];
    let imageAttempt = 0;
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url: String(url), method });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      if (method === 'PATCH' && url === '/api/products/prod-1') return json({ id: 'prod-1' });
      if (method === 'POST' && url.endsWith('/images')) {
        imageAttempt += 1;
        if (imageAttempt === 1) return json({ message: 'upload failed' }, 500);
        return json({ images: [{ id: 'img-a', isPrimary: true }] });
      }
      if (method === 'POST' && url.endsWith('/videos')) return json({ videos: [{ id: 'vid-1' }] });
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const current = session();
    const failed = await submitNewProduct(
      current,
      args({ photos: [photo('a')], coverClientId: 'a', video: video('clip') }),
      fetchImpl,
    );
    expect(failed.status).toBe('media-failed');
    expect(failed.video?.uploadedVideoId).toBe('vid-1');

    const retried = await submitNewProduct(
      current,
      args({
        photos: failed.photos,
        coverClientId: 'a',
        video: failed.video,
      }),
      fetchImpl,
    );
    expect(retried.status).toBe('saved');
    expect(
      calls.filter((call) => call.url.endsWith('/videos') && call.method === 'POST'),
    ).toHaveLength(1);
    expect(
      calls.filter((call) => call.url.endsWith('/images') && call.method === 'POST'),
    ).toHaveLength(2);
  });

  it('sends the primary-image request for the selected cover photo', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url: String(url), method });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      if (method === 'POST' && url.endsWith('/images')) {
        const index = calls.filter(
          (call) => call.url.endsWith('/images') && call.method === 'POST',
        ).length;
        const images = [
          { id: 'img-a', isPrimary: true },
          ...(index > 1 ? [{ id: 'img-b', isPrimary: false }] : []),
        ];
        return json({ images });
      }
      if (url.endsWith('/primary')) return json({ images: [{ id: 'img-b', isPrimary: true }] });
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const result = await submitNewProduct(
      session(),
      args({ photos: [photo('a'), photo('b')], coverClientId: 'b' }),
      fetchImpl,
    );
    expect(result.status).toBe('saved');
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/products',
      'POST /api/products/prod-1/images',
      'POST /api/products/prod-1/images',
      'PATCH /api/products/prod-1/images/img-b/primary',
    ]);
  });

  it('leaves the first uploaded photo primary when no cover was selected', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      calls.push({ url: String(url), method });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      if (method === 'POST' && url.endsWith('/images')) {
        const index = calls.filter(
          (call) => call.url.endsWith('/images') && call.method === 'POST',
        ).length;
        return json({
          images: [
            { id: 'img-a', isPrimary: true },
            ...(index > 1 ? [{ id: 'img-b', isPrimary: false }] : []),
          ],
        });
      }
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const result = await submitNewProduct(
      session(),
      args({ photos: [photo('a'), photo('b')], coverClientId: null }),
      fetchImpl,
    );
    expect(result.status).toBe('saved');
    expect(result.photos[0]?.uploadedImageId).toBe('img-a');
    expect(calls.some((call) => call.url.endsWith('/primary'))).toBe(false);
  });

  it('does not create or publish when publish is requested with no photo', async () => {
    const calls: Call[] = [];
    const result = await submitNewProduct(session(), args({ intent: 'publish' }), record(calls));
    expect(result.status).toBe('photo-required');
    expect(result.productId).toBeNull();
    expect(calls).toEqual([]);
  });

  it('creates a draft, uploads the photo, then publishes', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ url: String(url), method, body });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      if (method === 'POST' && url.endsWith('/images')) {
        return json({ images: [{ id: 'img-a', isPrimary: true }] });
      }
      if (method === 'PATCH' && url === '/api/products/prod-1') return json({ id: 'prod-1' });
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const result = await submitNewProduct(
      session(),
      args({ intent: 'publish', photos: [photo('a')], coverClientId: null }),
      fetchImpl,
    );
    expect(result.status).toBe('published');
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/products',
      'POST /api/products/prod-1/images',
      'PATCH /api/products/prod-1',
    ]);
    expect(calls[0]?.body).toMatchObject({ isPublished: false, title: 'Apples' });
    expect(calls[2]?.body).toEqual({ isPublished: true });
  });

  it('does not publish when a staged upload fails', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ url: String(url), method, body });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      return json({ message: 'upload failed' }, 500);
    }) as typeof fetch;

    const result = await submitNewProduct(
      session(),
      args({ intent: 'publish', photos: [photo('a')], coverClientId: 'a' }),
      fetchImpl,
    );
    expect(result.status).toBe('media-failed');
    expect(result.productId).toBe('prod-1');
    expect(published(calls)).toEqual([]);
  });

  it('saves one unpublished draft when there is no staged media', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ url: String(url), method, body });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const result = await submitNewProduct(session(), args(), fetchImpl);
    expect(result).toMatchObject({ status: 'saved', productId: 'prod-1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/products' });
    expect(calls[0]?.body).toMatchObject({ isPublished: false });
  });

  it('uploads staged media on save and leaves the product unpublished', async () => {
    const calls: Call[] = [];
    const fetchImpl = (async (url: string, init?: RequestInit) => {
      const method = init?.method ?? 'GET';
      const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
      calls.push({ url: String(url), method, body });
      if (method === 'POST' && url === '/api/products') return json({ id: 'prod-1' });
      if (method === 'POST' && url.endsWith('/images')) {
        return json({ images: [{ id: 'img-a', isPrimary: true }] });
      }
      if (method === 'POST' && url.endsWith('/videos')) return json({ videos: [{ id: 'vid-1' }] });
      return json({ message: 'unexpected' }, 500);
    }) as typeof fetch;

    const result = await submitNewProduct(
      session(),
      args({ photos: [photo('a')], coverClientId: null, video: video('clip') }),
      fetchImpl,
    );
    expect(result.status).toBe('saved');
    expect(result.photos[0]?.uploadedImageId).toBe('img-a');
    expect(result.video?.uploadedVideoId).toBe('vid-1');
    expect(calls.map((call) => `${call.method} ${call.url}`)).toEqual([
      'POST /api/products',
      'POST /api/products/prod-1/images',
      'POST /api/products/prod-1/videos',
    ]);
    expect(published(calls)).toEqual([]);
  });
});
